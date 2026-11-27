-- Migration 0046 (RLS-05): rewritten SECURITY DEFINER functions.
--   cancel_order_restock: works for the service role, restocks only active
--     lines, idempotent, shrinkage path, grants.
--   record_payment: UNIQUE idempotency key, single side effect.
--   handle_new_user: every sign-up is retail.
--   SEC-05 / SEC-06 CHECK constraints.
-- Run: npx supabase test db   (local Docker stack only, never production)
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(27);

CREATE FUNCTION pg_temp.act_as(p_role text, p_sub uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role, 'aal', 'aal2', 'session_id', gen_random_uuid(), 'amr', json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint)))::text, true);
  PERFORM set_config('role', p_role, true);
END $$;

-- Fixtures (as postgres)
INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'customer-a@example.test', '{"full_name":"Customer A"}');

INSERT INTO public.products (id, slug, title, status, gst_rate) VALUES
  ('d9000000-0000-4000-8000-000000000001', 'pgtap-def-silk', 'pgTAP Def Silk', 'active', 5.00);
INSERT INTO public.product_variants (id, product_id, sku, color, price, stock_quantity) VALUES
  ('e9000000-0000-4000-8000-000000000001', 'd9000000-0000-4000-8000-000000000001', 'PGTAP-DEF-1', 'Ivory', 1000, 10),
  ('e9000000-0000-4000-8000-000000000002', 'd9000000-0000-4000-8000-000000000001', 'PGTAP-DEF-2', 'Rose',   500, 20);

-- O1: two lines, will be partially then fully cancelled with restock.
-- O2: one line, cancelled without restock (shrinkage).
-- O3: payment idempotency.
INSERT INTO public.orders (id, user_id, status, subtotal, discount_applied, tax_amount,
                           shipping_amount, total_amount, shipping_address) VALUES
  ('a9000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'paid',
   4000, 0, 200, 0, 4200, '{"state":"Delhi","pinCode":"110001"}'),
  ('a9000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'paid',
   1000, 0, 50, 0, 1050, '{"state":"Delhi"}'),
  ('a9000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'pending',
   1000, 0, 50, 0, 1050, '{}');
INSERT INTO public.order_items (id, order_id, variant_id, quantity, unit_price) VALUES
  ('f9000000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000001', 2, 1000),
  ('f9000000-0000-4000-8000-000000000002', 'a9000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000002', 4, 500),
  ('f9000000-0000-4000-8000-000000000003', 'a9000000-0000-4000-8000-000000000002', 'e9000000-0000-4000-8000-000000000001', 1, 1000);

-- ---------------------------------------------------------------------------
-- Shape and grants
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT array_agg(p.oid::regprocedure::text ORDER BY 1)
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('checkout_processor', 'process_logistics_order')),
  NULL, 'unused checkout_processor and process_logistics_order are dropped');
SELECT ok(to_regprocedure('public.cancel_order_restock(uuid)') IS NULL,
          'old 1-arg cancel_order_restock is gone');
SELECT ok(NOT has_function_privilege('anon', 'public.cancel_order_restock(uuid, boolean, uuid)', 'EXECUTE'),
          'anon has no EXECUTE on cancel_order_restock');
SELECT ok(NOT has_function_privilege('authenticated', 'public.cancel_order_restock(uuid, boolean, uuid)', 'EXECUTE'),
          'authenticated has no EXECUTE on cancel_order_restock');
SELECT ok(NOT has_function_privilege('authenticated', 'public.record_payment(uuid, text, text, numeric, text, text, text, jsonb)', 'EXECUTE'),
          'authenticated has no EXECUTE on record_payment');
SELECT ok(has_function_privilege('authenticated', 'public.request_order_cancellation(uuid)', 'EXECUTE'),
          'authenticated keeps EXECUTE on request_order_cancellation');

-- ---------------------------------------------------------------------------
-- cancel_order_restock
-- ---------------------------------------------------------------------------
-- Partial-cancel line 2 (4 x variant 2) with restock first: stock 20 -> 24.
SELECT pg_temp.act_as('service_role');
SELECT public.partial_cancel_order_item('a9000000-0000-4000-8000-000000000001',
                                        'f9000000-0000-4000-8000-000000000002', true, NULL);
RESET ROLE;
SELECT is((SELECT stock_quantity::integer FROM public.product_variants WHERE id = 'e9000000-0000-4000-8000-000000000002'),
          24, 'partial cancel restocked line 2 (20 -> 24)');

-- Full cancel as service_role (used to return FORBIDDEN).
SELECT pg_temp.act_as('service_role');
CREATE TEMP TABLE c1 AS SELECT public.cancel_order_restock('a9000000-0000-4000-8000-000000000001', true, NULL) AS j;
RESET ROLE;
SELECT is((SELECT (j->>'ok')::boolean FROM c1), true, 'service_role can cancel with restock (was FORBIDDEN)');
SELECT is((SELECT stock_quantity::integer FROM public.product_variants WHERE id = 'e9000000-0000-4000-8000-000000000001'),
          12, 'active line 1 restocked (10 -> 12)');
