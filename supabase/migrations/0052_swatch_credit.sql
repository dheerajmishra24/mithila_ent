-- Migration 0052: swatch kits and the swatch-recovery credit ledger.
--
-- A swatch kit is an order of kind 'swatch': up to N fabric swatches for one
-- GST-inclusive price (default Rs 99, shipping included). When the kit is
-- paid, the amount paid is credited to the customer's swatch-credit account.
-- The credit is redeemed against a later metre-fabric order as part payment
-- (it is not a discount, so the order's GST is unchanged), and comes back if
-- that order is cancelled. Every movement is a ledger row with a UNIQUE
-- idempotency key; the balance lives in one row per customer, changed only
-- under a row lock with a CHECK (balance >= 0).

-- 1. Settings ---------------------------------------------------------------
CREATE TABLE public.swatch_settings (
  id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled       boolean       NOT NULL DEFAULT true,
  kit_price     numeric(10,2) NOT NULL DEFAULT 99.00 CHECK (kit_price >= 1 AND kit_price <= 10000),
  max_swatches  integer       NOT NULL DEFAULT 5 CHECK (max_swatches BETWEEN 1 AND 20),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);
INSERT INTO public.swatch_settings (id) VALUES (1);

ALTER TABLE public.swatch_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.swatch_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.swatch_settings TO anon, authenticated;
GRANT SELECT, UPDATE ON public.swatch_settings TO service_role;
-- Price and size are public (shown on product pages).
CREATE POLICY "Anyone can read swatch settings" ON public.swatch_settings
  FOR SELECT TO anon, authenticated USING (true);

-- 2. Orders and lines ---------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN order_kind     text          NOT NULL DEFAULT 'standard',
  ADD COLUMN credit_applied numeric(10,2) NOT NULL DEFAULT 0,
  ADD CONSTRAINT orders_kind_check CHECK (order_kind IN ('standard', 'swatch')),
  ADD CONSTRAINT orders_credit_applied_check CHECK (credit_applied >= 0),
  ADD CONSTRAINT orders_swatch_no_credit CHECK (order_kind = 'standard' OR credit_applied = 0);
-- What the customer still owes through the payment gateway.
ALTER TABLE public.orders
  ADD COLUMN amount_due numeric(10,2) GENERATED ALWAYS AS (GREATEST(total_amount - credit_applied, 0)) STORED;

ALTER TABLE public.order_items
  ADD COLUMN is_swatch boolean NOT NULL DEFAULT false;

-- 3. Credit accounts and ledger ----------------------------------------------
CREATE TABLE public.swatch_credit_accounts (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance    numeric(10,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE public.swatch_credit_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id        uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  entry           text NOT NULL CHECK (entry IN ('earn', 'redeem', 'restore', 'revoke', 'adjust')),
  amount          numeric(10,2) NOT NULL CHECK (amount <> 0),
  balance_after   numeric(10,2) NOT NULL CHECK (balance_after >= 0),
  idempotency_key text NOT NULL UNIQUE,
  note            text CHECK (note IS NULL OR length(note) <= 500),
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX swatch_credit_ledger_user_idx ON public.swatch_credit_ledger (user_id, created_at DESC);
CREATE INDEX swatch_credit_ledger_order_idx ON public.swatch_credit_ledger (order_id);

ALTER TABLE public.swatch_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swatch_credit_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.swatch_credit_accounts, public.swatch_credit_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.swatch_credit_accounts, public.swatch_credit_ledger TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.swatch_credit_accounts TO service_role;
GRANT SELECT, INSERT ON public.swatch_credit_ledger TO service_role;

CREATE POLICY "Own swatch credit account" ON public.swatch_credit_accounts
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));
CREATE POLICY "Own swatch credit ledger" ON public.swatch_credit_ledger
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- 4. The one place a balance changes ----------------------------------------
-- p_amount is signed. With p_clamp, a debit larger than the balance takes
-- what is there (used to revoke credit already partly spent). Returns the
-- amount actually posted (0 when the key was already used or nothing to do).
CREATE OR REPLACE FUNCTION public.swatch_credit_post(
  p_user_id uuid, p_order_id uuid, p_entry text, p_amount numeric, p_key text,
  p_note text DEFAULT NULL, p_actor uuid DEFAULT NULL, p_clamp boolean DEFAULT false)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_balance numeric(10,2);
  v_amount  numeric(10,2) := round(p_amount, 2);
BEGIN
  IF p_user_id IS NULL OR p_key IS NULL OR length(p_key) > 200 THEN
    RAISE EXCEPTION 'INVALID_CREDIT_ENTRY';
  END IF;

  INSERT INTO public.swatch_credit_accounts (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT a.balance INTO v_balance
    FROM public.swatch_credit_accounts a
   WHERE a.user_id = p_user_id
     FOR UPDATE;

  -- Idempotent: the same event never posts twice.
  IF EXISTS (SELECT 1 FROM public.swatch_credit_ledger l WHERE l.idempotency_key = p_key) THEN
    RETURN 0;
  END IF;

  IF v_amount < 0 AND v_balance + v_amount < 0 THEN
    IF p_clamp THEN
      v_amount := -v_balance;
    ELSE
      RAISE EXCEPTION 'INSUFFICIENT_CREDIT';
    END IF;
  END IF;
  IF v_amount = 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.swatch_credit_accounts
     SET balance = balance + v_amount, updated_at = now()
   WHERE user_id = p_user_id;
  INSERT INTO public.swatch_credit_ledger
    (user_id, order_id, entry, amount, balance_after, idempotency_key, note, created_by)
  VALUES (p_user_id, p_order_id, p_entry, v_amount, v_balance + v_amount, p_key, p_note, p_actor);
  RETURN v_amount;
END;
$$;
REVOKE ALL ON FUNCTION public.swatch_credit_post(uuid, uuid, text, numeric, text, text, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.swatch_credit_post(uuid, uuid, text, numeric, text, text, uuid, boolean)
  TO service_role;

-- 5. Create a swatch kit order ------------------------------------------------
-- The kit price is GST-inclusive and shared equally across the chosen
-- swatches (last line takes the paise remainder). Each line's taxable value
-- is backed out at that fabric's GST rate, so the invoice totals exactly the
-- kit price. Swatches come from sample cards, so no roll or stock is touched.
CREATE OR REPLACE FUNCTION public.create_swatch_order(
  p_user_id uuid, p_variant_ids uuid[], p_shipping jsonb, p_idempotency_key text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_set       public.swatch_settings%ROWTYPE;
  v_supplier  text;
  v_pos       text;
  v_gstin     text;
  v_n         integer;
  v_order_id  uuid;
  v_existing  uuid;
  v_open      integer;
  v_lapsed    integer;
  v_i         integer := 0;
  v_share     numeric(10,2);
  v_incl      numeric(10,2);
  v_taxable   numeric(10,2);
  v_tax       numeric(10,2);
  v_rate      numeric(5,2);
  v_cgst      numeric(10,2);
  v_sgst      numeric(10,2);
  v_igst      numeric(10,2);
  v_row       record;
  t_taxable   numeric(12,2) := 0;
  t_cgst      numeric(12,2) := 0;
  t_sgst      numeric(12,2) := 0;
  t_igst      numeric(12,2) := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  SELECT * INTO v_set FROM public.swatch_settings WHERE id = 1;
  IF NOT FOUND OR NOT v_set.enabled THEN
    RAISE EXCEPTION 'SWATCHES_DISABLED';
  END IF;

  v_n := COALESCE(array_length(p_variant_ids, 1), 0);
  IF v_n = 0 THEN
    RAISE EXCEPTION 'EMPTY_SWATCH_KIT';
  END IF;
  IF v_n > v_set.max_swatches
     OR v_n <> (SELECT count(DISTINCT x) FROM unnest(p_variant_ids) AS x) THEN
    RAISE EXCEPTION 'INVALID_SWATCH_KIT';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('create_order_atomic:' || p_user_id::text, 0));

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.orders
     WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  -- Same unpaid-order caps as create_order_atomic.
  SELECT count(*) INTO v_open FROM public.orders o
   WHERE o.user_id = p_user_id AND o.status = 'pending' AND COALESCE(o.is_paid, false) = false;
  IF v_open >= 3 THEN
    RAISE EXCEPTION 'TOO_MANY_PENDING_ORDERS';
  END IF;
  SELECT count(*) INTO v_lapsed
    FROM public.order_events e JOIN public.orders o ON o.id = e.order_id
   WHERE o.user_id = p_user_id AND e.event = 'order.payment_timeout'
     AND e.created_at > now() - interval '24 hours';
  IF v_lapsed >= 5 THEN
    RAISE EXCEPTION 'TOO_MANY_UNPAID_ORDERS';
  END IF;

  -- Every swatch must be an active product's variant.
  IF (SELECT count(*) FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
       WHERE pv.id = ANY (p_variant_ids) AND p.status = 'active') <> v_n THEN
    RAISE EXCEPTION 'VARIANT_NOT_FOUND';
  END IF;

  SELECT s.supplier_state_code INTO v_supplier FROM public.gst_settings s WHERE s.id = 1;
  v_pos := public.gst_state_code(p_shipping ->> 'state');
  IF v_pos IS NULL THEN
    RAISE EXCEPTION 'INVALID_STATE';
  END IF;
  v_gstin := NULLIF(upper(btrim(COALESCE(p_shipping ->> 'gstin', ''))), '');
  IF v_gstin IS NOT NULL AND v_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' THEN
    RAISE EXCEPTION 'INVALID_GSTIN';
  END IF;

  BEGIN
    INSERT INTO public.orders (user_id, status, order_kind, subtotal, tax_amount, shipping_amount,
                               total_amount, shipping_address, idempotency_key)
    VALUES (p_user_id, 'pending', 'swatch', 0, 0, 0, 0, COALESCE(p_shipping, '{}'::jsonb), p_idempotency_key)
    RETURNING id INTO v_order_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_existing FROM public.orders
     WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
    RAISE;
  END;

  v_share := trunc(v_set.kit_price / v_n, 2);
  FOR v_row IN
    SELECT pv.id AS variant_id, p.hsn_code, COALESCE(p.gst_rate, 5.00) AS fallback
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
     WHERE pv.id = ANY (p_variant_ids)
     ORDER BY pv.id
  LOOP
    v_i := v_i + 1;
    v_incl := CASE WHEN v_i = v_n THEN v_set.kit_price - v_share * (v_n - 1) ELSE v_share END;
    v_rate := public.gst_rate_for(v_row.hsn_code, v_incl, v_row.fallback);
    v_taxable := round(v_incl / (1 + v_rate / 100), 2);
    v_tax := v_incl - v_taxable;
    IF v_pos = v_supplier THEN
      v_cgst := round(v_tax / 2, 2); v_sgst := v_tax - v_cgst; v_igst := 0;
    ELSE
      v_cgst := 0; v_sgst := 0; v_igst := v_tax;
    END IF;
    INSERT INTO public.order_items (order_id, variant_id, quantity, unit_price, uqc, status, is_swatch,
                                    hsn_code, gst_rate, discount_share, taxable_value, cgst, sgst, igst)
    VALUES (v_order_id, v_row.variant_id, 1, v_taxable, 'PCS', 'pending', true,
            v_row.hsn_code, v_rate, 0, v_taxable, v_cgst, v_sgst, v_igst);
    t_taxable := t_taxable + v_taxable;
    t_cgst := t_cgst + v_cgst; t_sgst := t_sgst + v_sgst; t_igst := t_igst + v_igst;
  END LOOP;

  UPDATE public.orders
     SET subtotal = t_taxable, tax_amount = t_cgst + t_sgst + t_igst, total_amount = v_set.kit_price,
         place_of_supply = v_pos, buyer_gstin = v_gstin, taxable_value = t_taxable,
         cgst_total = t_cgst, sgst_total = t_sgst, igst_total = t_igst
   WHERE id = v_order_id;

  INSERT INTO public.order_events (order_id, event, to_status, note)
  VALUES (v_order_id, 'order.swatch_kit_created', 'pending', v_n || ' swatch(es)');
  RETURN v_order_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_swatch_order(uuid, uuid[], jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_swatch_order(uuid, uuid[], jsonb, text) TO service_role;

-- 6. Redeem credit on a metre-fabric order -----------------------------------
-- Applied as part payment before the gateway order exists. At least Rs 1 is
-- left to pay so the order still goes through the payment gateway.
CREATE OR REPLACE FUNCTION public.apply_swatch_credit(p_order_id uuid, p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order   record;
  v_balance numeric(10,2);
  v_amount  numeric(10,2);
  v_posted  numeric(10,2);
BEGIN
  SELECT o.id, o.user_id, o.status, o.is_paid, o.order_kind, o.credit_applied,
         o.total_amount, o.razorpay_order_id
    INTO v_order
    FROM public.orders o
   WHERE o.id = p_order_id
     FOR UPDATE;
  IF NOT FOUND OR v_order.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;
  IF v_order.order_kind <> 'standard' OR v_order.status <> 'pending' OR COALESCE(v_order.is_paid, false)
     OR v_order.credit_applied > 0 OR v_order.razorpay_order_id IS NOT NULL THEN
    RETURN 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.order_items i
                  WHERE i.order_id = p_order_id AND i.uqc = 'MTR' AND NOT i.is_swatch) THEN
    RETURN 0;
  END IF;

  SELECT a.balance INTO v_balance FROM public.swatch_credit_accounts a WHERE a.user_id = p_user_id;
  v_amount := LEAST(COALESCE(v_balance, 0), v_order.total_amount - 1.00);
  IF v_amount <= 0 THEN
    RETURN 0;
  END IF;

  v_posted := -public.swatch_credit_post(p_user_id, p_order_id, 'redeem', -v_amount,
                                         'redeem:' || p_order_id::text, 'Applied to order');
  IF v_posted <= 0 THEN
    RETURN 0;
  END IF;
  UPDATE public.orders SET credit_applied = v_posted WHERE id = p_order_id;
  INSERT INTO public.order_events (order_id, event, note)
  VALUES (p_order_id, 'order.swatch_credit_applied', 'Swatch credit applied: ' || v_posted);
  RETURN v_posted;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_swatch_credit(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_swatch_credit(uuid, uuid) TO service_role;

-- 7. Earn, restore and revoke follow the order's own state ------------------
CREATE OR REPLACE FUNCTION public.orders_swatch_credit_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- A paid swatch kit earns its price as credit.
  IF NEW.order_kind = 'swatch' AND NEW.is_paid AND NOT COALESCE(OLD.is_paid, false)
     AND NEW.status <> 'cancelled' AND NEW.user_id IS NOT NULL THEN
    PERFORM public.swatch_credit_post(NEW.user_id, NEW.id, 'earn', NEW.total_amount,
                                      'earn:' || NEW.id::text, 'Swatch kit paid');
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' AND NEW.user_id IS NOT NULL THEN
    -- Credit used on a cancelled order goes back to the customer.
    IF NEW.credit_applied > 0 THEN
      PERFORM public.swatch_credit_post(NEW.user_id, NEW.id, 'restore', NEW.credit_applied,
                                        'restore:' || NEW.id::text, 'Order cancelled');
    END IF;
    -- A cancelled (refunded) swatch kit takes back what it earned, as far as
    -- the balance allows.
    IF NEW.order_kind = 'swatch' AND EXISTS (SELECT 1 FROM public.swatch_credit_ledger l
                                              WHERE l.idempotency_key = 'earn:' || NEW.id::text) THEN
      PERFORM public.swatch_credit_post(NEW.user_id, NEW.id, 'revoke', -NEW.total_amount,
                                        'revoke:' || NEW.id::text, 'Swatch kit cancelled', NULL, true);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.orders_swatch_credit_events() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER orders_swatch_credit_events
  AFTER UPDATE OF is_paid, status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_swatch_credit_events();

-- Swatch kits are cancelled whole, never line by line.
CREATE OR REPLACE FUNCTION public.order_item_cancellations_no_swatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.orders o WHERE o.id = NEW.order_id AND o.order_kind = 'swatch') THEN
    RAISE EXCEPTION 'SWATCH_ORDER_NOT_PARTIAL';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.order_item_cancellations_no_swatch() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER order_item_cancellations_no_swatch
  BEFORE INSERT ON public.order_item_cancellations
  FOR EACH ROW EXECUTE FUNCTION public.order_item_cancellations_no_swatch();

-- 8. Payment: the gateway is owed the amount after credit ---------------------
CREATE OR REPLACE FUNCTION public.record_payment(
  p_order_id            uuid,
  p_provider            text,
  p_provider_payment_id text,
  p_amount              numeric,
  p_status              text  DEFAULT 'captured',
  p_method              text  DEFAULT NULL,
  p_currency            text  DEFAULT 'INR',
  p_raw                 jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment_id  uuid;
  v_order_due   numeric;
  v_order_state public.order_status;
  v_status      public.payment_status := p_status::public.payment_status;
BEGIN
  -- Lock the order: concurrent verify + webhook calls for the same order now
  -- run one after the other.
  SELECT o.amount_due, o.status INTO v_order_due, v_order_state
    FROM public.orders o
   WHERE o.id = p_order_id
     FOR UPDATE;
  IF NOT FOUND OR v_order_due IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  -- Do not accept a capture for less than what is due through the gateway
  -- (order total minus swatch credit applied; tampered payloads).
  IF v_status = 'captured'::public.payment_status AND p_amount < v_order_due THEN
    RAISE EXCEPTION 'PARTIAL_PAYMENT_REJECTED: Captured % vs Expected %', p_amount, v_order_due;
  END IF;

  -- Idempotency: same gateway payment id + status already recorded.
  IF p_provider_payment_id IS NOT NULL THEN
    INSERT INTO public.payments (order_id, provider, provider_payment_id, amount, currency, status, method, raw)
    VALUES (p_order_id, p_provider, p_provider_payment_id, p_amount, p_currency, v_status, p_method, p_raw)
    ON CONFLICT (provider_payment_id, status) WHERE provider_payment_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_payment_id;

    IF v_payment_id IS NULL THEN
      SELECT p.id INTO v_payment_id
        FROM public.payments p
       WHERE p.provider_payment_id = p_provider_payment_id
         AND p.status = v_status;
      RETURN v_payment_id;   -- already recorded: no second side effect
    END IF;
  ELSE
    INSERT INTO public.payments (order_id, provider, provider_payment_id, amount, currency, status, method, raw)
    VALUES (p_order_id, p_provider, NULL, p_amount, p_currency, v_status, p_method, p_raw)
    RETURNING id INTO v_payment_id;
  END IF;

  IF v_status = 'captured'::public.payment_status THEN
    UPDATE public.orders
       SET is_paid = true,
           status = CASE WHEN status = 'pending'::public.order_status
                         THEN 'paid'::public.order_status ELSE status END,
           payment_intent_id = COALESCE(p_provider_payment_id, payment_intent_id)
     WHERE id = p_order_id;
    IF v_order_state = 'cancelled'::public.order_status THEN
      INSERT INTO public.order_events (order_id, event, note)
      VALUES (p_order_id, 'payment.captured_after_cancel',
              'Payment captured on a cancelled order: refund required');
    END IF;
  ELSIF v_status = 'failed'::public.payment_status THEN
    INSERT INTO public.order_events (order_id, event, note)
    VALUES (p_order_id, 'payment.failed', COALESCE(p_provider, 'gateway') || ' payment failed');
  ELSIF v_status = 'refunded'::public.payment_status THEN
    INSERT INTO public.order_events (order_id, event, note)
    VALUES (p_order_id, 'payment.refunded', 'Payment refunded');
  END IF;

  RETURN v_payment_id;
END;
$$;

-- 9. Releasing stock skips swatch lines (no roll or stock was taken) ---------
CREATE OR REPLACE FUNCTION public.release_order_item_stock(p_order_item_id uuid, p_restock boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item record;
  v_cut  record;
  v_roll uuid;
BEGIN
  SELECT i.id, i.order_id, i.variant_id, i.quantity, i.uqc, i.is_swatch
    INTO v_item
    FROM public.order_items i
   WHERE i.id = p_order_item_id;
  IF NOT FOUND OR v_item.variant_id IS NULL THEN
    RETURN false;
  END IF;
  IF v_item.is_swatch THEN
    RETURN false;  -- swatch kits take no roll or stock
  END IF;

  PERFORM 1 FROM public.product_variants pv WHERE pv.id = v_item.variant_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT c.* INTO v_cut
    FROM public.order_item_cuts c
   WHERE c.order_item_id = p_order_item_id
     FOR UPDATE;

  IF NOT FOUND THEN
    -- Piece product (or a metre line from before 0050).
    IF NOT p_restock THEN
      RETURN false;
    END IF;
    IF v_item.uqc = 'MTR' AND EXISTS (SELECT 1 FROM public.fabric_rolls r WHERE r.variant_id = v_item.variant_id) THEN
      -- Pre-0050 metre line: return it as a returned piece on a new roll.
      INSERT INTO public.fabric_rolls (variant_id, total_m, remaining_m, dye_lot)
      VALUES (v_item.variant_id, v_item.quantity, v_item.quantity, 'UNRECORDED')
      RETURNING id INTO v_roll;
      INSERT INTO public.roll_events (roll_id, event, delta_m, order_id, note)
      VALUES (v_roll, 'returned_piece', v_item.quantity, v_item.order_id, 'Returned line from before roll tracking');
      RETURN true;
    END IF;
    UPDATE public.product_variants
       SET stock_quantity = stock_quantity + v_item.quantity
     WHERE id = v_item.variant_id;
    RETURN true;
  END IF;

  IF v_cut.status = 'released' THEN
    RETURN false;
  END IF;

  IF v_cut.status = 'allocated' THEN
    -- Not cut yet: the metres were never removed from the bolt.
    IF v_cut.roll_id IS NOT NULL THEN
      PERFORM 1 FROM public.fabric_rolls r WHERE r.id = v_cut.roll_id FOR UPDATE;
      UPDATE public.fabric_rolls
         SET remaining_m = remaining_m + v_cut.length_m,
             status = CASE WHEN status = 'retired' THEN status ELSE 'active' END
       WHERE id = v_cut.roll_id;
      INSERT INTO public.roll_events (roll_id, event, delta_m, order_id, note)
      VALUES (v_cut.roll_id, 'released', v_cut.length_m, v_item.order_id, 'Uncut allocation released');
    END IF;
    UPDATE public.order_item_cuts SET status = 'released', released_at = now() WHERE id = v_cut.id;
    RETURN v_cut.roll_id IS NOT NULL;
  END IF;

  -- Already cut: the piece is a separate length now.
  UPDATE public.order_item_cuts SET status = 'released', released_at = now() WHERE id = v_cut.id;
  IF NOT p_restock THEN
    RETURN false;
  END IF;
  INSERT INTO public.fabric_rolls (variant_id, total_m, remaining_m, dye_lot, parent_roll_id)
  VALUES (v_item.variant_id, v_cut.length_m, v_cut.length_m, v_cut.dye_lot, v_cut.roll_id)
  RETURNING id INTO v_roll;
  INSERT INTO public.roll_events (roll_id, event, delta_m, order_id, note)
  VALUES (v_roll, 'returned_piece', v_cut.length_m, v_item.order_id,
          format('Cut piece from %s returned to stock', v_cut.roll_code));
  RETURN true;
END;
$$;

-- 10. Owner adjustments (goodwill credit or correction) ----------------------
CREATE OR REPLACE FUNCTION public.admin_adjust_swatch_credit(
  p_user_id uuid, p_amount numeric, p_note text, p_actor uuid, p_key text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount = 0 OR abs(p_amount) > 100000 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;
  IF p_note IS NULL OR length(btrim(p_note)) < 3 THEN
    RAISE EXCEPTION 'NOTE_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
  RETURN public.swatch_credit_post(p_user_id, NULL, 'adjust', p_amount,
                                   'adjust:' || p_key, btrim(p_note), p_actor);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_adjust_swatch_credit(uuid, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_swatch_credit(uuid, numeric, text, uuid, text) TO service_role;
