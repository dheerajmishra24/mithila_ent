-- Order cancellation: customer requests, admin cancels + restocks inventory.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_requested BOOLEAN DEFAULT false;

-- Customer requests cancellation of their OWN order (only while pending/paid).
CREATE OR REPLACE FUNCTION request_order_cancellation(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  o RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT id, user_id, status, cancellation_requested INTO o FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF o.user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF o.status NOT IN ('pending', 'paid') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_CANCELLABLE');
  END IF;
  IF o.cancellation_requested THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  UPDATE orders SET cancellation_requested = true WHERE id = p_order_id;
  INSERT INTO order_events (order_id, event, note)
  VALUES (p_order_id, 'cancellation.requested', 'Customer requested cancellation');

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION request_order_cancellation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_order_cancellation(UUID) TO authenticated;

-- Admin cancels an order: restock each line item, mark cancelled (atomic).
CREATE OR REPLACE FUNCTION cancel_order_restock(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o RECORD;
  it RECORD;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT id, status INTO o FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF o.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  FOR it IN SELECT variant_id, quantity FROM order_items WHERE order_id = p_order_id AND variant_id IS NOT NULL
  LOOP
    UPDATE product_variants SET stock_quantity = stock_quantity + it.quantity WHERE id = it.variant_id;
  END LOOP;

  UPDATE orders SET status = 'cancelled', cancellation_requested = false WHERE id = p_order_id;
  INSERT INTO order_events (order_id, event, note)
  VALUES (p_order_id, 'order.cancelled', 'Cancelled by admin; inventory restocked');

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION cancel_order_restock(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_order_restock(UUID) TO authenticated;