SELECT is((SELECT stock_quantity::integer FROM public.product_variants WHERE id = 'e9000000-0000-4000-8000-000000000002'),
          24, 'line 2, already cancelled, is NOT restocked a second time');
SELECT is((SELECT (j->>'lines_cancelled')::int FROM c1), 1, 'only the one active line was cancelled');
SELECT is((SELECT status::text FROM public.orders WHERE id = 'a9000000-0000-4000-8000-000000000001'),
          'cancelled', 'order is cancelled');
SELECT is((SELECT count(*)::int FROM public.order_events
            WHERE order_id = 'a9000000-0000-4000-8000-000000000001' AND event = 'order.cancelled'),
          1, 'one order.cancelled event');

-- Second call: idempotent.
SELECT pg_temp.act_as('service_role');
CREATE TEMP TABLE c2 AS SELECT public.cancel_order_restock('a9000000-0000-4000-8000-000000000001', true, NULL) AS j;
RESET ROLE;
SELECT is((SELECT (j->>'already_cancelled')::boolean FROM c2), true, 'second cancel reports already_cancelled');
SELECT is((SELECT stock_quantity::integer FROM public.product_variants WHERE id = 'e9000000-0000-4000-8000-000000000001'),
          12, 'second cancel does not restock again');
SELECT is((SELECT count(*)::int FROM public.order_events
            WHERE order_id = 'a9000000-0000-4000-8000-000000000001' AND event = 'order.cancelled'),
          1, 'second cancel logs no second event');

-- Shrinkage path: no restock.
SELECT pg_temp.act_as('service_role');
SELECT public.cancel_order_restock('a9000000-0000-4000-8000-000000000002', false, NULL);
RESET ROLE;
SELECT is((SELECT stock_quantity::integer FROM public.product_variants WHERE id = 'e9000000-0000-4000-8000-000000000001'),
          12, 'shrinkage cancel leaves stock unchanged');
SELECT is((SELECT status FROM public.order_items WHERE id = 'f9000000-0000-4000-8000-000000000003'),
          'cancelled', 'shrinkage cancel cancels the line');

-- Direct call by a customer is refused.
SELECT pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111111');
SELECT throws_ok($$SELECT public.cancel_order_restock('a9000000-0000-4000-8000-000000000003', true, NULL)$$,
  '42501', NULL, 'customer cannot call cancel_order_restock');
RESET ROLE;

-- ---------------------------------------------------------------------------
-- record_payment idempotency
-- ---------------------------------------------------------------------------
SELECT pg_temp.act_as('service_role');
CREATE TEMP TABLE p1 AS SELECT public.record_payment('a9000000-0000-4000-8000-000000000003', 'razorpay', 'pay_pgtap_1', 1050) AS id;
CREATE TEMP TABLE p2 AS SELECT public.record_payment('a9000000-0000-4000-8000-000000000003', 'razorpay', 'pay_pgtap_1', 1050) AS id;
RESET ROLE;
SELECT is((SELECT id FROM p2), (SELECT id FROM p1), 'repeat capture returns the same payment id');
SELECT is((SELECT count(*)::int FROM public.payments WHERE provider_payment_id = 'pay_pgtap_1'),
          1, 'repeat capture inserts no second row');
SELECT is((SELECT count(*)::int FROM public.order_events
            WHERE order_id = 'a9000000-0000-4000-8000-000000000003' AND event = 'order.paid'),
          1, 'one order.paid event');
SELECT throws_ok(
  $$INSERT INTO public.payments (order_id, provider, provider_payment_id, amount, currency, status)
    VALUES ('a9000000-0000-4000-8000-000000000003', 'razorpay', 'pay_pgtap_1', 1050, 'INR', 'captured')$$,
  '23505', NULL, 'UNIQUE key rejects a duplicate captured row even outside the function');

-- ---------------------------------------------------------------------------
-- handle_new_user
-- ---------------------------------------------------------------------------
SELECT is((SELECT role::text FROM public.profiles WHERE id = '11111111-1111-4111-8111-111111111111'),
          'retail', 'new sign-up gets retail');
SELECT ok(position('@' IN pg_get_functiondef('public.handle_new_user()'::regprocedure)) = 0,
          'handle_new_user contains no e-mail address');

-- ---------------------------------------------------------------------------
-- SEC-05 / SEC-06 constraints
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  $$UPDATE public.orders SET shipping_address = '{"pinCode":"110001&weight=0.1#"}'
     WHERE id = 'a9000000-0000-4000-8000-000000000003'$$,
  '23514', NULL, 'orders reject a malformed pinCode');
SELECT throws_ok(
  $$INSERT INTO public.contact_inquiries (first_name, last_name, email, message)
    VALUES ('A', 'B', 'a@example.test', repeat('x', 5001))$$,
  '23514', NULL, 'contact_inquiries reject a message over 5000 chars');

SELECT * FROM finish();
ROLLBACK;
