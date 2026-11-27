-- Migration 0051: HSN, GST 2.0 rates, per-line CGST/SGST/IGST, place of
-- supply by state code, invoice numbers, customer IDs, liability report.
-- Run: npx supabase test db   (local Docker stack only, never production)
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(37);

CREATE FUNCTION pg_temp.act_as(p_role text, p_sub uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role, 'aal', 'aal2', 'session_id', gen_random_uuid(), 'amr', json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint)))::text, true);
  PERFORM set_config('role', p_role, true);
END $$;

-- The report assertions sum whole periods, so move any invoices and
-- cancellations already in this database (e.g. from E2E runs) ten years
-- back. Rolled back with the rest of this transaction.
ALTER TABLE public.orders DISABLE TRIGGER orders_invoice_immutable;
UPDATE public.orders SET invoice_date = invoice_date - interval '10 years' WHERE invoice_date IS NOT NULL;
ALTER TABLE public.orders ENABLE TRIGGER orders_invoice_immutable;
UPDATE public.order_item_cancellations SET created_at = created_at - interval '10 years';

INSERT INTO auth.users (id, email) VALUES
  ('d0000000-0000-4000-8000-0000000000c1', 'gst-customer@example.test'),
  ('d0000000-0000-4000-8000-0000000000c3', 'gst-customer3@example.test'),
  ('d0000000-0000-4000-8000-0000000000c4', 'gst-customer4@example.test');
