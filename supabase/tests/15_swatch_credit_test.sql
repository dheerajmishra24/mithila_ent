-- Migration 0052: swatch kits and the swatch-recovery credit ledger.
-- Run: npx supabase test db   (local Docker stack only, never production)
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(49);

CREATE FUNCTION pg_temp.act_as(p_role text, p_sub uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role, 'aal', 'aal2', 'session_id', gen_random_uuid(), 'amr', json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint)))::text, true);
  PERFORM set_config('role', p_role, true);
END $$;

-- Customers: a (main), b (other), c (revoke case)
INSERT INTO auth.users (id, email) VALUES
  ('e0000000-0000-4000-8000-0000000000a1', 'sw-a@example.test'),
  ('e0000000-0000-4000-8000-0000000000b1', 'sw-b@example.test'),
  ('e0000000-0000-4000-8000-0000000000c1', 'sw-c@example.test');
INSERT INTO public.categories (id, name, slug)
VALUES ('e0000000-0000-4000-8000-000000000001', 'Swatch cat', 'swatch-cat-0052');
INSERT INTO public.products (id, category_id, slug, title, status, sell_unit, hsn_code, gst_rate) VALUES
  ('e0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'sw-linen', 'Linen', 'active', 'MTR', '5309', 5),
  ('e0000000-0000-4000-8000-000000000012', 'e0000000-0000-4000-8000-000000000001', 'sw-old', 'Old', 'archived', 'MTR', '5208', 5);
INSERT INTO public.product_variants (id, product_id, sku, color, price, stock_quantity) VALUES
  ('e0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000002', 'SW-1', 'Ivory', 400, 100),
  ('e0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000002', 'SW-2', 'Sage', 400, 100),
  ('e0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000002', 'SW-3', 'Rust', 400, 100),
  ('e0000000-0000-4000-8000-000000000013', 'e0000000-0000-4000-8000-000000000012', 'SW-OLD', 'Grey', 400, 10);

CREATE TEMP TABLE t_o (tag text PRIMARY KEY, id uuid);
GRANT ALL ON t_o TO PUBLIC;
CREATE TEMP TABLE t_stock AS
  SELECT id, stock_quantity FROM public.product_variants WHERE sku IN ('SW-1', 'SW-2', 'SW-3');
GRANT ALL ON t_stock TO PUBLIC;

-- 1. Grants and RLS
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.swatch_credit_accounts'::regclass), 'accounts: RLS on');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.swatch_credit_ledger'::regclass), 'ledger: RLS on');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.swatch_settings'::regclass), 'settings: RLS on');
SELECT ok(NOT has_table_privilege('anon', 'public.swatch_credit_ledger', 'SELECT'), 'anon cannot read the ledger');
SELECT ok(NOT has_table_privilege('authenticated', 'public.swatch_credit_ledger', 'INSERT,UPDATE,DELETE,TRUNCATE'),
          'customers cannot write the ledger');
SELECT ok(NOT has_table_privilege('authenticated', 'public.swatch_credit_accounts', 'INSERT,UPDATE,DELETE,TRUNCATE'),
          'customers cannot write balances');
SELECT ok(NOT has_function_privilege('authenticated', 'public.swatch_credit_post(uuid, uuid, text, numeric, text, text, uuid, boolean)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.apply_swatch_credit(uuid, uuid)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.create_swatch_order(uuid, uuid[], jsonb, text)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.admin_adjust_swatch_credit(uuid, numeric, text, uuid, text)', 'EXECUTE'),
          'credit functions are service_role only');
SELECT ok(NOT has_function_privilege('anon', 'public.create_swatch_order(uuid, uuid[], jsonb, text)', 'EXECUTE'),
          'anon cannot create swatch orders');

-- 2. Kit validation
SELECT throws_ok($$SELECT public.create_swatch_order('e0000000-0000-4000-8000-0000000000a1', ARRAY[]::uuid[], '{"state":"Delhi"}')$$,
                 'P0001', 'EMPTY_SWATCH_KIT', 'an empty kit is refused');
SELECT throws_ok($$SELECT public.create_swatch_order('e0000000-0000-4000-8000-0000000000a1',
                   ARRAY['e0000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000003']::uuid[], '{"state":"Delhi"}')$$,
                 'P0001', 'INVALID_SWATCH_KIT', 'duplicate swatches are refused');
