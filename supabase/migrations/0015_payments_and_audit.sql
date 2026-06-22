-- Payments + order audit log: every order lifecycle change and every payment is
-- recorded in the database.

-- Payment lifecycle status.
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('created', 'authorized', 'captured', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Append-only payment audit trail.
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL DEFAULT 'pending',
  provider_payment_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status payment_status NOT NULL DEFAULT 'created',
  method TEXT,
  raw JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_payment_id ON payments(provider_payment_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own payments" ON payments;
CREATE POLICY "Users view own payments" ON payments
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE auth.uid() = user_id) OR is_admin()
  );
-- No INSERT/UPDATE policy: payments are written only by SECURITY DEFINER functions.

-- Order lifecycle audit log.
CREATE TABLE IF NOT EXISTS order_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  event TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);

ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own order events" ON order_events;
CREATE POLICY "Users view own order events" ON order_events
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE auth.uid() = user_id) OR is_admin()
  );

-- Auto-log order creation, status changes, payment flag and tracking updates.
CREATE OR REPLACE FUNCTION log_order_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO order_events (order_id, event, to_status, note)
    VALUES (NEW.id, 'order.created', NEW.status::text, 'Order placed');
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO order_events (order_id, event, from_status, to_status)
      VALUES (NEW.id, 'order.status_changed', OLD.status::text, NEW.status::text);
    END IF;
    IF NEW.is_paid IS DISTINCT FROM OLD.is_paid AND NEW.is_paid THEN
      INSERT INTO order_events (order_id, event, to_status, note)
      VALUES (NEW.id, 'order.paid', NEW.status::text, 'Payment captured');
    END IF;
    IF NEW.tracking_status IS DISTINCT FROM OLD.tracking_status AND NEW.tracking_status IS NOT NULL THEN
      INSERT INTO order_events (order_id, event, note)
      VALUES (NEW.id, 'order.tracking_updated', 'Tracking: ' || NEW.tracking_status);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_order_event ON orders;
CREATE TRIGGER trg_log_order_event
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_event();

-- Log a payment "intent" for an order the caller owns (called right after checkout).
CREATE OR REPLACE FUNCTION log_payment_intent(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_total NUMERIC(10,2);
  v_owner UUID;
  v_payment_id UUID;
BEGIN
  SELECT total_amount, user_id INTO v_total, v_owner FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_owner IS DISTINCT FROM v_user_id THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT id INTO v_payment_id FROM payments
   WHERE order_id = p_order_id AND status = 'created' LIMIT 1;
  IF FOUND THEN
    RETURN v_payment_id;
  END IF;

  INSERT INTO payments (order_id, provider, amount, currency, status)
  VALUES (p_order_id, 'pending', v_total, 'INR', 'created')
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION log_payment_intent(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_payment_intent(UUID) TO authenticated;

-- Record a payment result (called from the payment-gateway webhook). Marks the
-- order paid on capture. Server-side only.
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
