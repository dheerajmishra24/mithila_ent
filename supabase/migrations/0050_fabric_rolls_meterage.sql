-- 0050: metre-based roll inventory (PRODUCTION_CHECKLIST D2-1..D2-5, D3-6,
-- D5-1, D5-7, D6-2).
--
-- * Quantities are NUMERIC(10,2). Fabric sold by the metre (sell_unit 'MTR')
--   goes in 0.5 m steps; items sold by the piece ('PCS') in whole numbers.
-- * Physical bolts live in fabric_rolls (dye lot, total and remaining metres).
--   product_variants.stock_quantity becomes a cache of the sellable metres on
--   active and remnant rolls, kept by trigger; direct writes to it are ignored
--   for metre products.
-- * Every metre line is cut from ONE roll (order_item_cuts, UNIQUE per line):
--   create_order_atomic picks the smallest roll that holds the whole length
--   (best fit, so remnants are used first) or fails NO_CONTINUOUS_LENGTH.
-- * A roll whose remainder drops below the product's remnant threshold becomes
--   a remnant; at zero it is depleted.
-- * Releasing an uncut line puts the metres back on its roll. Once a cut is
--   marked done, the customer can no longer cancel, and a restock creates a new
--   remnant roll for the returned piece.
-- * All writes go through SECURITY DEFINER functions executable by
--   service_role only; admins read through RLS (is_admin()).

-- ---------------------------------------------------------------------------
-- 1. Units and numeric quantities
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sell_unit text NOT NULL DEFAULT 'MTR',
  ADD COLUMN IF NOT EXISTS remnant_threshold_m numeric(10,2) NOT NULL DEFAULT 2.00;
ALTER TABLE public.products
  ADD CONSTRAINT products_sell_unit_check CHECK (sell_unit IN ('MTR', 'PCS')),
  ADD CONSTRAINT products_remnant_threshold_check CHECK (remnant_threshold_m >= 0 AND remnant_threshold_m <= 100);

ALTER TABLE public.product_variants
  ALTER COLUMN stock_quantity TYPE numeric(10,2),
  ALTER COLUMN min_order_quantity TYPE numeric(10,2);
ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_min_order_quantity_check,
  ADD CONSTRAINT product_variants_min_order_quantity_check
    CHECK (min_order_quantity >= 0.5 AND mod(min_order_quantity * 2, 1) = 0),
  ADD COLUMN IF NOT EXISTS max_cut_m numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.order_items
  ALTER COLUMN quantity TYPE numeric(10,2),
  ADD COLUMN IF NOT EXISTS uqc text NOT NULL DEFAULT 'MTR',
  ADD COLUMN IF NOT EXISTS dye_lot text;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_quantity_step CHECK (quantity > 0 AND mod(quantity * 2, 1) = 0),
  ADD CONSTRAINT order_items_uqc_check CHECK (uqc IN ('MTR', 'PCS'));

ALTER TABLE public.order_item_cancellations ALTER COLUMN quantity TYPE numeric(10,2);
ALTER TABLE public.cart_items ALTER COLUMN quantity TYPE numeric(10,2);

UPDATE public.order_items oi
   SET uqc = p.sell_unit
  FROM public.product_variants pv
  JOIN public.products p ON p.id = pv.product_id
 WHERE pv.id = oi.variant_id;

-- The integer-only legacy helper (unused since 0007) would truncate metres.
DROP FUNCTION IF EXISTS public.decrement_inventory_atomic(uuid, integer);

-- ---------------------------------------------------------------------------
-- 2. Rolls, cuts, roll history
-- ---------------------------------------------------------------------------
CREATE TYPE public.roll_status AS ENUM ('active', 'remnant', 'depleted', 'retired');
CREATE TYPE public.cut_status AS ENUM ('allocated', 'cut', 'released');

CREATE SEQUENCE public.fabric_roll_code_seq;

CREATE TABLE public.fabric_rolls (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id         uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  roll_code          text NOT NULL UNIQUE
                       DEFAULT ('R-' || lpad(nextval('public.fabric_roll_code_seq')::text, 6, '0')),
  dye_lot            text NOT NULL DEFAULT 'UNRECORDED',
  shade_note         text,
  total_m            numeric(10,2) NOT NULL,
  remaining_m        numeric(10,2) NOT NULL,
  status             public.roll_status NOT NULL DEFAULT 'active',
  is_opening_balance boolean NOT NULL DEFAULT false,
  parent_roll_id     uuid REFERENCES public.fabric_rolls(id) ON DELETE SET NULL,
  received_at        timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fabric_rolls_code_check CHECK (roll_code ~ '^[A-Z0-9-]{3,40}$'),
  CONSTRAINT fabric_rolls_dye_lot_check CHECK (length(btrim(dye_lot)) BETWEEN 1 AND 60),
  CONSTRAINT fabric_rolls_shade_check CHECK (shade_note IS NULL OR length(shade_note) <= 200),
  CONSTRAINT fabric_rolls_total_check CHECK (total_m > 0 AND total_m <= 10000),
  CONSTRAINT fabric_rolls_remaining_check CHECK (remaining_m >= 0 AND remaining_m <= total_m)
);
CREATE INDEX fabric_rolls_variant_sellable_idx
  ON public.fabric_rolls (variant_id, remaining_m)
  WHERE status IN ('active', 'remnant');
CREATE INDEX fabric_rolls_parent_idx ON public.fabric_rolls (parent_roll_id);