SELECT throws_ok($$SELECT public.create_swatch_order('e0000000-0000-4000-8000-0000000000a1',
                   ARRAY['e0000000-0000-4000-8000-000000000013']::uuid[], '{"state":"Delhi"}')$$,
                 'P0001', 'VARIANT_NOT_FOUND', 'archived products cannot be sampled');
SELECT throws_ok($$SELECT public.create_swatch_order('e0000000-0000-4000-8000-0000000000a1',
                   ARRAY['e0000000-0000-4000-8000-000000000003']::uuid[], '{"state":"Atlantis"}')$$,
                 'P0001', 'INVALID_STATE', 'a state is required');
UPDATE public.swatch_settings SET max_swatches = 2;
SELECT throws_ok($$SELECT public.create_swatch_order('e0000000-0000-4000-8000-0000000000a1',
                   ARRAY['e0000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000005']::uuid[],
                   '{"state":"Delhi"}')$$,
                 'P0001', 'INVALID_SWATCH_KIT', 'more swatches than the kit allows are refused');
UPDATE public.swatch_settings SET max_swatches = 5;

-- 3. A three-swatch kit in Delhi: Rs 99 inclusive, 33 each, 31.43 + 1.57 tax per line
INSERT INTO t_o SELECT 'kitA', public.create_swatch_order('e0000000-0000-4000-8000-0000000000a1',
  ARRAY['e0000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000005']::uuid[],
  '{"state":"Delhi"}', 'kit-a');
SELECT results_eq(
  $$SELECT o.order_kind, o.total_amount, o.taxable_value, o.cgst_total + o.sgst_total, o.igst_total, o.shipping_amount, o.amount_due
      FROM public.orders o JOIN t_o t ON t.id = o.id WHERE t.tag = 'kitA'$$,
  $$VALUES ('swatch'::text, 99.00::numeric(10,2), 94.29::numeric(12,2), 4.71::numeric, 0.00::numeric(10,2), 0.00::numeric(10,2), 99.00::numeric(10,2))$$,
  'kit totals exactly the kit price, intra-state split');
SELECT is((SELECT count(*)::int FROM public.order_items i JOIN t_o t ON t.id = i.order_id
            WHERE t.tag = 'kitA' AND i.is_swatch AND i.uqc = 'PCS' AND i.quantity = 1 AND i.hsn_code = '5309'),
          3, 'one swatch line per fabric, HSN snapshotted');
SELECT is((SELECT sum(i.taxable_value + i.cgst + i.sgst + i.igst) FROM public.order_items i JOIN t_o t ON t.id = i.order_id WHERE t.tag = 'kitA'),
          99.00::numeric, 'lines add up to the kit price');
SELECT is((SELECT count(*)::int FROM public.order_item_cuts c JOIN t_o t ON t.id = c.order_id WHERE t.tag = 'kitA'),
          0, 'no roll is cut for swatches');
SELECT ok((SELECT bool_and(pv.stock_quantity = s.stock_quantity) FROM public.product_variants pv JOIN t_stock s ON s.id = pv.id),
          'stock is untouched by a swatch kit');
SELECT is(public.create_swatch_order('e0000000-0000-4000-8000-0000000000a1',
            ARRAY['e0000000-0000-4000-8000-000000000003']::uuid[], '{"state":"Delhi"}', 'kit-a'),
          (SELECT id FROM t_o WHERE tag = 'kitA'), 'same idempotency key returns the same kit');

-- 4. Paying the kit earns its price as credit, once
SELECT throws_like($$SELECT public.record_payment((SELECT id FROM t_o WHERE tag = 'kitA'), 'razorpay', 'pay_kitA_low', 98.00)$$,
                   '%PARTIAL_PAYMENT_REJECTED%', 'a short capture is refused');
SELECT lives_ok($$SELECT public.record_payment((SELECT id FROM t_o WHERE tag = 'kitA'), 'razorpay', 'pay_kitA', 99.00)$$,
                'kit payment recorded');
SELECT lives_ok($$SELECT public.record_payment((SELECT id FROM t_o WHERE tag = 'kitA'), 'razorpay', 'pay_kitA', 99.00)$$,
                'webhook replay of the same payment is harmless');
SELECT is((SELECT balance FROM public.swatch_credit_accounts WHERE user_id = 'e0000000-0000-4000-8000-0000000000a1'),
          99.00::numeric(10,2), 'kit price credited once');
