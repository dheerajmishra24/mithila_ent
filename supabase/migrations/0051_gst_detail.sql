-- 0051: GST detail (Phase 2).
--
-- * products.hsn_code; GST 2.0 rate per line: Chapters 50-60 (fabrics, sarees,
--   unstitched material) flat 5%; Chapters 61-62 (stitched apparel) 5% up to
--   Rs 2,500 per piece and 18% above; anything else falls back to
--   products.gst_rate. The CA should confirm HSN codes (Ch. 59 technical
--   fabrics, trims).
-- * Every order line stores its HSN, rate, discount share, taxable value and
--   CGST/SGST/IGST. Tax is charged on the value after discount, and place of
--   supply is the delivery state's GST code (not a free-text compare).
-- * Sequential financial-year invoice numbers (Rule 46(b): unique, <= 16
--   chars), issued when an order is paid or shipped.
-- * profiles.customer_code: a permanent human-readable customer ID.
-- * gst_outward_summary / gst_hsn_summary feed the GST liability report.

-- ---------------------------------------------------------------------------
-- 1. Supplier settings (one row) and state codes
-- ---------------------------------------------------------------------------
CREATE TABLE public.gst_settings (
  id                  smallint PRIMARY KEY DEFAULT 1,
  legal_name          text NOT NULL,
  supplier_gstin      text NOT NULL,
  supplier_state_code text NOT NULL,
  address             text NOT NULL,
  invoice_prefix      text NOT NULL,
  aato_above_5cr      boolean NOT NULL DEFAULT false,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gst_settings_singleton CHECK (id = 1),
  CONSTRAINT gst_settings_gstin_check CHECK (supplier_gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  CONSTRAINT gst_settings_state_check CHECK (supplier_state_code = left(supplier_gstin, 2)),
  CONSTRAINT gst_settings_prefix_check CHECK (invoice_prefix ~ '^[A-Z0-9]{1,4}$'),
  CONSTRAINT gst_settings_address_check CHECK (length(btrim(address)) BETWEEN 5 AND 300)
);
INSERT INTO public.gst_settings (legal_name, supplier_gstin, supplier_state_code, address, invoice_prefix)
VALUES ('Mithila Enterprises', '07AGUPM2548P1ZH', '07', 'Delhi, India', 'MITH');

CREATE TABLE public.gst_state_aliases (
  alias text PRIMARY KEY,
  code  text NOT NULL CHECK (code ~ '^[0-9]{2}$')
);
INSERT INTO public.gst_state_aliases (code, alias) VALUES
  ('01', 'jammu and kashmir'),
  ('01', 'jammu kashmir'),
  ('01', 'j&k'),
  ('01', 'jk'),
  ('02', 'himachal pradesh'),
  ('02', 'hp'),
  ('03', 'punjab'),
  ('03', 'pb'),
  ('04', 'chandigarh'),
  ('04', 'ch'),
  ('05', 'uttarakhand'),
  ('05', 'uttaranchal'),
  ('05', 'uk'),
  ('06', 'haryana'),
  ('06', 'hr'),
  ('07', 'delhi'),
  ('07', 'new delhi'),
  ('07', 'nct of delhi'),
  ('07', 'national capital territory of delhi'),
  ('07', 'dl'),
  ('08', 'rajasthan'),
  ('08', 'rj'),
  ('09', 'uttar pradesh'),
  ('09', 'up'),
  ('10', 'bihar'),
  ('10', 'br'),
  ('11', 'sikkim'),
  ('11', 'sk'),
  ('12', 'arunachal pradesh'),
  ('12', 'ar'),
  ('13', 'nagaland'),
  ('13', 'nl'),
  ('14', 'manipur'),
  ('14', 'mn'),
  ('15', 'mizoram'),
  ('15', 'mz'),
  ('16', 'tripura'),
  ('16', 'tr'),
  ('17', 'meghalaya'),
  ('17', 'ml'),
  ('18', 'assam'),
  ('18', 'as'),
  ('19', 'west bengal'),
  ('19', 'wb'),
  ('20', 'jharkhand'),
  ('20', 'jh'),
  ('21', 'odisha'),
  ('21', 'orissa'),
  ('21', 'od'),
  ('21', 'or'),
  ('22', 'chhattisgarh'),
  ('22', 'chattisgarh'),
  ('22', 'cg'),
  ('23', 'madhya pradesh'),
  ('23', 'mp'),
  ('24', 'gujarat'),
  ('24', 'gj'),
  ('26', 'dadra and nagar haveli and daman and diu'),
  ('26', 'dadra and nagar haveli'),
  ('26', 'daman and diu'),
  ('26', 'dnh'),
  ('26', 'dd'),
  ('27', 'maharashtra'),
  ('27', 'mh'),
  ('29', 'karnataka'),
  ('29', 'ka'),
  ('30', 'goa'),
  ('30', 'ga'),
  ('31', 'lakshadweep'),
  ('31', 'ld'),
  ('32', 'kerala'),
  ('32', 'kl'),
  ('33', 'tamil nadu'),
  ('33', 'tn'),
  ('34', 'puducherry'),
  ('34', 'pondicherry'),
  ('34', 'py'),
  ('35', 'andaman and nicobar islands'),
  ('35', 'andaman and nicobar'),
  ('35', 'an'),
  ('36', 'telangana'),
  ('36', 'ts'),
  ('36', 'tg'),
  ('37', 'andhra pradesh'),
  ('37', 'ap'),
  ('38', 'ladakh'),
  ('38', 'la');

-- 2-digit GST state code for a state name, abbreviation or code; NULL if
-- unknown. Mirrors gstStateCode() in src/lib/gst.ts.
CREATE OR REPLACE FUNCTION public.gst_state_code(p_state text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_raw  text := btrim(COALESCE(p_state, ''));
  v_norm text;
  v_code text;
BEGIN
  IF v_raw = '' THEN
    RETURN NULL;
  END IF;
  IF v_raw ~ '^[0-9]{1,2}$' THEN
    v_code := lpad(v_raw, 2, '0');
    RETURN (SELECT a.code FROM public.gst_state_aliases a WHERE a.code = v_code LIMIT 1);
  END IF;
  IF lower(v_raw) = 'j&k' THEN
    RETURN '01';
  END IF;
  v_norm := btrim(regexp_replace(regexp_replace(replace(lower(v_raw), '&', ' and '), '[^a-z0-9 ]+', ' ', 'g'), '\s+', ' ', 'g'));
  RETURN (SELECT a.code FROM public.gst_state_aliases a WHERE a.alias = v_norm);
END;
$$;

-- GST 2.0 rate for one line (CGST + SGST or IGST total), given the taxable
-- value per unit after discount.
CREATE OR REPLACE FUNCTION public.gst_rate_for(p_hsn text, p_unit_value numeric, p_fallback numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_hsn IS NULL OR p_hsn !~ '^[0-9]{4}' THEN COALESCE(p_fallback, 5.00)
    WHEN left(p_hsn, 2) IN ('61', '62') THEN CASE WHEN p_unit_value <= 2500 THEN 5.00 ELSE 18.00 END
    WHEN left(p_hsn, 2)::int BETWEEN 50 AND 60 THEN 5.00
    ELSE COALESCE(p_fallback, 5.00)
  END::numeric(5,2);
$$;

-- ---------------------------------------------------------------------------
-- 2. Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN hsn_code text,
  ADD CONSTRAINT products_hsn_check CHECK (hsn_code IS NULL OR hsn_code ~ '^[0-9]{4}([0-9]{2}){0,2}$');

ALTER TABLE public.order_items
  ADD COLUMN hsn_code       text,
  ADD COLUMN gst_rate       numeric(5,2),
  ADD COLUMN discount_share numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN taxable_value  numeric(12,2),
  ADD COLUMN cgst           numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN sgst           numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN igst           numeric(10,2) NOT NULL DEFAULT 0,
  ADD CONSTRAINT order_items_tax_check CHECK (cgst >= 0 AND sgst >= 0 AND igst >= 0 AND discount_share >= 0
                                              AND (cgst + sgst = 0 OR igst = 0));

ALTER TABLE public.orders
  ADD COLUMN place_of_supply text,
  ADD COLUMN buyer_gstin     text,
  ADD COLUMN taxable_value   numeric(12,2),
  ADD COLUMN cgst_total      numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN sgst_total      numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN igst_total      numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN invoice_number  text UNIQUE,
  ADD COLUMN invoice_date    timestamptz,
  ADD CONSTRAINT orders_pos_check CHECK (place_of_supply IS NULL OR place_of_supply ~ '^[0-9]{2}$'),
  ADD CONSTRAINT orders_buyer_gstin_check CHECK (buyer_gstin IS NULL OR buyer_gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  ADD CONSTRAINT orders_invoice_number_check CHECK (invoice_number IS NULL OR (length(invoice_number) <= 16 AND invoice_number ~ '^[A-Z0-9/-]+$'));
CREATE INDEX orders_invoice_date_idx ON public.orders (invoice_date) WHERE invoice_date IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Per-line GST for an order (internal; called by create_order_atomic)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_order_gst(p_order_id uuid, p_discount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order    record;
  v_supplier text;
  v_pos      text;
  v_intra    boolean;
  v_gstin    text;
  v_sub      numeric(12,2);
  v_disc     numeric(12,2) := GREATEST(COALESCE(p_discount, 0), 0);
  v_left     numeric(12,2);
  v_n        integer;
  v_i        integer := 0;
  v_it       record;
  v_line     numeric(12,2);
  v_share    numeric(12,2);
  v_taxable  numeric(12,2);
  v_rate     numeric(5,2);
  v_tax      numeric(10,2);
  v_c        numeric(10,2);
  v_s        numeric(10,2);
  v_g        numeric(10,2);
  v_tt       numeric(12,2) := 0;
  v_ct       numeric(10,2) := 0;
  v_st       numeric(10,2) := 0;
  v_gt       numeric(10,2) := 0;
BEGIN
  SELECT o.id, o.shipping_address INTO v_order FROM public.orders o WHERE o.id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;
  SELECT s.supplier_state_code INTO v_supplier FROM public.gst_settings s WHERE s.id = 1;
  v_pos := public.gst_state_code(v_order.shipping_address ->> 'state');
  IF v_pos IS NULL THEN
    RAISE EXCEPTION 'INVALID_STATE';
  END IF;
  v_intra := v_pos = v_supplier;

  v_gstin := NULLIF(upper(btrim(COALESCE(v_order.shipping_address ->> 'gstin', ''))), '');
  IF v_gstin IS NOT NULL AND v_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' THEN
    RAISE EXCEPTION 'INVALID_GSTIN';
  END IF;

  SELECT COALESCE(sum(round(i.unit_price * i.quantity, 2)), 0), count(*)
    INTO v_sub, v_n
    FROM public.order_items i WHERE i.order_id = p_order_id;
  v_disc := LEAST(v_disc, v_sub);
  v_left := v_disc;

  FOR v_it IN
    SELECT i.id, i.quantity, i.unit_price, p.hsn_code, p.gst_rate
      FROM public.order_items i
      JOIN public.product_variants pv ON pv.id = i.variant_id
      JOIN public.products p ON p.id = pv.product_id
     WHERE i.order_id = p_order_id
     ORDER BY i.id
  LOOP
    v_i := v_i + 1;
    v_line := round(v_it.unit_price * v_it.quantity, 2);
    -- Pro-rata discount; the last line takes the rounding remainder.
    IF v_i = v_n THEN
      v_share := v_left;
    ELSIF v_sub > 0 THEN
      v_share := LEAST(round(v_line * v_disc / v_sub, 2), v_left);
    ELSE
      v_share := 0;
    END IF;
    v_left := v_left - v_share;
    v_taxable := GREATEST(v_line - v_share, 0);
    v_rate := public.gst_rate_for(v_it.hsn_code, v_taxable / NULLIF(v_it.quantity, 0), v_it.gst_rate);
    v_tax := round(v_taxable * v_rate / 100, 2);
    IF v_intra THEN
      v_c := round(v_tax / 2, 2);
      v_s := v_tax - v_c;
      v_g := 0;
    ELSE
      v_c := 0; v_s := 0; v_g := v_tax;
    END IF;
    UPDATE public.order_items
       SET hsn_code = v_it.hsn_code, gst_rate = v_rate, discount_share = v_share,
           taxable_value = v_taxable, cgst = v_c, sgst = v_s, igst = v_g
     WHERE id = v_it.id;
    v_tt := v_tt + v_taxable;
    v_ct := v_ct + v_c;
    v_st := v_st + v_s;
    v_gt := v_gt + v_g;
  END LOOP;

  UPDATE public.orders
     SET place_of_supply = v_pos, buyer_gstin = v_gstin, taxable_value = v_tt,
         cgst_total = v_ct, sgst_total = v_st, igst_total = v_gt
   WHERE id = p_order_id;
  RETURN v_ct + v_st + v_gt;
END;
$$;

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
    v_unit text;
    v_roll record;
    v_line numeric(12,2);
    v_subtotal numeric(12,2) := 0;
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
        SELECT pv.price, pv.stock_quantity, COALESCE(pv.min_order_quantity, 1), p.sell_unit
          INTO v_price, v_stock, v_moq, v_unit
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

    -- GST per line on the value after discount, split by place of supply.
    v_tax := public.apply_order_gst(v_order_id, v_reduce);
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

CREATE OR REPLACE FUNCTION public.partial_cancel_order_item(p_order_id uuid, p_order_item_id uuid, p_restock boolean, p_actor uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
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
  v_intra          boolean;
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

  SELECT i.id, i.variant_id, i.quantity, i.unit_price, i.status,
         i.gst_rate, i.discount_share, i.taxable_value, i.cgst, i.sgst, i.igst
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

  v_line := round(v_item.unit_price * v_item.quantity, 2);

  IF v_item.taxable_value IS NOT NULL THEN
    -- Orders from migration 0051 carry their own per-line GST snapshot,
    -- so the refund mirrors exactly what was invoiced for this line.
    v_gst   := v_item.gst_rate;
    v_share := v_item.discount_share;
    v_cgst  := v_item.cgst;
    v_sgst  := v_item.sgst;
    v_igst  := v_item.igst;
    v_tax   := v_cgst + v_sgst + v_igst;
  ELSE
    -- Older orders: recompute as before, with the state-code place of supply.
    SELECT COALESCE(p.gst_rate, 5.00)
      INTO v_gst
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
     WHERE pv.id = v_item.variant_id;
    v_gst := COALESCE(v_gst, 5.00);


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

    v_intra := public.gst_state_code(v_order.shipping_address ->> 'state')
               = (SELECT s.supplier_state_code FROM public.gst_settings s WHERE s.id = 1);
    IF v_intra THEN
      v_cgst := round(v_tax / 2, 2);
      v_sgst := v_tax - v_cgst;
    ELSE
      v_igst := v_tax;
    END IF;
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
         taxable_value    = CASE WHEN taxable_value IS NULL THEN NULL
                                 ELSE GREATEST(taxable_value - GREATEST(v_line - v_share, 0), 0) END,
         cgst_total       = GREATEST(cgst_total - v_cgst, 0),
         sgst_total       = GREATEST(sgst_total - v_sgst, 0),
         igst_total       = GREATEST(igst_total - v_igst, 0),
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

-- ---------------------------------------------------------------------------
-- 4. Invoice numbers: PREFIX/YYYY/NNNNNN per Indian financial year (Apr-Mar)
-- ---------------------------------------------------------------------------
CREATE TABLE public.invoice_counters (
  fy      text PRIMARY KEY CHECK (fy ~ '^[0-9]{4}$'),
  last_no integer NOT NULL DEFAULT 0 CHECK (last_no >= 0 AND last_no <= 999999)
);

CREATE OR REPLACE FUNCTION public.orders_assign_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now    timestamp := (now() AT TIME ZONE 'Asia/Kolkata');
  v_start  integer;
  v_fy     text;
  v_no     integer;
  v_prefix text;
BEGIN
  IF NEW.invoice_number IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NOT (COALESCE(NEW.is_paid, false) OR NEW.status IN ('shipped', 'delivered')) THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;
  v_start := CASE WHEN extract(month FROM v_now) >= 4 THEN extract(year FROM v_now)::int
                  ELSE extract(year FROM v_now)::int - 1 END;
  v_fy := lpad((v_start % 100)::text, 2, '0') || lpad(((v_start + 1) % 100)::text, 2, '0');
  INSERT INTO public.invoice_counters AS c (fy, last_no) VALUES (v_fy, 1)
  ON CONFLICT (fy) DO UPDATE SET last_no = c.last_no + 1
  RETURNING c.last_no INTO v_no;
  SELECT s.invoice_prefix INTO v_prefix FROM public.gst_settings s WHERE s.id = 1;
  NEW.invoice_number := v_prefix || '/' || v_fy || '/' || lpad(v_no::text, 6, '0');
  NEW.invoice_date := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_assign_invoice_number
  BEFORE UPDATE OF is_paid, status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_assign_invoice_number();

-- Invoice numbers are permanent once issued.
CREATE OR REPLACE FUNCTION public.orders_invoice_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.invoice_number IS NOT NULL AND NEW.invoice_number IS DISTINCT FROM OLD.invoice_number THEN
    RAISE EXCEPTION 'INVOICE_NUMBER_IMMUTABLE';
  END IF;
  IF OLD.invoice_date IS NOT NULL AND NEW.invoice_date IS DISTINCT FROM OLD.invoice_date THEN
    RAISE EXCEPTION 'INVOICE_NUMBER_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER orders_invoice_immutable
  BEFORE UPDATE OF invoice_number, invoice_date ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_invoice_immutable();

-- ---------------------------------------------------------------------------
-- 5. Customer ID: MTH-000001, permanent
-- ---------------------------------------------------------------------------
CREATE SEQUENCE public.customer_code_seq;
ALTER TABLE public.profiles ADD COLUMN customer_code text;
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS n FROM public.profiles
)
UPDATE public.profiles p
   SET customer_code = 'MTH-' || lpad(o.n::text, 6, '0')
  FROM ordered o
 WHERE o.id = p.id;
SELECT setval('public.customer_code_seq', GREATEST((SELECT count(*) FROM public.profiles), 1),
              (SELECT count(*) FROM public.profiles) > 0);
ALTER TABLE public.profiles
  ALTER COLUMN customer_code SET DEFAULT ('MTH-' || lpad(nextval('public.customer_code_seq')::text, 6, '0')),
  ALTER COLUMN customer_code SET NOT NULL,
  ADD CONSTRAINT profiles_customer_code_key UNIQUE (customer_code),
  ADD CONSTRAINT profiles_customer_code_check CHECK (customer_code ~ '^MTH-[0-9]{6,}$');

CREATE OR REPLACE FUNCTION public.profiles_customer_code_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.customer_code := OLD.customer_code;
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_customer_code_immutable
  BEFORE UPDATE OF customer_code ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_customer_code_immutable();

-- ---------------------------------------------------------------------------
-- 6. GST liability report (service_role only; the admin page calls it)
-- ---------------------------------------------------------------------------
-- Outward supplies by place of supply and rate, on invoices dated in the
-- period, minus lines cancelled after their invoice (credit-note candidates).
CREATE OR REPLACE FUNCTION public.gst_outward_summary(p_from date, p_to date)
RETURNS TABLE (kind text, place_of_supply text, gst_rate numeric, invoices bigint,
               taxable_value numeric, cgst numeric, sgst numeric, igst numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH bounds AS (
    SELECT (p_from::timestamp AT TIME ZONE 'Asia/Kolkata') AS t0,
           ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Kolkata') AS t1
  ),
  supplies AS (
    SELECT 'supply'::text AS kind, o.place_of_supply, i.gst_rate, o.id AS order_id,
           i.taxable_value, i.cgst, i.sgst, i.igst
      FROM public.orders o
      JOIN public.order_items i ON i.order_id = o.id
      CROSS JOIN bounds b
     WHERE o.invoice_date >= b.t0 AND o.invoice_date < b.t1
       AND i.taxable_value IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.order_item_cancellations c
                        WHERE c.order_item_id = i.id AND c.created_at <= o.invoice_date)
  ),
  adjustments AS (
    SELECT 'cancelled_after_invoice'::text, o.place_of_supply, c.gst_rate, o.id,
           -(c.line_subtotal - c.discount_share), -c.cgst, -c.sgst, -c.igst
      FROM public.order_item_cancellations c
      JOIN public.orders o ON o.id = c.order_id
      CROSS JOIN bounds b
     WHERE c.created_at >= b.t0 AND c.created_at < b.t1
       AND o.invoice_date IS NOT NULL AND c.created_at > o.invoice_date
  )
  SELECT kind, place_of_supply, gst_rate, count(DISTINCT order_id),
         sum(taxable_value)::numeric(14,2), sum(cgst)::numeric(14,2),
         sum(sgst)::numeric(14,2), sum(igst)::numeric(14,2)
    FROM (SELECT * FROM supplies UNION ALL SELECT * FROM adjustments) x
   GROUP BY kind, place_of_supply, gst_rate
   ORDER BY kind DESC, place_of_supply, gst_rate;
$$;

-- HSN-wise summary (GSTR-1 Table 12) for the same period.
CREATE OR REPLACE FUNCTION public.gst_hsn_summary(p_from date, p_to date)
RETURNS TABLE (hsn_code text, uqc text, gst_rate numeric, quantity numeric,
               taxable_value numeric, cgst numeric, sgst numeric, igst numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(i.hsn_code, 'MISSING'), i.uqc, i.gst_rate, sum(i.quantity)::numeric(14,2),
         sum(i.taxable_value)::numeric(14,2), sum(i.cgst)::numeric(14,2),
         sum(i.sgst)::numeric(14,2), sum(i.igst)::numeric(14,2)
    FROM public.orders o
    JOIN public.order_items i ON i.order_id = o.id
   WHERE o.invoice_date >= (p_from::timestamp AT TIME ZONE 'Asia/Kolkata')
     AND o.invoice_date < ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')
     AND i.taxable_value IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.order_item_cancellations c
                      WHERE c.order_item_id = i.id AND c.created_at <= o.invoice_date)
   GROUP BY 1, 2, 3
   ORDER BY 1, 2, 3;
$$;

-- ---------------------------------------------------------------------------
-- 7. RLS and grants
-- ---------------------------------------------------------------------------
ALTER TABLE public.gst_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gst_state_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.gst_settings, public.gst_state_aliases, public.invoice_counters FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.gst_settings TO authenticated;
GRANT ALL ON public.gst_settings, public.gst_state_aliases, public.invoice_counters TO service_role;
REVOKE ALL ON SEQUENCE public.customer_code_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SEQUENCE public.customer_code_seq TO service_role, supabase_auth_admin;

CREATE POLICY gst_settings_admin_read ON public.gst_settings
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.apply_order_gst(uuid, numeric)',
    'public.orders_assign_invoice_number()',
    'public.orders_invoice_immutable()',
    'public.profiles_customer_code_immutable()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f);
  END LOOP;

  FOREACH f IN ARRAY ARRAY[
    'public.gst_outward_summary(date, date)',
    'public.gst_hsn_summary(date, date)',
    'public.create_order_atomic(uuid, jsonb, jsonb, numeric, text, text)',
    'public.partial_cancel_order_item(uuid, uuid, boolean, uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;

  -- Pure lookups, safe for anyone.
  -- gst_state_code reads gst_state_aliases, which only definer functions see.
  REVOKE ALL ON FUNCTION public.gst_state_code(text) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.gst_state_code(text) TO service_role;
  REVOKE ALL ON FUNCTION public.gst_rate_for(text, numeric, numeric) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.gst_rate_for(text, numeric, numeric) TO authenticated, service_role;
END;
$$;