CREATE TABLE public.order_item_cuts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL UNIQUE REFERENCES public.order_items(id) ON DELETE CASCADE,
  order_id      uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  roll_id       uuid REFERENCES public.fabric_rolls(id) ON DELETE SET NULL,
  roll_code     text NOT NULL,
  dye_lot       text NOT NULL,
  length_m      numeric(10,2) NOT NULL,
  status        public.cut_status NOT NULL DEFAULT 'allocated',
  cut_at        timestamptz,
  cut_by        uuid,
  released_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_item_cuts_length_check CHECK (length_m > 0 AND mod(length_m * 2, 1) = 0)
);
CREATE INDEX order_item_cuts_order_idx ON public.order_item_cuts (order_id);
CREATE INDEX order_item_cuts_roll_idx ON public.order_item_cuts (roll_id);
CREATE INDEX order_item_cuts_open_idx ON public.order_item_cuts (roll_id) WHERE status = 'allocated';

CREATE TABLE public.roll_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  roll_id    uuid NOT NULL REFERENCES public.fabric_rolls(id) ON DELETE CASCADE,
  event      text NOT NULL,
  delta_m    numeric(10,2) NOT NULL DEFAULT 0,
  order_id   uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  actor      uuid,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roll_events_event_check CHECK (event IN
    ('received', 'opening_balance', 'allocated', 'released', 'cut', 'stocktake', 'retired', 'returned_piece')),
  CONSTRAINT roll_events_note_check CHECK (note IS NULL OR length(note) <= 500)
);
CREATE INDEX roll_events_roll_idx ON public.roll_events (roll_id, created_at);
CREATE INDEX roll_events_order_idx ON public.roll_events (order_id);

-- ---------------------------------------------------------------------------
-- 3. Triggers: roll status, stock cache, opening balances
-- ---------------------------------------------------------------------------
-- Roll status follows remaining metres (retired stays retired).
CREATE OR REPLACE FUNCTION public.fabric_rolls_set_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_threshold numeric(10,2);
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.variant_id IS DISTINCT FROM OLD.variant_id THEN
    RAISE EXCEPTION 'ROLL_VARIANT_IMMUTABLE';
  END IF;
  NEW.dye_lot := upper(btrim(NEW.dye_lot));
  NEW.updated_at := now();
  IF NEW.status = 'retired' THEN
    RETURN NEW;
  END IF;
  SELECT p.remnant_threshold_m INTO v_threshold
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
   WHERE pv.id = NEW.variant_id;
  NEW.status := CASE
    WHEN NEW.remaining_m = 0 THEN 'depleted'::public.roll_status
    WHEN NEW.remaining_m < COALESCE(v_threshold, 2.00) THEN 'remnant'::public.roll_status
    ELSE 'active'::public.roll_status
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER fabric_rolls_set_status
  BEFORE INSERT OR UPDATE ON public.fabric_rolls
  FOR EACH ROW EXECUTE FUNCTION public.fabric_rolls_set_status();