SELECT results_eq(
  $$SELECT entry, amount, balance_after FROM public.swatch_credit_ledger WHERE user_id = 'e0000000-0000-4000-8000-0000000000a1'$$,
  $$VALUES ('earn'::text, 99.00::numeric(10,2), 99.00::numeric(10,2))$$,
  'ledger has one earn row');
SELECT matches((SELECT invoice_number FROM public.orders o JOIN t_o t ON t.id = o.id WHERE t.tag = 'kitA'),
               '^MITH/', 'a paid kit gets a tax invoice number');

-- 5. Redeem on a metre order (2.5 m x 400 = 1000 + 5% = 1050)
INSERT INTO t_o SELECT 'ordX', public.create_order_atomic('e0000000-0000-4000-8000-0000000000a1',
  '[{"variant_id":"e0000000-0000-4000-8000-000000000003","quantity":2.5}]', '{"state":"Delhi"}', 0);
SELECT throws_ok($$SELECT public.apply_swatch_credit((SELECT id FROM t_o WHERE tag = 'ordX'), 'e0000000-0000-4000-8000-0000000000b1')$$,
                 'P0001', 'ORDER_NOT_FOUND', 'credit cannot be applied to another customer''s order');
SELECT is(public.apply_swatch_credit((SELECT id FROM t_o WHERE tag = 'ordX'), 'e0000000-0000-4000-8000-0000000000a1'),
          99.00::numeric, 'whole balance applied');
SELECT is(public.apply_swatch_credit((SELECT id FROM t_o WHERE tag = 'ordX'), 'e0000000-0000-4000-8000-0000000000a1'),
          0::numeric, 'applying twice does nothing');
SELECT results_eq(
  $$SELECT o.total_amount, o.credit_applied, o.amount_due, o.tax_amount FROM public.orders o JOIN t_o t ON t.id = o.id WHERE t.tag = 'ordX'$$,
  $$VALUES (1050.00::numeric(10,2), 99.00::numeric(10,2), 951.00::numeric(10,2), 50.00::numeric(10,2))$$,
  'credit is part payment: GST unchanged, gateway owed 951');
SELECT is((SELECT balance FROM public.swatch_credit_accounts WHERE user_id = 'e0000000-0000-4000-8000-0000000000a1'),
          0.00::numeric(10,2), 'balance spent');

-- 6. Cancelling the order (unpaid timeout) restores the credit and the metres
UPDATE public.orders SET created_at = now() - interval '2 hours' WHERE id = (SELECT id FROM t_o WHERE tag = 'ordX');
SELECT ok(public.cancel_expired_pending_orders() >= 1, 'expired order cancelled');
SELECT is((SELECT balance FROM public.swatch_credit_accounts WHERE user_id = 'e0000000-0000-4000-8000-0000000000a1'),
          99.00::numeric(10,2), 'credit restored on cancellation');
SELECT is((SELECT stock_quantity FROM public.product_variants WHERE id = 'e0000000-0000-4000-8000-000000000003'),
          (SELECT stock_quantity FROM t_stock WHERE id = 'e0000000-0000-4000-8000-000000000003'), 'metres back in stock');

-- 7. Redeem again and pay the amount due
INSERT INTO t_o SELECT 'ordY', public.create_order_atomic('e0000000-0000-4000-8000-0000000000a1',
  '[{"variant_id":"e0000000-0000-4000-8000-000000000004","quantity":1}]', '{"state":"Maharashtra"}', 60);
SELECT is(public.apply_swatch_credit((SELECT id FROM t_o WHERE tag = 'ordY'), 'e0000000-0000-4000-8000-0000000000a1'),
          99.00::numeric, 'restored credit can be used again');
SELECT throws_like($$SELECT public.record_payment((SELECT id FROM t_o WHERE tag = 'ordY'), 'razorpay', 'pay_Y_low', 300.00)$$,
                   '%PARTIAL_PAYMENT_REJECTED%', 'capture below the amount due is refused');
SELECT lives_ok($$SELECT public.record_payment((SELECT id FROM t_o WHERE tag = 'ordY'), 'razorpay', 'pay_Y',
                    (SELECT amount_due FROM public.orders WHERE id = (SELECT id FROM t_o WHERE tag = 'ordY')))$$,
                'capture of the amount due (480 - 99 = 381) pays the order');
