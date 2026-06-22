-- Make record_payment idempotent: the verify callback AND the webhook can both
-- fire for the same capture. Dedupe by (provider_payment_id, status).
CREATE OR REPLACE FUNCTION record_payment(
  p_order_id UUID,
  p_provider TEXT,
  p_provider_payment_id TEXT,
  p_amount NUMERIC,
  p_status TEXT DEFAULT 'captured',
  p_method TEXT DEFAULT NULL,
  p_currency TEXT DEFAULT 'INR',
  p_raw JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = p_order_id) THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  -- Idempotency: same gateway payment id + status already recorded.
  IF p_provider_payment_id IS NOT NULL THEN
    SELECT id INTO v_payment_id FROM payments
     WHERE provider_payment_id = p_provider_payment_id
       AND status = p_status::payment_status
     LIMIT 1;
    IF FOUND THEN
      RETURN v_payment_id;
    END IF;
  END IF;

  INSERT INTO payments (order_id, provider, provider_payment_id, amount, currency, status, method, raw)
  VALUES (p_order_id, p_provider, p_provider_payment_id, p_amount, p_currency, p_status::payment_status, p_method, p_raw)
  RETURNING id INTO v_payment_id;

  IF p_status = 'captured' THEN
    UPDATE orders
       SET is_paid = true,
           status = CASE WHEN status = 'pending' THEN 'paid'::order_status ELSE status END,
           payment_intent_id = COALESCE(p_provider_payment_id, payment_intent_id)
     WHERE id = p_order_id;
  ELSIF p_status = 'failed' THEN
    INSERT INTO order_events (order_id, event, note)
    VALUES (p_order_id, 'payment.failed', COALESCE(p_provider, 'gateway') || ' payment failed');
  ELSIF p_status = 'refunded' THEN
    INSERT INTO order_events (order_id, event, note)
    VALUES (p_order_id, 'payment.refunded', 'Payment refunded');
  END IF;

  RETURN v_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION record_payment(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_payment(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB) TO service_role;