-- Recompute a variant's cached stock and longest single cut from its rolls.
CREATE OR REPLACE FUNCTION public.sync_variant_roll_stock(p_variant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('mithila.roll_sync', 'on', true);
  UPDATE public.product_variants pv
     SET stock_quantity = s.total,
         max_cut_m = s.longest
    FROM (SELECT COALESCE(sum(r.remaining_m), 0)::numeric(10,2) AS total,
                 COALESCE(max(r.remaining_m), 0)::numeric(10,2) AS longest
            FROM public.fabric_rolls r
           WHERE r.variant_id = p_variant_id
             AND r.status IN ('active', 'remnant')) s
   WHERE pv.id = p_variant_id;
  PERFORM set_config('mithila.roll_sync', 'off', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.fabric_rolls_sync_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.sync_variant_roll_stock(COALESCE(NEW.variant_id, OLD.variant_id));
  RETURN NULL;
END;
$$;

CREATE TRIGGER fabric_rolls_sync_stock
  AFTER INSERT OR UPDATE OR DELETE ON public.fabric_rolls
  FOR EACH ROW EXECUTE FUNCTION public.fabric_rolls_sync_stock();

-- For metre products the cache is owned by the rolls: other writers cannot
-- change it (an admin form or an old code path would otherwise desync it).
CREATE OR REPLACE FUNCTION public.product_variants_guard_roll_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unit text;
BEGIN
  IF current_setting('mithila.roll_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;
  SELECT p.sell_unit INTO v_unit FROM public.products p WHERE p.id = NEW.product_id;
  IF v_unit = 'MTR' AND TG_OP = 'UPDATE' THEN
    NEW.stock_quantity := OLD.stock_quantity;
    NEW.max_cut_m := OLD.max_cut_m;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER product_variants_guard_roll_stock
  BEFORE UPDATE OF stock_quantity, max_cut_m ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.product_variants_guard_roll_stock();

-- A new metre variant created with stock gets an opening-balance roll, so the
-- admin "new product" form keeps working; the owner can split it later.
CREATE OR REPLACE FUNCTION public.product_variants_opening_roll()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unit text;
  v_roll uuid;
BEGIN
  SELECT p.sell_unit INTO v_unit FROM public.products p WHERE p.id = NEW.product_id;
  IF v_unit = 'MTR' AND NEW.stock_quantity > 0 THEN
    INSERT INTO public.fabric_rolls (variant_id, total_m, remaining_m, is_opening_balance)
    VALUES (NEW.id, NEW.stock_quantity, NEW.stock_quantity, true)
    RETURNING id INTO v_roll;
    INSERT INTO public.roll_events (roll_id, event, delta_m, note)
    VALUES (v_roll, 'opening_balance', NEW.stock_quantity, 'Opening balance from variant stock');
  ELSIF v_unit = 'MTR' THEN
    PERFORM public.sync_variant_roll_stock(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER product_variants_opening_roll
  AFTER INSERT ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.product_variants_opening_roll();

-- Switching a product between metre and piece selling.
CREATE OR REPLACE FUNCTION public.products_sell_unit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_variant record;
  v_roll uuid;
BEGIN
  IF NEW.sell_unit = OLD.sell_unit THEN
    RETURN NEW;
  END IF;
  IF NEW.sell_unit = 'PCS' THEN
    IF EXISTS (SELECT 1 FROM public.fabric_rolls r
                 JOIN public.product_variants pv ON pv.id = r.variant_id
                WHERE pv.product_id = NEW.id AND r.status IN ('active', 'remnant')) THEN
      RAISE EXCEPTION 'UNIT_CHANGE_HAS_ROLLS';
    END IF;
    RETURN NEW;
  END IF;
  -- PCS -> MTR: existing piece stock becomes an opening-balance roll.
  FOR v_variant IN
    SELECT pv.id, pv.stock_quantity FROM public.product_variants pv
     WHERE pv.product_id = NEW.id AND pv.stock_quantity > 0
       AND NOT EXISTS (SELECT 1 FROM public.fabric_rolls r WHERE r.variant_id = pv.id)
  LOOP
    INSERT INTO public.fabric_rolls (variant_id, total_m, remaining_m, is_opening_balance)
    VALUES (v_variant.id, v_variant.stock_quantity, v_variant.stock_quantity, true)
    RETURNING id INTO v_roll;
    INSERT INTO public.roll_events (roll_id, event, delta_m, note)
    VALUES (v_roll, 'opening_balance', v_variant.stock_quantity, 'Opening balance on switch to metre selling');
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_sell_unit_change
  AFTER UPDATE OF sell_unit ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_sell_unit_change();

-- Backfill: today's stock on every metre variant becomes one opening roll.
DO $$
DECLARE
  v record;
  v_roll uuid;
BEGIN
  FOR v IN
    SELECT pv.id, pv.stock_quantity
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
     WHERE p.sell_unit = 'MTR'
  LOOP
    IF v.stock_quantity > 0 THEN
      INSERT INTO public.fabric_rolls (variant_id, total_m, remaining_m, is_opening_balance)
      VALUES (v.id, v.stock_quantity, v.stock_quantity, true)
      RETURNING id INTO v_roll;
      INSERT INTO public.roll_events (roll_id, event, delta_m, note)
      VALUES (v_roll, 'opening_balance', v.stock_quantity, 'Opening balance at migration 0050');
    ELSE
      PERFORM public.sync_variant_roll_stock(v.id);
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Releasing a line's stock (internal; no grants)
-- ---------------------------------------------------------------------------
-- Uncut metres go back on their roll; a piece already cut comes back as a new
-- remnant roll of the same dye lot (only when p_restock). Piece products go
-- back to stock_quantity. The caller must already hold the order and item
-- locks; this takes the variant lock before the roll lock (same order as
-- create_order_atomic), so it cannot deadlock against a checkout.
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
  SELECT i.id, i.order_id, i.variant_id, i.quantity, i.uqc
    INTO v_item
    FROM public.order_items i
   WHERE i.id = p_order_item_id;
  IF NOT FOUND OR v_item.variant_id IS NULL THEN
    RETURN false;
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

-- ---------------------------------------------------------------------------
-- 5. create_order_atomic: metres, single-bolt allocation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_user_id uuid, p_items jsonb, p_shipping jsonb, p_shipping_amount numeric,
  p_discount_code text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_order_id uuid;
    v_existing uuid;
    v_item jsonb;
    v_item_id uuid;
    v_variant_id uuid;
    v_quantity numeric(10,2);
    v_raw numeric;
    v_price numeric(10,2);
    v_stock numeric(10,2);
    v_moq numeric(10,2);
    v_gst numeric(5,2);
    v_unit text;
    v_roll record;
    v_line numeric(12,2);
    v_subtotal numeric(12,2) := 0;
    v_tax_raw numeric(14,4) := 0;
    v_tax numeric(10,2) := 0;
    v_ship numeric(10,2);
    v_reduce numeric(10,2) := 0;
    v_total numeric(10,2);
    v_code text;
    v_discount_id uuid;
    v_discount_type public.discount_type;
    v_discount_val numeric(10,2);
    v_min_order numeric(10,2);
    v_max_uses integer;
    v_current_uses integer;
    v_max_per_user integer;
    v_user_uses integer;
    v_open integer;
    v_lapsed integer;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'EMPTY_CART';
    END IF;
    IF jsonb_array_length(p_items) > 100 THEN
        RAISE EXCEPTION 'TOO_MANY_ITEMS';
    END IF;
    IF p_shipping_amount IS NULL OR p_shipping_amount < 0 OR p_shipping_amount > 100000 THEN
        RAISE EXCEPTION 'INVALID_SHIPPING';
    END IF;
    v_ship := round(p_shipping_amount, 2);

    PERFORM pg_advisory_xact_lock(hashtextextended('create_order_atomic:' || p_user_id::text, 0));

    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing FROM public.orders
         WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key LIMIT 1;
        IF v_existing IS NOT NULL THEN
            RETURN v_existing;
        END IF;
    END IF;

    SELECT count(*) INTO v_open
      FROM public.orders o
     WHERE o.user_id = p_user_id
       AND o.status = 'pending'
       AND COALESCE(o.is_paid, false) = false;
    IF v_open >= 3 THEN
        RAISE EXCEPTION 'TOO_MANY_PENDING_ORDERS';
    END IF;

    SELECT count(*) INTO v_lapsed
      FROM public.order_events e
      JOIN public.orders o ON o.id = e.order_id
     WHERE o.user_id = p_user_id
       AND e.event = 'order.payment_timeout'
       AND e.created_at > now() - interval '24 hours';
    IF v_lapsed >= 5 THEN
        RAISE EXCEPTION 'TOO_MANY_UNPAID_ORDERS';
    END IF;

    BEGIN
        INSERT INTO public.orders (user_id, status, subtotal, tax_amount, shipping_amount,
                                   total_amount, shipping_address, idempotency_key)
        VALUES (p_user_id, 'pending', 0, 0, v_ship, 0,
                COALESCE(p_shipping, '{}'::jsonb), p_idempotency_key)
        RETURNING id INTO v_order_id;
    EXCEPTION WHEN unique_violation THEN
        SELECT id INTO v_existing FROM public.orders
         WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key LIMIT 1;
        IF v_existing IS NOT NULL THEN
            RETURN v_existing;
        END IF;
        RAISE;
    END;

    -- Validate every line before taking any lock: a uuid and a positive
    -- quantity in 0.5 steps (whole numbers are checked per unit below).
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        BEGIN
            v_variant_id := (v_item->>'variant_id')::uuid;
            v_raw := (v_item->>'quantity')::numeric;
        EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
            RAISE EXCEPTION 'INVALID_QUANTITY';
        END;
        IF v_variant_id IS NULL OR v_raw IS NULL OR v_raw <= 0 OR v_raw > 10000
           OR mod(v_raw * 2, 1) <> 0 THEN
            RAISE EXCEPTION 'INVALID_QUANTITY';
        END IF;
    END LOOP;

    -- Duplicate lines are merged; variant rows are locked in id order so two
    -- checkouts cannot deadlock. Roll rows are locked after their variant.
    FOR v_variant_id, v_quantity IN
        SELECT (e->>'variant_id')::uuid, sum((e->>'quantity')::numeric)::numeric(10,2)
          FROM jsonb_array_elements(p_items) e
         GROUP BY 1
         ORDER BY 1
    LOOP
        v_price := NULL;
        SELECT pv.price, pv.stock_quantity, COALESCE(pv.min_order_quantity, 1),
               COALESCE(p.gst_rate, 5.00), p.sell_unit
          INTO v_price, v_stock, v_moq, v_gst, v_unit
          FROM public.product_variants pv
          JOIN public.products p ON p.id = pv.product_id
         WHERE pv.id = v_variant_id
           AND p.status = 'active'
           FOR UPDATE OF pv;

        IF v_price IS NULL THEN
            RAISE EXCEPTION 'VARIANT_NOT_FOUND';
        END IF;
        IF v_unit = 'PCS' AND mod(v_quantity, 1) <> 0 THEN
            RAISE EXCEPTION 'INVALID_QUANTITY';
        END IF;
        IF v_quantity < v_moq THEN
            RAISE EXCEPTION 'BELOW_MOQ';
        END IF;
        IF v_stock < v_quantity THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK';
        END IF;

        IF v_unit = 'MTR' THEN
            -- Best fit: the smallest sellable roll that holds the whole length.
            SELECT r.id, r.roll_code, r.dye_lot INTO v_roll
              FROM public.fabric_rolls r
             WHERE r.variant_id = v_variant_id
               AND r.status IN ('active', 'remnant')
               AND r.remaining_m >= v_quantity
             ORDER BY r.remaining_m ASC, r.received_at ASC, r.id
             LIMIT 1
               FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'NO_CONTINUOUS_LENGTH';
            END IF;

            UPDATE public.fabric_rolls
               SET remaining_m = remaining_m - v_quantity
             WHERE id = v_roll.id;

            INSERT INTO public.order_items (order_id, variant_id, quantity, unit_price, uqc, dye_lot)
            VALUES (v_order_id, v_variant_id, v_quantity, v_price, 'MTR', v_roll.dye_lot)
            RETURNING id INTO v_item_id;

            INSERT INTO public.order_item_cuts (order_item_id, order_id, roll_id, roll_code, dye_lot, length_m)
            VALUES (v_item_id, v_order_id, v_roll.id, v_roll.roll_code, v_roll.dye_lot, v_quantity);

            INSERT INTO public.roll_events (roll_id, event, delta_m, order_id)
            VALUES (v_roll.id, 'allocated', -v_quantity, v_order_id);
        ELSE
            UPDATE public.product_variants
               SET stock_quantity = stock_quantity - v_quantity
             WHERE id = v_variant_id;

            INSERT INTO public.order_items (order_id, variant_id, quantity, unit_price, uqc)
            VALUES (v_order_id, v_variant_id, v_quantity, v_price, 'PCS');
        END IF;

        v_line := v_price * v_quantity;
        v_subtotal := v_subtotal + v_line;
        v_tax_raw := v_tax_raw + (v_line * v_gst / 100);
    END LOOP;

    v_code := NULLIF(upper(btrim(COALESCE(p_discount_code, ''))), '');
    IF v_code IS NOT NULL THEN
        SELECT d.id, d.type, d.value, d.min_order_value, d.max_uses,
               COALESCE(d.current_uses, 0), d.max_uses_per_user
          INTO v_discount_id, v_discount_type, v_discount_val, v_min_order, v_max_uses,
               v_current_uses, v_max_per_user
          FROM public.discounts d
         WHERE d.code = v_code
           AND d.is_active = true
           AND (d.starts_at IS NULL OR d.starts_at <= now())
           AND (d.ends_at IS NULL OR d.ends_at > now())
           AND d.target_type = 'all'
           FOR UPDATE;

        IF v_discount_id IS NULL THEN
            RAISE EXCEPTION 'INVALID_DISCOUNT';
        END IF;
        IF v_max_uses IS NOT NULL AND v_current_uses >= v_max_uses THEN
            RAISE EXCEPTION 'INVALID_DISCOUNT';
        END IF;
        IF v_min_order IS NOT NULL AND v_subtotal < v_min_order THEN
            RAISE EXCEPTION 'INVALID_DISCOUNT';
        END IF;
        IF v_max_per_user IS NOT NULL THEN
            SELECT count(*) INTO v_user_uses
              FROM public.orders o
             WHERE o.user_id = p_user_id
               AND o.applied_discount_id = v_discount_id
               AND o.status <> 'cancelled'
               AND o.id <> v_order_id;
            IF v_user_uses >= v_max_per_user THEN
                RAISE EXCEPTION 'INVALID_DISCOUNT';
            END IF;
        END IF;

        IF v_discount_type = 'percentage' THEN
            v_reduce := round(v_subtotal * LEAST(GREATEST(v_discount_val, 0), 100) / 100, 2);
        ELSIF v_discount_type = 'fixed_amount' THEN
            v_reduce := LEAST(GREATEST(v_discount_val, 0), v_subtotal);
        ELSIF v_discount_type = 'free_shipping' THEN
            v_reduce := 0;
            v_ship := 0;
        END IF;

        UPDATE public.discounts
           SET current_uses = COALESCE(current_uses, 0) + 1
         WHERE id = v_discount_id;
    END IF;

    v_tax := round(v_tax_raw, 2);
    v_total := GREATEST(v_subtotal - v_reduce + v_tax + v_ship, 0);

    UPDATE public.orders
       SET subtotal = v_subtotal,
           tax_amount = v_tax,
           shipping_amount = v_ship,
           discount_applied = v_reduce,
           applied_discount_id = v_discount_id,
           total_amount = v_total
     WHERE id = v_order_id;

    RETURN v_order_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Cancellation paths use release_order_item_stock
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_order_restock(p_order_id uuid, p_restock boolean DEFAULT true, p_actor uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_order  record;
  v_item   record;
  v_lines  integer := 0;
  v_units  numeric(12,2) := 0;
BEGIN
  IF p_order_id IS NULL OR p_restock IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ARGUMENT');
  END IF;
  SELECT o.id, o.status, o.applied_discount_id
    INTO v_order
    FROM public.orders o
   WHERE o.id = p_order_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_order.status = 'cancelled'::public.order_status THEN
    RETURN jsonb_build_object('ok', true, 'already_cancelled', true);
  END IF;

  PERFORM 1 FROM public.order_items oi
   WHERE oi.order_id = p_order_id AND oi.status NOT IN ('cancelled', 'refunded')
     FOR UPDATE;
  -- Variant locks in id order before any roll lock.
  PERFORM 1 FROM public.product_variants pv
   WHERE pv.id IN (SELECT oi.variant_id FROM public.order_items oi
                    WHERE oi.order_id = p_order_id AND oi.status NOT IN ('cancelled', 'refunded'))
   ORDER BY pv.id
     FOR UPDATE;

  FOR v_item IN
    SELECT oi.id, oi.quantity FROM public.order_items oi
     WHERE oi.order_id = p_order_id AND oi.status NOT IN ('cancelled', 'refunded')
     ORDER BY oi.variant_id, oi.id
  LOOP
    IF public.release_order_item_stock(v_item.id, p_restock) AND p_restock THEN
      v_units := v_units + v_item.quantity;
    END IF;
  END LOOP;

  UPDATE public.order_items
     SET status = 'cancelled'
   WHERE order_id = p_order_id
     AND status NOT IN ('cancelled', 'refunded');
  GET DIAGNOSTICS v_lines = ROW_COUNT;

  UPDATE public.orders
     SET status = 'cancelled'::public.order_status,
         cancellation_requested = false
   WHERE id = p_order_id;

  IF v_order.applied_discount_id IS NOT NULL THEN
    UPDATE public.discounts
       SET current_uses = GREATEST(COALESCE(current_uses, 0) - 1, 0)
     WHERE id = v_order.applied_discount_id;
  END IF;

  INSERT INTO public.order_events (order_id, event, to_status, note)
  VALUES (
    p_order_id,
    'order.cancelled',
    'cancelled',
    CASE WHEN p_restock
         THEN format('Cancelled by admin; %s line(s) cancelled, %s unit(s) restocked', v_lines, v_units)
         ELSE format('Cancelled by admin; %s line(s) cancelled, no restock (shrinkage)', v_lines)
    END
    || CASE WHEN p_actor IS NOT NULL THEN format(' (by %s)', p_actor) ELSE '' END
  );

  RETURN jsonb_build_object('ok', true, 'lines_cancelled', v_lines, 'units_restocked', v_units);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_expired_pending_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_order record;
    v_item  record;
    v_count integer := 0;
BEGIN
    FOR v_order IN
        SELECT o.id, o.applied_discount_id
          FROM public.orders o
         WHERE o.status = 'pending'
           AND COALESCE(o.is_paid, false) = false
           AND o.created_at < now() - interval '1 hour'
         ORDER BY o.created_at
         LIMIT 500
           FOR UPDATE SKIP LOCKED
    LOOP
        PERFORM 1 FROM public.order_items oi
         WHERE oi.order_id = v_order.id AND oi.status = 'pending'
           FOR UPDATE;
        PERFORM 1 FROM public.product_variants pv
         WHERE pv.id IN (SELECT oi.variant_id FROM public.order_items oi
                          WHERE oi.order_id = v_order.id AND oi.status = 'pending')
         ORDER BY pv.id
           FOR UPDATE;
        FOR v_item IN
            SELECT oi.id FROM public.order_items oi
             WHERE oi.order_id = v_order.id AND oi.status = 'pending'
             ORDER BY oi.variant_id, oi.id
        LOOP
            PERFORM public.release_order_item_stock(v_item.id, true);
        END LOOP;

        UPDATE public.order_items
           SET status = 'cancelled'
         WHERE order_id = v_order.id AND status = 'pending';

        UPDATE public.orders SET status = 'cancelled' WHERE id = v_order.id;

        IF v_order.applied_discount_id IS NOT NULL THEN
            UPDATE public.discounts
               SET current_uses = GREATEST(COALESCE(current_uses, 0) - 1, 0)
             WHERE id = v_order.applied_discount_id;
        END IF;

        INSERT INTO public.order_events (order_id, event, from_status, to_status, note)
        VALUES (v_order.id, 'order.payment_timeout', 'pending', 'cancelled',
                'Cancelled automatically: unpaid after 1 hour. Stock released.');
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$function$;

-- partial_cancel_order_item: same money logic as 0045; stock via the helper.
CREATE OR REPLACE FUNCTION public.partial_cancel_order_item(p_order_id uuid, p_order_item_id uuid, p_restock boolean, p_actor uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  c_warehouse_state constant text := 'Delhi';
  v_order          record;
  v_item           record;
  v_gst            numeric;
  v_line           numeric;
  v_share          numeric;
  v_tax            numeric;
  v_cgst           numeric := 0;
  v_sgst           numeric := 0;
  v_igst           numeric := 0;
  v_refund         numeric;
  v_state          text;
  v_others_active  integer;
  v_restocked      boolean := false;
  v_rows           integer;
BEGIN
  IF p_order_id IS NULL OR p_order_item_id IS NULL OR p_restock IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT';
  END IF;

  SELECT o.id, o.status, o.subtotal, o.tax_amount, o.discount_applied,
         o.total_amount, o.shipping_address
    INTO v_order
    FROM public.orders o
   WHERE o.id = p_order_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  SELECT i.id, i.variant_id, i.quantity, i.unit_price, i.status
    INTO v_item
    FROM public.order_items i
   WHERE i.id = p_order_item_id
     AND i.order_id = p_order_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_ITEM_NOT_FOUND';
  END IF;

  IF v_item.status IN ('cancelled', 'refunded')
     OR EXISTS (SELECT 1 FROM public.order_item_cancellations c
                 WHERE c.order_item_id = p_order_item_id) THEN
    RAISE EXCEPTION 'ITEM_ALREADY_CANCELLED';
  END IF;
  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'ORDER_ALREADY_CANCELLED';
  END IF;

  SELECT COALESCE(p.gst_rate, 5.00)
    INTO v_gst
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
   WHERE pv.id = v_item.variant_id;
  v_gst := COALESCE(v_gst, 5.00);

  v_line := round(v_item.unit_price * v_item.quantity, 2);

  SELECT count(*) INTO v_others_active
    FROM public.order_items i
   WHERE i.order_id = p_order_id
     AND i.id <> p_order_item_id
     AND i.status NOT IN ('cancelled', 'refunded');

  IF v_others_active = 0 THEN
    v_share := GREATEST(v_order.discount_applied, 0);
    v_tax   := GREATEST(v_order.tax_amount, 0);
  ELSE
    IF v_order.subtotal > 0 AND v_order.discount_applied > 0 THEN
      v_share := LEAST(round(v_line * v_order.discount_applied / v_order.subtotal, 2),
                       v_order.discount_applied);
    ELSE
      v_share := 0;
    END IF;
    v_tax := LEAST(round(v_line * v_gst / 100, 2), GREATEST(v_order.tax_amount, 0));
  END IF;

  v_state := COALESCE(NULLIF(btrim(v_order.shipping_address ->> 'state'), ''), c_warehouse_state);
  IF lower(v_state) = lower(c_warehouse_state) THEN
    v_cgst := round(v_tax / 2, 2);
    v_sgst := v_tax - v_cgst;
  ELSE
    v_igst := v_tax;
  END IF;

  v_refund := GREATEST(v_line - v_share, 0) + v_tax;

  BEGIN
    INSERT INTO public.order_item_cancellations
      (order_item_id, order_id, variant_id, quantity, restocked, line_subtotal,
       discount_share, gst_rate, cgst, sgst, igst, tax_refund, refund_amount, cancelled_by)
    VALUES
      (p_order_item_id, p_order_id, v_item.variant_id, v_item.quantity, false, v_line,
       v_share, v_gst, v_cgst, v_sgst, v_igst, v_tax, v_refund, p_actor);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'ITEM_ALREADY_CANCELLED';
  END;

  UPDATE public.order_items
     SET status = 'cancelled'
   WHERE id = p_order_item_id
     AND status NOT IN ('cancelled', 'refunded');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'ITEM_ALREADY_CANCELLED';
  END IF;

  v_restocked := public.release_order_item_stock(p_order_item_id, p_restock) AND p_restock;
  IF v_restocked THEN
    UPDATE public.order_item_cancellations
       SET restocked = true
     WHERE order_item_id = p_order_item_id;
  END IF;

  UPDATE public.orders
     SET subtotal         = GREATEST(subtotal - v_line, 0),
         discount_applied = GREATEST(discount_applied - v_share, 0),
         tax_amount       = GREATEST(tax_amount - v_tax, 0),
         total_amount     = GREATEST(total_amount - v_refund, 0)
   WHERE id = p_order_id;

  INSERT INTO public.order_events (order_id, event, note)
  VALUES (
    p_order_id,
    'order_item.cancelled',
    format('Line item %s cancelled. Refund ₹%s = line ₹%s - discount ₹%s + GST ₹%s (%s%%: CGST ₹%s, SGST ₹%s, IGST ₹%s). %s',
           p_order_item_id,
           to_char(v_refund, 'FM999999990.00'),
           to_char(v_line,   'FM999999990.00'),
           to_char(v_share,  'FM999999990.00'),
           to_char(v_tax,    'FM999999990.00'),
           to_char(v_gst,    'FM990.00'),
           to_char(v_cgst,   'FM999999990.00'),
           to_char(v_sgst,   'FM999999990.00'),
           to_char(v_igst,   'FM999999990.00'),
           CASE WHEN v_restocked THEN 'Restocked.'
                WHEN p_restock   THEN 'Restock requested but variant no longer exists.'
                ELSE 'Not restocked (shrinkage).' END)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'order_item_id', p_order_item_id,
    'line_subtotal', v_line,
    'discount_share', v_share,
    'gst_rate', v_gst,
    'cgst', v_cgst,
    'sgst', v_sgst,
    'igst', v_igst,
    'tax_refund', v_tax,
    'refund_amount', v_refund,
    'restocked', v_restocked
  );
END;
$function$;

-- Cut boundary: once any length is cut the customer can no longer cancel.
CREATE OR REPLACE FUNCTION public.request_order_cancellation(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  o     record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  END IF;
  SELECT ord.id, ord.user_id, ord.status, ord.cancellation_requested
    INTO o
    FROM public.orders ord
   WHERE ord.id = p_order_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF o.user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF o.status NOT IN ('pending'::public.order_status, 'paid'::public.order_status) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_CANCELLABLE');
  END IF;
  IF EXISTS (SELECT 1 FROM public.order_item_cuts c
              WHERE c.order_id = p_order_id AND c.status = 'cut') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_CUT');
  END IF;
  IF o.cancellation_requested THEN
    RETURN jsonb_build_object('ok', true);
  END IF;
  UPDATE public.orders SET cancellation_requested = true WHERE id = p_order_id;
  INSERT INTO public.order_events (order_id, event, note)
  VALUES (p_order_id, 'cancellation.requested', 'Customer requested cancellation');
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- adjust_stock is for piece products only; metres are managed per roll.
DROP FUNCTION IF EXISTS public.adjust_stock(uuid, integer);
CREATE FUNCTION public.adjust_stock(p_variant_id uuid, p_delta integer)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new  numeric(10,2);
  v_unit text;
BEGIN
  IF p_variant_id IS NULL OR p_delta IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT' USING ERRCODE = '22023';
  END IF;
  IF p_delta = 0 OR abs(p_delta) > 100000 THEN
    RAISE EXCEPTION 'INVALID_DELTA' USING ERRCODE = '22023';
  END IF;
  SELECT p.sell_unit INTO v_unit
    FROM public.product_variants pv JOIN public.products p ON p.id = pv.product_id
   WHERE pv.id = p_variant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VARIANT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_unit = 'MTR' THEN
    RAISE EXCEPTION 'USE_ROLLS' USING ERRCODE = '22023';
  END IF;
  UPDATE public.product_variants
     SET stock_quantity = GREATEST(0, stock_quantity + p_delta)
   WHERE id = p_variant_id
  RETURNING stock_quantity INTO v_new;
  RETURN v_new;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Admin roll operations (service_role only; the app calls requireAdmin())
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_receive_roll(
  p_variant_id uuid, p_total_m numeric, p_dye_lot text, p_shade_note text DEFAULT NULL, p_actor uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unit text;
  v_roll uuid;
BEGIN
  IF p_total_m IS NULL OR p_total_m <= 0 OR p_total_m > 10000 OR round(p_total_m, 2) <> p_total_m THEN
    RAISE EXCEPTION 'INVALID_LENGTH';
  END IF;
  SELECT p.sell_unit INTO v_unit
    FROM public.product_variants pv JOIN public.products p ON p.id = pv.product_id
   WHERE pv.id = p_variant_id
     FOR UPDATE OF pv;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VARIANT_NOT_FOUND';
  END IF;
  IF v_unit <> 'MTR' THEN
    RAISE EXCEPTION 'NOT_METRE_PRODUCT';
  END IF;
  INSERT INTO public.fabric_rolls (variant_id, total_m, remaining_m, dye_lot, shade_note)
  VALUES (p_variant_id, p_total_m, p_total_m,
          COALESCE(NULLIF(btrim(p_dye_lot), ''), 'UNRECORDED'),
          NULLIF(btrim(COALESCE(p_shade_note, '')), ''))
  RETURNING id INTO v_roll;
  INSERT INTO public.roll_events (roll_id, event, delta_m, actor)
  VALUES (v_roll, 'received', p_total_m, p_actor);
  RETURN v_roll;
END;
$$;

-- Stocktake: set what is physically left on a roll (allocated-but-uncut
-- metres are already off remaining_m, so they are not counted here).
CREATE OR REPLACE FUNCTION public.admin_set_roll_remaining(
  p_roll_id uuid, p_remaining_m numeric, p_note text DEFAULT NULL, p_actor uuid DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_variant uuid;
  v_old     numeric(10,2);
  v_total   numeric(10,2);
BEGIN
  IF p_remaining_m IS NULL OR p_remaining_m < 0 OR round(p_remaining_m, 2) <> p_remaining_m THEN
    RAISE EXCEPTION 'INVALID_LENGTH';
  END IF;
  SELECT r.variant_id INTO v_variant FROM public.fabric_rolls r WHERE r.id = p_roll_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROLL_NOT_FOUND';
  END IF;
  PERFORM 1 FROM public.product_variants pv WHERE pv.id = v_variant FOR UPDATE;
  SELECT r.remaining_m, r.total_m INTO v_old, v_total
    FROM public.fabric_rolls r WHERE r.id = p_roll_id FOR UPDATE;
  IF p_remaining_m > v_total THEN
    RAISE EXCEPTION 'EXCEEDS_ROLL_LENGTH';
  END IF;
  UPDATE public.fabric_rolls SET remaining_m = p_remaining_m WHERE id = p_roll_id;
  INSERT INTO public.roll_events (roll_id, event, delta_m, actor, note)
  VALUES (p_roll_id, 'stocktake', p_remaining_m - v_old, p_actor, left(p_note, 500));
  RETURN p_remaining_m;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_retire_roll(p_roll_id uuid, p_note text DEFAULT NULL, p_actor uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_variant uuid;
BEGIN
  SELECT r.variant_id INTO v_variant FROM public.fabric_rolls r WHERE r.id = p_roll_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROLL_NOT_FOUND';
  END IF;
  PERFORM 1 FROM public.product_variants pv WHERE pv.id = v_variant FOR UPDATE;
  PERFORM 1 FROM public.fabric_rolls r WHERE r.id = p_roll_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.order_item_cuts c WHERE c.roll_id = p_roll_id AND c.status = 'allocated') THEN
    RAISE EXCEPTION 'ROLL_HAS_OPEN_CUTS';
  END IF;
  UPDATE public.fabric_rolls SET status = 'retired' WHERE id = p_roll_id;
  INSERT INTO public.roll_events (roll_id, event, actor, note)
  VALUES (p_roll_id, 'retired', p_actor, left(p_note, 500));
END;
$$;

-- Cut sheet: mark a paid line as physically cut from its roll.
CREATE OR REPLACE FUNCTION public.mark_order_item_cut(p_cut_id uuid, p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cut   record;
  v_paid  boolean;
  v_state public.order_status;
BEGIN
  SELECT c.* INTO v_cut FROM public.order_item_cuts c WHERE c.id = p_cut_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CUT_NOT_FOUND';
  END IF;
  IF v_cut.status = 'cut' THEN
    RETURN jsonb_build_object('ok', true, 'already_cut', true);
  END IF;
  IF v_cut.status <> 'allocated' THEN
    RAISE EXCEPTION 'CUT_RELEASED';
  END IF;
  SELECT COALESCE(o.is_paid, false), o.status INTO v_paid, v_state
    FROM public.orders o WHERE o.id = v_cut.order_id FOR UPDATE;
  IF NOT v_paid OR v_state = 'cancelled' THEN
    RAISE EXCEPTION 'ORDER_NOT_PAID';
  END IF;
  UPDATE public.order_item_cuts
     SET status = 'cut', cut_at = now(), cut_by = p_actor
   WHERE id = p_cut_id;
  IF v_cut.roll_id IS NOT NULL THEN
    INSERT INTO public.roll_events (roll_id, event, delta_m, order_id, actor)
    VALUES (v_cut.roll_id, 'cut', 0, v_cut.order_id, p_actor);
  END IF;
  INSERT INTO public.order_events (order_id, event, note)
  VALUES (v_cut.order_id, 'order_item.cut',
          format('%s m cut from roll %s (dye lot %s)', v_cut.length_m, v_cut.roll_code, v_cut.dye_lot));
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Available / reserved / committed per roll (D5-1)
-- ---------------------------------------------------------------------------
CREATE VIEW public.fabric_roll_stock
WITH (security_invoker = on) AS
SELECT r.id AS roll_id,
       r.variant_id,
       r.roll_code,
       r.dye_lot,
       r.shade_note,
       r.status,
       r.total_m,
       r.remaining_m AS available_m,
       COALESCE(sum(c.length_m) FILTER (WHERE c.status = 'allocated' AND NOT COALESCE(o.is_paid, false)), 0)::numeric(10,2) AS reserved_m,
       COALESCE(sum(c.length_m) FILTER (WHERE c.status = 'allocated' AND COALESCE(o.is_paid, false)), 0)::numeric(10,2) AS committed_m,
       COALESCE(sum(c.length_m) FILTER (WHERE c.status = 'cut'), 0)::numeric(10,2) AS cut_m,
       r.is_opening_balance,
       r.received_at
  FROM public.fabric_rolls r
  LEFT JOIN public.order_item_cuts c ON c.roll_id = r.id
  LEFT JOIN public.orders o ON o.id = c.order_id
 GROUP BY r.id;

-- ---------------------------------------------------------------------------
-- 9. RLS and grants
-- ---------------------------------------------------------------------------
ALTER TABLE public.fabric_rolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_cuts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roll_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.fabric_rolls, public.order_item_cuts, public.roll_events, public.fabric_roll_stock
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fabric_rolls, public.order_item_cuts, public.roll_events, public.fabric_roll_stock
  TO authenticated;
GRANT ALL ON public.fabric_rolls, public.order_item_cuts, public.roll_events, public.fabric_roll_stock
  TO service_role;
REVOKE ALL ON SEQUENCE public.fabric_roll_code_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SEQUENCE public.fabric_roll_code_seq TO service_role;

CREATE POLICY fabric_rolls_admin_read ON public.fabric_rolls
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY order_item_cuts_admin_read ON public.order_item_cuts
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY roll_events_admin_read ON public.roll_events
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.fabric_rolls_set_status()',
    'public.sync_variant_roll_stock(uuid)',
    'public.fabric_rolls_sync_stock()',
    'public.product_variants_guard_roll_stock()',
    'public.product_variants_opening_roll()',
    'public.products_sell_unit_change()',
    'public.release_order_item_stock(uuid, boolean)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f);
  END LOOP;

  FOREACH f IN ARRAY ARRAY[
    'public.create_order_atomic(uuid, jsonb, jsonb, numeric, text, text)',
    'public.cancel_order_restock(uuid, boolean, uuid)',
    'public.cancel_expired_pending_orders()',
    'public.partial_cancel_order_item(uuid, uuid, boolean, uuid)',
    'public.adjust_stock(uuid, integer)',
    'public.admin_receive_roll(uuid, numeric, text, text, uuid)',
    'public.admin_set_roll_remaining(uuid, numeric, text, uuid)',
    'public.admin_retire_roll(uuid, text, uuid)',
    'public.mark_order_item_cut(uuid, uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;

  -- Customers call this one themselves (it checks auth.uid()).
  REVOKE ALL ON FUNCTION public.request_order_cancellation(uuid) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.request_order_cancellation(uuid) TO authenticated, service_role;
END;
$$;
