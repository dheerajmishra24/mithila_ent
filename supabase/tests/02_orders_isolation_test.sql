-- Orders, order items, payments and order events: 4 personas.
-- customer_a owns order OA, customer_b owns order OB, owner_admin is admin.
-- Positive reads run first so an empty table can never produce a false pass.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(24);

CREATE FUNCTION pg_temp.act_as(p_role text, p_sub uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role, 'aal', 'aal2', 'session_id', gen_random_uuid(), 'amr', json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint)))::text, true);
  PERFORM set_config('role', p_role, true);
END $$;

CREATE FUNCTION pg_temp.attempt(p_sql text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n || ' rows';
EXCEPTION WHEN insufficient_privilege THEN
  RETURN 'denied';
END $$;

-- Fixtures (as postgres)
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'customer-a@example.test'),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'customer-b@example.test'),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'owner@example.test');
INSERT INTO public.user_roles (user_id, role) VALUES ('33333333-3333-4333-8333-333333333333', 'admin');

INSERT INTO public.orders (id, user_id, status, subtotal, total_amount, shipping_address) VALUES
  ('a0000000-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', 'pending', 1000, 1050, '{"city":"A"}'),
  ('b0000000-0000-4000-8000-00000000000b', '22222222-2222-4222-8222-222222222222', 'pending', 2000, 2100, '{"city":"B"}');
INSERT INTO public.order_items (order_id, quantity, unit_price) VALUES
  ('a0000000-0000-4000-8000-00000000000a', 2, 500),
  ('b0000000-0000-4000-8000-00000000000b', 4, 500);
INSERT INTO public.payments (order_id, provider, amount, currency, status) VALUES
  ('a0000000-0000-4000-8000-00000000000a', 'test', 1050, 'INR', 'created'),
  ('b0000000-0000-4000-8000-00000000000b', 'test', 2100, 'INR', 'created');

-- customer_a: own rows visible (positive first)
SELECT pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111111');
SELECT is((SELECT count(*) FROM public.orders), 1::bigint, 'customer_a sees exactly 1 order (own)');
SELECT is((SELECT count(*) FROM public.order_items), 1::bigint, 'customer_a sees own order items only');
SELECT is((SELECT count(*) FROM public.payments), 1::bigint, 'customer_a sees own payments only');
SELECT ok((SELECT count(*) FROM public.order_events
            WHERE order_id = 'a0000000-0000-4000-8000-00000000000a') > 0,
          'customer_a sees own order events');

-- customer_a cannot forge or reprice orders
SELECT throws_ok(
  $$INSERT INTO public.orders (user_id, subtotal, total_amount, shipping_address)
    VALUES ('11111111-1111-4111-8111-111111111111', 1, 1, '{}')$$,
  '42501', NULL, 'customer_a cannot insert orders directly');
SELECT ok(pg_temp.attempt(
  $$UPDATE public.orders SET total_amount = 1, status = 'paid'
     WHERE id = 'a0000000-0000-4000-8000-00000000000a'$$) IN ('denied', '0 rows'),
  'customer_a UPDATE of own order changes nothing');
SELECT is(public.request_order_cancellation('b0000000-0000-4000-8000-00000000000b') ->> 'error',
          'FORBIDDEN', 'customer_a cannot request cancellation of customer_b''s order');
RESET ROLE;
SELECT is((SELECT total_amount FROM public.orders WHERE id = 'a0000000-0000-4000-8000-00000000000a'),
          1050::numeric, 'customer_a''s own order total is unchanged');

-- customer_b: horizontal attacker against customer_a
SELECT pg_temp.act_as('authenticated', '22222222-2222-4222-8222-222222222222');
SELECT is((SELECT count(*) FROM public.orders WHERE id = 'a0000000-0000-4000-8000-00000000000a'),
          0::bigint, 'customer_b cannot read customer_a''s order');
SELECT is((SELECT count(*) FROM public.order_items WHERE order_id = 'a0000000-0000-4000-8000-00000000000a'),
          0::bigint, 'customer_b cannot read customer_a''s order items');
SELECT is((SELECT count(*) FROM public.payments WHERE order_id = 'a0000000-0000-4000-8000-00000000000a'),
          0::bigint, 'customer_b cannot read customer_a''s payments');
SELECT is((SELECT count(*) FROM public.order_events WHERE order_id = 'a0000000-0000-4000-8000-00000000000a'),
          0::bigint, 'customer_b cannot read customer_a''s order events');
SELECT ok(pg_temp.attempt(
  $$UPDATE public.orders SET status = 'cancelled' WHERE id = 'a0000000-0000-4000-8000-00000000000a'$$) IN ('denied', '0 rows'),
  'customer_b UPDATE of customer_a''s order changes nothing');
SELECT ok(pg_temp.attempt(
  $$DELETE FROM public.payments WHERE order_id = 'a0000000-0000-4000-8000-00000000000a'$$) IN ('denied', '0 rows'),
  'customer_b DELETE of customer_a''s payments changes nothing');
RESET ROLE;
SELECT is((SELECT status::text FROM public.orders WHERE id = 'a0000000-0000-4000-8000-00000000000a'),
          'pending', 'customer_a''s order status is unchanged after customer_b''s UPDATE');
SELECT is((SELECT count(*) FROM public.payments WHERE order_id = 'a0000000-0000-4000-8000-00000000000a'),
          1::bigint, 'customer_a''s payment survives customer_b''s DELETE');

-- anon: no order data at all
SELECT pg_temp.act_as('anon');
SELECT is((SELECT count(*) FROM public.orders), 0::bigint, 'anon sees no orders');
SELECT is((SELECT count(*) FROM public.payments), 0::bigint, 'anon sees no payments');
SELECT throws_ok(
  $$SELECT public.request_order_cancellation('a0000000-0000-4000-8000-00000000000a')$$,
  '42501', NULL, 'anon cannot call request_order_cancellation');
RESET ROLE;

-- owner_admin: full CRM visibility
SELECT pg_temp.act_as('authenticated', '33333333-3333-4333-8333-333333333333');
SELECT is((SELECT count(*) FROM public.orders WHERE id IN ('a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-00000000000b')), 2::bigint, 'owner_admin sees every customer order (scoped to fixtures: other suites share the local DB)');
SELECT is((SELECT count(*) FROM public.payments WHERE order_id IN ('a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-00000000000b')), 2::bigint, 'owner_admin sees every customer payment');
RESET ROLE;

-- TRUNCATE bypasses RLS entirely, so the privilege itself must be absent.
SELECT pg_temp.act_as('anon');
SELECT throws_ok($$TRUNCATE public.payments$$, '42501', NULL, 'anon cannot TRUNCATE payments');
RESET ROLE;
SELECT pg_temp.act_as('authenticated', '22222222-2222-4222-8222-222222222222');
SELECT throws_ok($$TRUNCATE public.order_events$$, '42501', NULL, 'customer_b cannot TRUNCATE order_events');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.payments WHERE order_id IN ('a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-00000000000b')), 2::bigint, 'payments intact after TRUNCATE attempts');

SELECT * FROM finish();
ROLLBACK;
