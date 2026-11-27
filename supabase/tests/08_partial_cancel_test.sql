-- partial_cancel_order_item (migration 0045): refund arithmetic, idempotency,
-- restock, and that only service_role can EXECUTE it.
-- Run: npx supabase test db   (local Docker stack only, never production)
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(32);

CREATE FUNCTION pg_temp.act_as(p_role text, p_sub uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role, 'aal', 'aal2', 'session_id', gen_random_uuid(), 'amr', json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint)))::text, true);
  PERFORM set_config('role', p_role, true);
END $$;

-- Fixtures (as postgres)
INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'customer-a@example.test'),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'owner@example.test');
INSERT INTO public.user_roles (user_id, role) VALUES ('33333333-3333-4333-8333-333333333333', 'admin');

INSERT INTO public.products (id, slug, title, status, gst_rate) VALUES
  ('d1000000-0000-4000-8000-000000000001', 'pgtap-pc-silk',   'pgTAP Silk (5%)',   'active', 5.00),
  ('d2000000-0000-4000-8000-000000000002', 'pgtap-pc-kurta',  'pgTAP Kurta (12%)', 'active', 12.00);
INSERT INTO public.product_variants (id, product_id, sku, color, price, stock_quantity) VALUES
  ('e1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'PGTAP-PC-1', 'Ivory', 1000, 10),
  ('e2000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000002', 'PGTAP-PC-2', 'Ivory', 500, 20);

-- O1, intra-state (Delhi): 2 x 1000 @5% + 4 x 500 @12%, 10% coupon, 100 shipping.
--   subtotal 4000, discount 400, tax 100 + 240 = 340, total 4000 - 400 + 340 + 100 = 4040
-- O2, inter-state (Maharashtra): 1 x 1000 @5% + 1 x 500 @12%, fixed 100 coupon.
--   subtotal 1500, discount 100, tax 50 + 60 = 110, total 1510
INSERT INTO public.orders (id, user_id, status, subtotal, discount_applied, tax_amount,
                           shipping_amount, total_amount, shipping_address) VALUES
  ('a0000000-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', 'paid',
   4000, 400, 340, 100, 4040, '{"state":"Delhi"}'),
  ('a0000000-0000-4000-8000-00000000000b', '11111111-1111-4111-8111-111111111111', 'paid',
   1500, 100, 110, 0, 1510, '{"state":"Maharashtra"}');
INSERT INTO public.order_items (id, order_id, variant_id, quantity, unit_price) VALUES
  ('f1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 2, 1000),
  ('f2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a', 'e2000000-0000-4000-8000-000000000002', 4, 500),
  ('f3000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-00000000000b', 'e1000000-0000-4000-8000-000000000001', 1, 1000),
  ('f4000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-00000000000b', 'e2000000-0000-4000-8000-000000000002', 1, 500);

-- ---------------------------------------------------------------------------
-- Function shape and grants
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT p.prosecdef AND 'search_path=""' = ANY (p.proconfig)
     FROM pg_proc p
    WHERE p.oid = 'public.partial_cancel_order_item(uuid, uuid, boolean, uuid)'::regprocedure),
  true, 'partial_cancel_order_item is SECURITY DEFINER with search_path = ''''');
SELECT ok(NOT has_function_privilege('anon', 'public.partial_cancel_order_item(uuid, uuid, boolean, uuid)', 'EXECUTE'),
          'anon has no EXECUTE on partial_cancel_order_item');
SELECT ok(NOT has_function_privilege('authenticated', 'public.partial_cancel_order_item(uuid, uuid, boolean, uuid)', 'EXECUTE'),
          'authenticated has no EXECUTE on partial_cancel_order_item');
SELECT ok(has_function_privilege('service_role', 'public.partial_cancel_order_item(uuid, uuid, boolean, uuid)', 'EXECUTE'),
          'service_role can EXECUTE partial_cancel_order_item');

SELECT pg_temp.act_as('anon');
SELECT throws_ok(
  $$SELECT public.partial_cancel_order_item('a0000000-0000-4000-8000-00000000000a', 'f1000000-0000-4000-8000-000000000001', true)$$,
  '42501', NULL, 'anon cannot call partial_cancel_order_item');
RESET ROLE;
SELECT pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111111');
SELECT throws_ok(
  $$SELECT public.partial_cancel_order_item('a0000000-0000-4000-8000-00000000000a', 'f1000000-0000-4000-8000-000000000001', true)$$,
  '42501', NULL, 'customer cannot call partial_cancel_order_item on own order');
RESET ROLE;
SELECT pg_temp.act_as('authenticated', '33333333-3333-4333-8333-333333333333');
SELECT throws_ok(
  $$SELECT public.partial_cancel_order_item('a0000000-0000-4000-8000-00000000000a', 'f1000000-0000-4000-8000-000000000001', true)$$,
  '42501', NULL, 'even an admin JWT cannot call it directly (server action only)');
SELECT throws_ok($$SELECT count(*) FROM public.order_item_cancellations$$,
  '42501', NULL, 'authenticated cannot read the cancellation ledger');
RESET ROLE;
SELECT is((SELECT status FROM public.order_items WHERE id = 'f1000000-0000-4000-8000-000000000001'),
          'pending', 'rejected callers changed nothing');

-- ---------------------------------------------------------------------------
-- O1 line 1, restock, intra-state
--   share = 2000 * 400 / 4000 = 200, GST 5% of 2000 = 100 (CGST 50 + SGST 50)
--   refund = 2000 - 200 + 100 = 1900
-- ---------------------------------------------------------------------------
SELECT pg_temp.act_as('service_role');
CREATE TEMP TABLE r1 AS
  SELECT public.partial_cancel_order_item('a0000000-0000-4000-8000-00000000000a',
                                          'f1000000-0000-4000-8000-000000000001', true,
                                          '33333333-3333-4333-8333-333333333333') AS j;
RESET ROLE;
SELECT is((SELECT (j->>'refund_amount')::numeric FROM r1), 1900.00, 'O1 line 1 refund = 2000 - 200 + 100');
SELECT is((SELECT (j->>'discount_share')::numeric FROM r1), 200.00, 'O1 line 1 discount share = 200');
SELECT is((SELECT (j->>'cgst')::numeric + (j->>'sgst')::numeric FROM r1), 100.00, 'intra-state: CGST + SGST = 100');
SELECT is((SELECT (j->>'igst')::numeric FROM r1), 0::numeric, 'intra-state: no IGST');
SELECT is((SELECT row(subtotal, discount_applied, tax_amount, total_amount)::text
             FROM public.orders WHERE id = 'a0000000-0000-4000-8000-00000000000a'),
          '(2000.00,200.00,240.00,2140.00)', 'O1 totals after line 1: 2000 - 200 + 240 + 100 = 2140');
SELECT is((SELECT status FROM public.order_items WHERE id = 'f1000000-0000-4000-8000-000000000001'),
          'cancelled', 'O1 line 1 marked cancelled');
SELECT is((SELECT stock_quantity::integer FROM public.product_variants WHERE id = 'e1000000-0000-4000-8000-000000000001'),
          12, 'restock added 2 to variant 1 (10 -> 12)');

-- Double cancel is rejected and changes nothing.
SELECT pg_temp.act_as('service_role');
SELECT throws_ok(
  $$SELECT public.partial_cancel_order_item('a0000000-0000-4000-8000-00000000000a', 'f1000000-0000-4000-8000-000000000001', true)$$,
  'P0001', 'ITEM_ALREADY_CANCELLED', 'second cancel of the same line is rejected');
RESET ROLE;
SELECT is((SELECT total_amount FROM public.orders WHERE id = 'a0000000-0000-4000-8000-00000000000a'),
          2140.00, 'O1 total unchanged after rejected double cancel');
SELECT is((SELECT stock_quantity::integer FROM public.product_variants WHERE id = 'e1000000-0000-4000-8000-000000000001'),
          12, 'no second restock after rejected double cancel');
SELECT is((SELECT count(*) FROM public.order_item_cancellations
            WHERE order_item_id = 'f1000000-0000-4000-8000-000000000001'),
          1::bigint, 'exactly one ledger row for the line');

-- Line belongs to another order.
SELECT pg_temp.act_as('service_role');
SELECT throws_ok(
  $$SELECT public.partial_cancel_order_item('a0000000-0000-4000-8000-00000000000a', 'f4000000-0000-4000-8000-000000000004', false)$$,
  'P0001', 'ORDER_ITEM_NOT_FOUND', 'a line from another order is rejected');
RESET ROLE;

-- ---------------------------------------------------------------------------
-- O1 line 2 (last active line), no restock: takes the remaining discount and tax.
--   refund = 2000 - 200 + 240 = 2040; order keeps only shipping (100)
-- ---------------------------------------------------------------------------
SELECT pg_temp.act_as('service_role');
CREATE TEMP TABLE r2 AS
  SELECT public.partial_cancel_order_item('a0000000-0000-4000-8000-00000000000a',
                                          'f2000000-0000-4000-8000-000000000002', false) AS j;
RESET ROLE;
SELECT is((SELECT (j->>'refund_amount')::numeric FROM r2), 2040.00, 'O1 last line refund = 2000 - 200 + 240');
SELECT is((SELECT row(subtotal, discount_applied, tax_amount, total_amount)::text
             FROM public.orders WHERE id = 'a0000000-0000-4000-8000-00000000000a'),
          '(0.00,0.00,0.00,100.00)', 'O1 after all lines: only shipping remains');
SELECT is((SELECT stock_quantity::integer FROM public.product_variants WHERE id = 'e2000000-0000-4000-8000-000000000002'),
          20, 'shrinkage cancel leaves variant 2 stock unchanged');
SELECT is((SELECT (j->>'restocked')::boolean FROM r2), false, 'shrinkage reports restocked = false');
SELECT is((SELECT count(*) FROM public.order_events
            WHERE order_id = 'a0000000-0000-4000-8000-00000000000a' AND event = 'order_item.cancelled'),
          2::bigint, 'one order_item.cancelled event per cancelled line');

-- ---------------------------------------------------------------------------
-- O2 line 3, inter-state, rounding:
--   share = round(1000 * 100 / 1500, 2) = 66.67, GST 5% of 1000 = 50 (IGST)
--   refund = 1000 - 66.67 + 50 = 983.33; total 1510 - 983.33 = 526.67
--   check: 500 - 33.33 + 60 + 0 = 526.67
-- ---------------------------------------------------------------------------
SELECT pg_temp.act_as('service_role');
CREATE TEMP TABLE r3 AS
  SELECT public.partial_cancel_order_item('a0000000-0000-4000-8000-00000000000b',
                                          'f3000000-0000-4000-8000-000000000003', false) AS j;
RESET ROLE;
SELECT is((SELECT (j->>'discount_share')::numeric FROM r3), 66.67, 'O2 discount share rounds to 66.67');
SELECT is((SELECT (j->>'igst')::numeric FROM r3), 50.00, 'inter-state: IGST = 50');
SELECT is((SELECT (j->>'cgst')::numeric + (j->>'sgst')::numeric FROM r3), 0::numeric, 'inter-state: no CGST/SGST');
SELECT is((SELECT (j->>'refund_amount')::numeric FROM r3), 983.33, 'O2 refund = 1000 - 66.67 + 50');
SELECT is((SELECT row(subtotal, discount_applied, tax_amount, total_amount)::text
             FROM public.orders WHERE id = 'a0000000-0000-4000-8000-00000000000b'),
          '(500.00,33.33,60.00,526.67)', 'O2 totals stay consistent: 500 - 33.33 + 60 = 526.67');
SELECT is((SELECT row(line_subtotal, discount_share, tax_refund, refund_amount, restocked)::text
             FROM public.order_item_cancellations
            WHERE order_item_id = 'f3000000-0000-4000-8000-000000000003'),
          '(1000.00,66.67,50.00,983.33,f)', 'ledger row records the credit-note amounts');

SELECT * FROM finish();
ROLLBACK;
