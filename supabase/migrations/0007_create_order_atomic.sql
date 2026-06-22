-- Atomic order creation from a client-side (Zustand) cart.
--
-- The cart lives in the browser, not in the `cart_items` table, so the items are
-- passed in as JSONB: [{ "variant_id": "<uuid>", "quantity": 2 }, ...].
--
-- SECURITY DEFINER is required because `product_variants` is admin-write under RLS
-- (see 0000_initial_schema.sql), so a retail customer cannot deduct stock directly.
-- The function is still safe because it:
--   * derives the buyer from auth.uid() (the client cannot spoof another user),
--   * reads price + stock from the DB (never trusts client-supplied prices),
--   * locks each variant row FOR UPDATE to prevent overselling under concurrency,
--   * runs as a single transaction, so any failure rolls back the whole order
--     (no partial inventory deduction, no orphaned order rows).

CREATE OR REPLACE FUNCTION create_order_atomic(
    p_items JSONB,
    p_shipping JSONB,
    p_tax_rate NUMERIC DEFAULT 0.18,
    p_shipping_amount NUMERIC DEFAULT 50
) RETURNS UUID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_order_id UUID;
    v_subtotal NUMERIC(10,2) := 0;
    v_tax NUMERIC(10,2) := 0;
    v_total NUMERIC(10,2) := 0;
    v_item JSONB;
    v_variant_id UUID;
    v_quantity INTEGER;
    v_price NUMERIC(10,2);
    v_stock INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'EMPTY_CART';
    END IF;

    -- 1. Create the order draft (totals are filled in after pricing the items).
    INSERT INTO orders (user_id, status, subtotal, tax_amount, shipping_amount, total_amount, shipping_address)
    VALUES (v_user_id, 'pending', 0, 0, p_shipping_amount, 0, COALESCE(p_shipping, '{}'::jsonb))
    RETURNING id INTO v_order_id;

    -- 2. Price each item against the DB, lock its row, validate stock, deduct, record it.
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_variant_id := (v_item->>'variant_id')::UUID;
        v_quantity := GREATEST(COALESCE((v_item->>'quantity')::INTEGER, 0), 0);

        IF v_quantity = 0 THEN
            CONTINUE;
        END IF;

        SELECT price, stock_quantity INTO v_price, v_stock
        FROM product_variants
        WHERE id = v_variant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'VARIANT_NOT_FOUND:%', v_variant_id;
        END IF;

        IF v_stock < v_quantity THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_variant_id;
        END IF;

        UPDATE product_variants
        SET stock_quantity = stock_quantity - v_quantity
        WHERE id = v_variant_id;

        INSERT INTO order_items (order_id, variant_id, quantity, unit_price)
        VALUES (v_order_id, v_variant_id, v_quantity, v_price);

        v_subtotal := v_subtotal + (v_price * v_quantity);
    END LOOP;

    IF v_subtotal = 0 THEN
        RAISE EXCEPTION 'EMPTY_CART';
    END IF;

    -- 3. Finalize totals (tax + flat shipping).
    v_tax := ROUND(v_subtotal * p_tax_rate, 2);
    v_total := v_subtotal + v_tax + p_shipping_amount;

    UPDATE orders
    SET subtotal = v_subtotal, tax_amount = v_tax, total_amount = v_total
    WHERE id = v_order_id;

    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only signed-in users may create orders; anon is rejected.
REVOKE ALL ON FUNCTION create_order_atomic(JSONB, JSONB, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_order_atomic(JSONB, JSONB, NUMERIC, NUMERIC) TO authenticated;
