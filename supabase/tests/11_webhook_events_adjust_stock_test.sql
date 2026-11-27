-- Migration 0048: webhook_events (SEC-07) and adjust_stock (SEC-08).
-- Run: npx supabase test db   (local Docker stack only, never production)
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(16);

CREATE FUNCTION pg_temp.act_as(p_role text, p_sub uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role, 'aal', 'aal2', 'session_id', gen_random_uuid(), 'amr', json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint)))::text, true);
  PERFORM set_config('role', p_role, true);
END $$;

-- Fixture: one product with one variant holding 10 units.
INSERT INTO public.categories (id, name, slug)
VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'Test cat', 'test-cat-0048');
INSERT INTO public.products (id, category_id, slug, title, status, sell_unit)
VALUES ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'test-prod-0048', 'Test', 'active', 'PCS');
INSERT INTO public.product_variants (id, product_id, sku, color, price, stock_quantity)
VALUES ('aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000002', 'T-0048', 'Indigo', 100, 10);

-- ---------------------------------------------------------------------------
-- webhook_events
-- ---------------------------------------------------------------------------
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.webhook_events'::regclass), 'webhook_events has RLS on');
SELECT ok(NOT has_table_privilege('anon', 'public.webhook_events', 'SELECT')
          AND NOT has_table_privilege('authenticated', 'public.webhook_events', 'SELECT')
          AND NOT has_table_privilege('authenticated', 'public.webhook_events', 'INSERT')
          AND NOT has_table_privilege('authenticated', 'public.webhook_events', 'TRUNCATE'),
          'anon and authenticated have no access to webhook_events');
SELECT ok(has_table_privilege('service_role', 'public.webhook_events', 'INSERT')
          AND has_table_privilege('service_role', 'public.webhook_events', 'UPDATE'),
          'service_role can store and update events');

INSERT INTO public.webhook_events (provider, event_id, event_type, payload)
VALUES ('razorpay', 'evt_1', 'payment.captured', '{}');
SELECT throws_ok(
  $$INSERT INTO public.webhook_events (provider, event_id, event_type, payload) VALUES ('razorpay', 'evt_1', 'payment.captured', '{}')$$,
  '23505', NULL, 'the same event id cannot be stored twice');
INSERT INTO public.webhook_events (provider, event_id, event_type, payload)
VALUES ('razorpay', 'evt_1', 'payment.captured', '{}')
ON CONFLICT (provider, event_id) DO NOTHING;
SELECT is((SELECT count(*)::int FROM public.webhook_events WHERE event_id = 'evt_1'), 1,
          'a repeated delivery with ON CONFLICT DO NOTHING keeps one row');
SELECT throws_ok(
  $$INSERT INTO public.webhook_events (provider, event_id, event_type, payload) VALUES ('razorpay', '', 'x', '{}')$$,
  '23514', NULL, 'an empty event id is rejected');

-- ---------------------------------------------------------------------------
-- adjust_stock
-- ---------------------------------------------------------------------------
SELECT ok(NOT has_function_privilege('authenticated', 'public.adjust_stock(uuid, integer)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.adjust_stock(uuid, integer)', 'EXECUTE'),
          'adjust_stock is not callable by anon or authenticated');
SELECT ok(has_function_privilege('service_role', 'public.adjust_stock(uuid, integer)', 'EXECUTE'),
          'service_role can call adjust_stock');
SELECT is((SELECT proconfig FROM pg_proc WHERE oid = 'public.adjust_stock(uuid, integer)'::regprocedure),
          ARRAY['search_path=""'], 'adjust_stock pins an empty search_path');

SELECT is(public.adjust_stock('aaaaaaaa-0000-4000-8000-000000000003', 5)::integer, 15, '+5 on 10 gives 15');

-- A concurrent order decrement between an admin read and write used to be lost.
-- With one UPDATE the two changes compose: simulate the order's -3 first.
UPDATE public.product_variants SET stock_quantity = stock_quantity - 3
 WHERE id = 'aaaaaaaa-0000-4000-8000-000000000003';
SELECT is(public.adjust_stock('aaaaaaaa-0000-4000-8000-000000000003', 2)::integer, 14,
          'adjust_stock adds to the current value (15 - 3 + 2), not to a stale read');

SELECT is(public.adjust_stock('aaaaaaaa-0000-4000-8000-000000000003', -100)::integer, 0, 'stock never goes below zero');
SELECT throws_ok($$SELECT public.adjust_stock('aaaaaaaa-0000-4000-8000-000000000003', 0)$$,
                 '22023', NULL, 'a zero delta is rejected');
SELECT throws_ok($$SELECT public.adjust_stock('aaaaaaaa-0000-4000-8000-000000000003', 1000000)$$,
                 '22023', NULL, 'an out-of-range delta is rejected');
SELECT throws_ok($$SELECT public.adjust_stock('aaaaaaaa-0000-4000-8000-0000000000ff', 1)$$,
                 'P0002', NULL, 'an unknown variant is reported');

SELECT pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111111');
SELECT throws_ok($$SELECT public.adjust_stock('aaaaaaaa-0000-4000-8000-000000000003', 1)$$,
                 '42501', NULL, 'a signed-in customer cannot call adjust_stock');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