INSERT INTO public.categories (id, name, slug)
VALUES ('d0000000-0000-4000-8000-000000000001', 'GST cat', 'gst-cat-0051');
-- Cotton fabric (5208, 5%), a kurta (6211, cliff at Rs 2,500), a product with no HSN (fallback 12%).
INSERT INTO public.products (id, category_id, slug, title, status, sell_unit, hsn_code, gst_rate) VALUES
  ('d0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'gst-cotton', 'Cotton', 'active', 'MTR', '5208', 5),
  ('d0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000001', 'gst-kurta', 'Kurta', 'active', 'PCS', '6211', 5),
  ('d0000000-0000-4000-8000-000000000022', 'd0000000-0000-4000-8000-000000000001', 'gst-trim', 'Trim', 'active', 'PCS', NULL, 12);
INSERT INTO public.product_variants (id, product_id, sku, color, price, stock_quantity) VALUES
  ('d0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000002', 'GC-0051', 'White', 400, 100),
  ('d0000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000012', 'GK-0051', 'Blue', 2600, 10),
  ('d0000000-0000-4000-8000-000000000014', 'd0000000-0000-4000-8000-000000000012', 'GK2-0051', 'Green', 2400, 10),
  ('d0000000-0000-4000-8000-000000000023', 'd0000000-0000-4000-8000-000000000022', 'GT-0051', 'Gold', 100, 10);
INSERT INTO public.discounts (code, type, value, is_active, target_type)
VALUES ('GST10', 'percentage', 10, true, 'all');

CREATE TEMP TABLE t_o (tag text PRIMARY KEY, id uuid);
GRANT ALL ON t_o TO PUBLIC;

-- 1. Helpers
SELECT is(public.gst_state_code('NCT of Delhi'), '07', 'Delhi aliases map to 07');
SELECT is(public.gst_state_code('karnataka'), '29', 'state names are case-insensitive');
SELECT is(public.gst_state_code('Atlantis'), NULL, 'unknown state gives NULL');
SELECT is(public.gst_rate_for('5208', 99999, 12), 5.00::numeric(5,2), 'fabrics are a flat 5%');
SELECT is(public.gst_rate_for('6211', 2500, 5), 5.00::numeric(5,2), 'apparel at Rs 2,500 is 5%');
SELECT is(public.gst_rate_for('6211', 2500.01, 5), 18.00::numeric(5,2), 'apparel above Rs 2,500 is 18%');

-- 2. Intra-state (Delhi): CGST + SGST; 2.5 m x Rs 400 = 1000, tax 50
INSERT INTO t_o SELECT 'delhi', public.create_order_atomic('d0000000-0000-4000-8000-0000000000c1',
  '[{"variant_id":"d0000000-0000-4000-8000-000000000003","quantity":2.5}]', '{"state":"New Delhi"}', 0);
SELECT results_eq(
  $$SELECT i.hsn_code, i.gst_rate, i.taxable_value, i.cgst, i.sgst, i.igst
      FROM public.order_items i JOIN t_o t ON t.id = i.order_id WHERE t.tag = 'delhi'$$,
  $$VALUES ('5208'::text, 5.00::numeric(5,2), 1000.00::numeric(12,2), 25.00::numeric(10,2), 25.00::numeric(10,2), 0.00::numeric(10,2))$$,
  'Delhi delivery: HSN snapshot, CGST 25 + SGST 25');
SELECT results_eq(
  $$SELECT o.place_of_supply, o.tax_amount, o.cgst_total, o.sgst_total, o.igst_total, o.total_amount
      FROM public.orders o JOIN t_o t ON t.id = o.id WHERE t.tag = 'delhi'$$,
  $$VALUES ('07'::text, 50.00::numeric(10,2), 25.00::numeric(10,2), 25.00::numeric(10,2), 0.00::numeric(10,2), 1050.00::numeric(10,2))$$,
  'order totals carry the split');

-- 3. Inter-state: IGST
INSERT INTO t_o SELECT 'blr', public.create_order_atomic('d0000000-0000-4000-8000-0000000000c1',
  '[{"variant_id":"d0000000-0000-4000-8000-000000000003","quantity":1}]', '{"state":"Karnataka"}', 0);
SELECT results_eq(
  $$SELECT o.place_of_supply, o.cgst_total, o.sgst_total, o.igst_total
      FROM public.orders o JOIN t_o t ON t.id = o.id WHERE t.tag = 'blr'$$,
  $$VALUES ('29'::text, 0.00::numeric(10,2), 0.00::numeric(10,2), 20.00::numeric(10,2))$$,
  'Karnataka delivery: IGST only');

-- 4. Tax on the value after discount; the cliff uses the discounted per-piece value
--    Kurta 2600 - 10% = 2340 per piece, so 5%, not 18%.
INSERT INTO t_o SELECT 'disc', public.create_order_atomic('d0000000-0000-4000-8000-0000000000c1',
  '[{"variant_id":"d0000000-0000-4000-8000-000000000013","quantity":1},{"variant_id":"d0000000-0000-4000-8000-000000000003","quantity":1}]',
  '{"state":"Delhi"}', 0, 'GST10');
SELECT is((SELECT sum(i.discount_share) FROM public.order_items i JOIN t_o t ON t.id = i.order_id WHERE t.tag = 'disc'),
          300.00::numeric, 'discount shares add up to the coupon (10% of 3000)');
SELECT results_eq(
  $$SELECT i.taxable_value, i.gst_rate FROM public.order_items i JOIN t_o t ON t.id = i.order_id
     WHERE t.tag = 'disc' ORDER BY i.unit_price DESC$$,
  $$VALUES (2340.00::numeric(12,2), 5.00::numeric(5,2)), (360.00::numeric(12,2), 5.00::numeric(5,2))$$,
  'taxable value is after discount; the discounted kurta stays at 5%');
SELECT is((SELECT o.tax_amount FROM public.orders o JOIN t_o t ON t.id = o.id WHERE t.tag = 'disc'),
          135.00::numeric(10,2), 'tax is 5% of 2700, not of 3000');
SELECT is((SELECT o.total_amount FROM public.orders o JOIN t_o t ON t.id = o.id WHERE t.tag = 'disc'),
          2835.00::numeric(10,2), 'total = 3000 - 300 + 135');

-- 5. Full-price kurta above the cliff is 18%; a product without HSN uses its own rate
INSERT INTO t_o SELECT 'cliff', public.create_order_atomic('d0000000-0000-4000-8000-0000000000c3',
  '[{"variant_id":"d0000000-0000-4000-8000-000000000013","quantity":1},{"variant_id":"d0000000-0000-4000-8000-000000000023","quantity":1}]',
  '{"state":"Maharashtra"}', 0);
SELECT results_eq(
  $$SELECT i.gst_rate, i.igst FROM public.order_items i JOIN t_o t ON t.id = i.order_id
     WHERE t.tag = 'cliff' ORDER BY i.unit_price DESC$$,
  $$VALUES (18.00::numeric(5,2), 468.00::numeric(10,2)), (12.00::numeric(5,2), 12.00::numeric(10,2))$$,
  'Rs 2,600 kurta at 18%; no-HSN product falls back to its gst_rate');

-- 6. Place of supply and GSTIN validation
SELECT throws_ok(
  $$SELECT public.create_order_atomic('d0000000-0000-4000-8000-0000000000c3',
      '[{"variant_id":"d0000000-0000-4000-8000-000000000003","quantity":1}]', '{"state":"Atlantis"}', 0)$$,
  'P0001', 'INVALID_STATE', 'an unknown delivery state is refused');
SELECT throws_ok(
  $$SELECT public.create_order_atomic('d0000000-0000-4000-8000-0000000000c3',
      '[{"variant_id":"d0000000-0000-4000-8000-000000000003","quantity":1}]', '{"state":"Delhi","gstin":"NOT-A-GSTIN"}', 0)$$,
  'P0001', 'INVALID_GSTIN', 'a malformed buyer GSTIN is refused');
INSERT INTO t_o SELECT 'b2b', public.create_order_atomic('d0000000-0000-4000-8000-0000000000c4',
  '[{"variant_id":"d0000000-0000-4000-8000-000000000003","quantity":1}]', '{"state":"Delhi","gstin":"07aaacm1234a1z5"}', 0);
SELECT is((SELECT o.buyer_gstin FROM public.orders o JOIN t_o t ON t.id = o.id WHERE t.tag = 'b2b'),
          '07AAACM1234A1Z5', 'a valid buyer GSTIN is stored upper-case');

-- 7. Invoice numbers
SELECT is((SELECT o.invoice_number FROM public.orders o JOIN t_o t ON t.id = o.id WHERE t.tag = 'delhi'),
          NULL, 'no invoice number before payment');
UPDATE public.orders SET is_paid = true, status = 'paid' WHERE id = (SELECT id FROM t_o WHERE tag = 'delhi');
UPDATE public.orders SET is_paid = true, status = 'paid' WHERE id = (SELECT id FROM t_o WHERE tag = 'disc');
SELECT matches((SELECT o.invoice_number FROM public.orders o JOIN t_o t ON t.id = o.id WHERE t.tag = 'delhi'),
               '^MITH/[0-9]{4}/[0-9]{6}$', 'invoice number is PREFIX/FY/serial');
SELECT cmp_ok((SELECT length(o.invoice_number) FROM public.orders o JOIN t_o t ON t.id = o.id WHERE t.tag = 'delhi'),
              '<=', 16, 'invoice number fits Rule 46 (16 characters)');
SELECT is((SELECT right(b.invoice_number, 6)::int - right(a.invoice_number, 6)::int
             FROM public.orders a, public.orders b
            WHERE a.id = (SELECT id FROM t_o WHERE tag = 'delhi') AND b.id = (SELECT id FROM t_o WHERE tag = 'disc')),
          1, 'invoice numbers are consecutive');
SELECT isnt((SELECT o.invoice_date FROM public.orders o JOIN t_o t ON t.id = o.id WHERE t.tag = 'delhi'),
            NULL, 'invoice date is set');
SELECT throws_ok(
  $$UPDATE public.orders SET invoice_number = 'MITH/9999/000001' WHERE id = (SELECT id FROM t_o WHERE tag = 'delhi')$$,
  'P0001', 'INVOICE_NUMBER_IMMUTABLE', 'an issued invoice number cannot change');

-- 8. Partial cancel after invoice refunds exactly the invoiced line tax
-- (now() is fixed inside this test transaction, so back-date the invoices a
-- minute to model payment and cancellation happening at different times.)
ALTER TABLE public.orders DISABLE TRIGGER orders_invoice_immutable;
UPDATE public.orders SET invoice_date = invoice_date - interval '1 minute' WHERE invoice_date IS NOT NULL;
ALTER TABLE public.orders ENABLE TRIGGER orders_invoice_immutable;
SELECT is((public.partial_cancel_order_item(
             (SELECT id FROM t_o WHERE tag = 'disc'),
             (SELECT i.id FROM public.order_items i JOIN t_o t ON t.id = i.order_id
               WHERE t.tag = 'disc' AND i.unit_price = 400), false) ->> 'tax_refund')::numeric,
          18.00, 'cancelled line refunds its own CGST+SGST (5% of 360)');
SELECT is((SELECT o.cgst_total + o.sgst_total FROM public.orders o JOIN t_o t ON t.id = o.id WHERE t.tag = 'disc'),
          117.00::numeric, 'order tax split is reduced by the refunded line');

-- 9. Liability report
SELECT is((SELECT taxable_value FROM public.gst_outward_summary(current_date - 1, current_date + 1)
            WHERE kind = 'supply' AND place_of_supply = '07' AND gst_rate = 5),
          3700.00::numeric(14,2), 'outward supplies: 1000 + 2340 + 360 invoiced in Delhi at 5%');
SELECT is((SELECT taxable_value FROM public.gst_outward_summary(current_date - 1, current_date + 1)
            WHERE kind = 'cancelled_after_invoice'),
          -360.00::numeric(14,2), 'line cancelled after invoice shows as a negative adjustment');
SELECT is((SELECT quantity FROM public.gst_hsn_summary(current_date - 1, current_date + 1)
            WHERE hsn_code = '5208' AND uqc = 'MTR'),
          3.50::numeric(14,2), 'HSN summary counts metres per HSN');
SELECT is((SELECT count(*)::int FROM public.gst_outward_summary(current_date + 5, current_date + 6)),
          0, 'nothing outside the period');

-- 10. Customer IDs
INSERT INTO auth.users (id, email) VALUES ('d0000000-0000-4000-8000-0000000000c2', 'gst-new@example.test');
SELECT matches((SELECT customer_code FROM public.profiles WHERE id = 'd0000000-0000-4000-8000-0000000000c2'),
               '^MTH-[0-9]{6,}$', 'new sign-ups get a customer ID');
SELECT isnt((SELECT customer_code FROM public.profiles WHERE id = 'd0000000-0000-4000-8000-0000000000c2'),
            (SELECT customer_code FROM public.profiles WHERE id = 'd0000000-0000-4000-8000-0000000000c1'),
            'customer IDs are unique');
UPDATE public.profiles SET customer_code = 'MTH-999999' WHERE id = 'd0000000-0000-4000-8000-0000000000c2';
SELECT isnt((SELECT customer_code FROM public.profiles WHERE id = 'd0000000-0000-4000-8000-0000000000c2'),
            'MTH-999999', 'customer IDs cannot be changed');

-- 11. Permissions
SELECT pg_temp.act_as('authenticated', 'd0000000-0000-4000-8000-0000000000c1');
SELECT throws_ok($$SELECT * FROM public.gst_outward_summary(current_date, current_date)$$,
  '42501', NULL, 'customers cannot run the liability report');
SELECT throws_ok($$SELECT public.apply_order_gst((SELECT id FROM t_o WHERE tag = 'blr'), 0)$$,
  '42501', NULL, 'customers cannot recompute order GST');
SELECT throws_ok($$SELECT * FROM public.invoice_counters$$, '42501', NULL, 'invoice counters are private');
SELECT is((SELECT count(*)::int FROM public.gst_settings), 0, 'customers do not read supplier settings');
SELECT throws_ok($$SELECT public.gst_state_code('Delhi')$$, '42501', NULL, 'state lookup is internal');
RESET role;

SELECT * FROM finish();
ROLLBACK;