SELECT ok((SELECT is_paid FROM public.orders WHERE id = (SELECT id FROM t_o WHERE tag = 'ordY')), 'order paid');

-- 8. An unpaid swatch kit that expires releases no stock and earns nothing
INSERT INTO t_o SELECT 'kitB', public.create_swatch_order('e0000000-0000-4000-8000-0000000000b1',
  ARRAY['e0000000-0000-4000-8000-000000000005']::uuid[], '{"state":"Karnataka"}');
SELECT is((SELECT igst_total FROM public.orders o JOIN t_o t ON t.id = o.id WHERE t.tag = 'kitB'),
          4.71::numeric(10,2), 'out-of-state kit carries IGST');
UPDATE public.orders SET created_at = now() - interval '2 hours' WHERE id = (SELECT id FROM t_o WHERE tag = 'kitB');
SELECT ok(public.cancel_expired_pending_orders() >= 1, 'expired kit cancelled');
SELECT is((SELECT stock_quantity FROM public.product_variants WHERE id = 'e0000000-0000-4000-8000-000000000005'),
          (SELECT stock_quantity FROM t_stock WHERE id = 'e0000000-0000-4000-8000-000000000005'),
          'cancelling a kit adds no stock');
SELECT is((SELECT count(*)::int FROM public.swatch_credit_ledger WHERE user_id = 'e0000000-0000-4000-8000-0000000000b1'),
          0, 'an unpaid kit earns nothing');

-- 9. A paid kit that is cancelled takes back its credit, as far as the balance allows
INSERT INTO t_o SELECT 'kitC', public.create_swatch_order('e0000000-0000-4000-8000-0000000000c1',
  ARRAY['e0000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000005']::uuid[], '{"state":"Delhi"}');
SELECT lives_ok($$SELECT public.record_payment((SELECT id FROM t_o WHERE tag = 'kitC'), 'razorpay', 'pay_kitC', 99.00)$$, 'kit C paid');
SELECT throws_like($$SELECT public.partial_cancel_order_item((SELECT id FROM t_o WHERE tag = 'kitC'),
                     (SELECT i.id FROM public.order_items i JOIN t_o t ON t.id = i.order_id WHERE t.tag = 'kitC' LIMIT 1), false)$$,
                   '%SWATCH_ORDER_NOT_PARTIAL%', 'a kit cannot be cancelled line by line');
SELECT lives_ok($$SELECT public.admin_adjust_swatch_credit('e0000000-0000-4000-8000-0000000000c1', -40, 'Goodwill correction', NULL, 'k1')$$,
                'owner adjustment');
SELECT throws_ok($$SELECT public.admin_adjust_swatch_credit('e0000000-0000-4000-8000-0000000000c1', -500, 'Too much', NULL, 'k2')$$,
                 'P0001', 'INSUFFICIENT_CREDIT', 'a balance can never go negative');
UPDATE public.orders SET status = 'cancelled' WHERE id = (SELECT id FROM t_o WHERE tag = 'kitC');
SELECT results_eq(
  $$SELECT entry, amount, balance_after FROM public.swatch_credit_ledger
     WHERE user_id = 'e0000000-0000-4000-8000-0000000000c1' ORDER BY created_at, amount DESC$$,
  $$VALUES ('earn'::text, 99.00::numeric(10,2), 99.00::numeric(10,2)),
           ('adjust'::text, -40.00::numeric(10,2), 59.00::numeric(10,2)),
           ('revoke'::text, -59.00::numeric(10,2), 0.00::numeric(10,2))$$,
  'revoke takes back only what is left');

-- 10. Customers see only their own credit
SELECT pg_temp.act_as('authenticated', 'e0000000-0000-4000-8000-0000000000b1');
SELECT is((SELECT count(*)::int FROM public.swatch_credit_ledger), 0, 'customer B sees none of A''s ledger');
SELECT is((SELECT count(*)::int FROM public.swatch_credit_accounts), 0, 'customer B sees no other balance');
SELECT pg_temp.act_as('authenticated', 'e0000000-0000-4000-8000-0000000000a1');
SELECT is((SELECT count(*)::int FROM public.swatch_credit_ledger), 4, 'customer A sees own four entries');
RESET role;

SELECT * FROM finish();
ROLLBACK;
