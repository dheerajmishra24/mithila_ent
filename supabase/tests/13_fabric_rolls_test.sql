-- Migration 0050: metre quantities, rolls, single-bolt cuts, remnants, cut boundary.
-- Run: npx supabase test db   (local Docker stack only, never production)
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(39);

CREATE FUNCTION pg_temp.act_as(p_role text, p_sub uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role, 'aal', 'aal2', 'session_id', gen_random_uuid(), 'amr', json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint)))::text, true);
  PERFORM set_config('role', p_role, true);
END $$;

-- Fixtures: a customer, a metre product with no opening stock, a piece product.
INSERT INTO auth.users (id, email) VALUES
  ('c0000000-0000-4000-8000-0000000000c1', 'rolls-customer@example.test');
INSERT INTO public.categories (id, name, slug)
VALUES ('c0000000-0000-4000-8000-000000000001', 'Rolls cat', 'rolls-cat-0050');
INSERT INTO public.products (id, category_id, slug, title, status, remnant_threshold_m) VALUES
  ('c0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'rolls-linen-0050', 'Linen', 'active', 2.00);
INSERT INTO public.products (id, category_id, slug, title, status, sell_unit) VALUES
  ('c0000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000001', 'rolls-saree-0050', 'Saree', 'active', 'PCS');
INSERT INTO public.product_variants (id, product_id, sku, color, price, stock_quantity) VALUES
  ('c0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'RL-0050', 'Natural', 100, 0),
  ('c0000000-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000012', 'RS-0050', 'Red', 2000, 5);

-- Three rolls: 10 m (lot A), 3 m (lot B), 30 m (lot C).
SELECT lives_ok($$SELECT public.admin_receive_roll('c0000000-0000-4000-8000-000000000003', 10, 'lot-a')$$, 'receive a 10 m roll');
SELECT lives_ok($$SELECT public.admin_receive_roll('c0000000-0000-4000-8000-000000000003', 3, 'lot-b')$$, 'receive a 3 m roll');
SELECT lives_ok($$SELECT public.admin_receive_roll('c0000000-0000-4000-8000-000000000003', 30, 'lot-c', 'slightly darker')$$, 'receive a 30 m roll');

SELECT is((SELECT stock_quantity FROM public.product_variants WHERE id = 'c0000000-0000-4000-8000-000000000003'),
          43.00::numeric(10,2), 'variant stock is the sum of its rolls');
SELECT is((SELECT max_cut_m FROM public.product_variants WHERE id = 'c0000000-0000-4000-8000-000000000003'),
          30.00::numeric(10,2), 'longest single cut is the biggest roll');
SELECT is((SELECT dye_lot FROM public.fabric_rolls WHERE total_m = 3 AND variant_id = 'c0000000-0000-4000-8000-000000000003'),
          'LOT-B', 'dye lots are stored upper-case');

-- Direct writes to a metre variant's stock are ignored.
UPDATE public.product_variants SET stock_quantity = 999 WHERE id = 'c0000000-0000-4000-8000-000000000003';
SELECT is((SELECT stock_quantity FROM public.product_variants WHERE id = 'c0000000-0000-4000-8000-000000000003'),
          43.00::numeric(10,2), 'stock cache cannot be overwritten directly');

-- Quantity rules
SELECT throws_ok(
  $$SELECT public.create_order_atomic('c0000000-0000-4000-8000-0000000000c1',
      '[{"variant_id":"c0000000-0000-4000-8000-000000000003","quantity":1.25}]', '{"state":"Delhi"}', 0)$$,
  'P0001', 'INVALID_QUANTITY', '1.25 m is not a 0.5 m step');
SELECT throws_ok(
  $$SELECT public.create_order_atomic('c0000000-0000-4000-8000-0000000000c1',
      '[{"variant_id":"c0000000-0000-4000-8000-000000000013","quantity":1.5}]', '{"state":"Delhi"}', 0)$$,
  'P0001', 'INVALID_QUANTITY', 'pieces must be whole numbers');

-- Best fit: 2.5 m comes off the 3 m roll, leaving a 0.5 m remnant.
CREATE TEMP TABLE t_orders (tag text PRIMARY KEY, id uuid);
GRANT ALL ON t_orders TO PUBLIC;
INSERT INTO t_orders SELECT 'o1', public.create_order_atomic('c0000000-0000-4000-8000-0000000000c1',
  '[{"variant_id":"c0000000-0000-4000-8000-000000000003","quantity":2.5}]', '{"state":"Delhi"}', 0);

SELECT is((SELECT c.dye_lot FROM public.order_item_cuts c JOIN t_orders t ON t.id = c.order_id WHERE t.tag = 'o1'),
          'LOT-B', 'a 2.5 m cut is taken from the smallest roll that fits');
SELECT is((SELECT i.dye_lot FROM public.order_items i JOIN t_orders t ON t.id = i.order_id WHERE t.tag = 'o1'),
          'LOT-B', 'the dye lot is snapshotted on the order line');
SELECT is((SELECT i.quantity FROM public.order_items i JOIN t_orders t ON t.id = i.order_id WHERE t.tag = 'o1'),
          2.50::numeric(10,2), 'the line keeps the half metre');
SELECT is((SELECT i.uqc FROM public.order_items i JOIN t_orders t ON t.id = i.order_id WHERE t.tag = 'o1'),
          'MTR', 'UQC is MTR');
SELECT is((SELECT status::text FROM public.fabric_rolls WHERE dye_lot = 'LOT-B'),
          'remnant', 'the 0.5 m left over is a remnant');
SELECT is((SELECT total_amount FROM public.orders o JOIN t_orders t ON t.id = o.id WHERE t.tag = 'o1'),
          262.50::numeric(10,2), 'price 100 x 2.5 m + 5% GST');

-- 12 m comes off the 30 m roll (the 10 m roll is too short).
INSERT INTO t_orders SELECT 'o2', public.create_order_atomic('c0000000-0000-4000-8000-0000000000c1',
  '[{"variant_id":"c0000000-0000-4000-8000-000000000003","quantity":12}]', '{"state":"Delhi"}', 0);
SELECT is((SELECT c.dye_lot FROM public.order_item_cuts c JOIN t_orders t ON t.id = c.order_id WHERE t.tag = 'o2'),
          'LOT-C', 'a 12 m cut never splits across the 10 m and 3 m rolls');

-- Two lines of the same colour merge into one continuous length.
SELECT is((SELECT stock_quantity FROM public.product_variants WHERE id = 'c0000000-0000-4000-8000-000000000003'),
          28.50::numeric(10,2), 'stock is 43 - 2.5 - 12');
SELECT throws_ok(
  $$SELECT public.create_order_atomic('c0000000-0000-4000-8000-0000000000c1',
      '[{"variant_id":"c0000000-0000-4000-8000-000000000003","quantity":10},{"variant_id":"c0000000-0000-4000-8000-000000000003","quantity":10}]', '{"state":"Delhi"}', 0)$$,
  'P0001', 'NO_CONTINUOUS_LENGTH', '20 m in stock but no single roll holds 20 m');
SELECT throws_ok(
  $$SELECT public.create_order_atomic('c0000000-0000-4000-8000-0000000000c1',
      '[{"variant_id":"c0000000-0000-4000-8000-000000000003","quantity":40}]', '{"state":"Delhi"}', 0)$$,
  'P0001', 'INSUFFICIENT_STOCK', 'more than the total stock');

-- Releasing an uncut line returns the metres to the same roll.
SELECT is((public.cancel_order_restock((SELECT id FROM t_orders WHERE tag = 'o1'), true) ->> 'ok'), 'true', 'admin cancels o1');
SELECT is((SELECT remaining_m FROM public.fabric_rolls WHERE dye_lot = 'LOT-B'), 3.00::numeric(10,2), 'the 2.5 m goes back on lot B');
SELECT is((SELECT status::text FROM public.fabric_rolls WHERE dye_lot = 'LOT-B'), 'active', 'lot B is a full roll again');
SELECT is((SELECT c.status::text FROM public.order_item_cuts c JOIN t_orders t ON t.id = c.order_id WHERE t.tag = 'o1'),
          'released', 'the cut is marked released');

-- Cut sheet: unpaid lines cannot be cut.
SELECT throws_ok(
  $$SELECT public.mark_order_item_cut((SELECT c.id FROM public.order_item_cuts c JOIN t_orders t ON t.id = c.order_id WHERE t.tag = 'o2'))$$,
  'P0001', 'ORDER_NOT_PAID', 'an unpaid line cannot be cut');
UPDATE public.orders SET is_paid = true, status = 'paid' WHERE id = (SELECT id FROM t_orders WHERE tag = 'o2');
SELECT is((public.mark_order_item_cut((SELECT c.id FROM public.order_item_cuts c JOIN t_orders t ON t.id = c.order_id WHERE t.tag = 'o2')) ->> 'ok'),
          'true', 'a paid line can be marked cut');

-- Cut boundary: the customer cannot cancel once fabric is cut.
SELECT pg_temp.act_as('authenticated', 'c0000000-0000-4000-8000-0000000000c1');
SELECT is((public.request_order_cancellation((SELECT id FROM t_orders WHERE tag = 'o2')) ->> 'error'),
          'ALREADY_CUT', 'customer cancellation is refused after the cut');
RESET role;

-- Restocking a cut piece creates a new remnant roll of the same dye lot.
SELECT is((public.cancel_order_restock((SELECT id FROM t_orders WHERE tag = 'o2'), true) ->> 'ok'), 'true', 'admin cancels o2 with restock');
SELECT is((SELECT remaining_m FROM public.fabric_rolls WHERE dye_lot = 'LOT-C' AND parent_roll_id IS NULL),
          18.00::numeric(10,2), 'the parent roll stays at 18 m');
SELECT is((SELECT remaining_m FROM public.fabric_rolls WHERE dye_lot = 'LOT-C' AND parent_roll_id IS NOT NULL),
          12.00::numeric(10,2), 'the 12 m piece becomes its own roll');

-- Piece products keep plain stock.
INSERT INTO t_orders SELECT 'o3', public.create_order_atomic('c0000000-0000-4000-8000-0000000000c1',
  '[{"variant_id":"c0000000-0000-4000-8000-000000000013","quantity":2}]', '{"state":"Delhi"}', 0);
SELECT is((SELECT stock_quantity FROM public.product_variants WHERE id = 'c0000000-0000-4000-8000-000000000013'),
          3.00::numeric(10,2), 'two pieces leave three');
SELECT is((SELECT uqc FROM public.order_items i JOIN t_orders t ON t.id = i.order_id WHERE t.tag = 'o3'),
          'PCS', 'UQC is PCS for pieces');
SELECT throws_ok($$SELECT public.adjust_stock('c0000000-0000-4000-8000-000000000003', 5)$$,
                 '22023', 'USE_ROLLS', 'metre stock cannot be adjusted outside the rolls');

-- Stocktake and retire
SELECT is(public.admin_set_roll_remaining((SELECT id FROM public.fabric_rolls WHERE dye_lot = 'LOT-A'), 9.5, 'measured'),
          9.5::numeric, 'stocktake sets the measured length');
SELECT throws_ok($$SELECT public.admin_set_roll_remaining((SELECT id FROM public.fabric_rolls WHERE dye_lot = 'LOT-A'), 11)$$,
                 'P0001', 'EXCEEDS_ROLL_LENGTH', 'cannot exceed the roll length');
SELECT lives_ok($$SELECT public.admin_retire_roll((SELECT id FROM public.fabric_rolls WHERE dye_lot = 'LOT-A'), 'damaged')$$,
                'a roll with no open cuts can be retired');
SELECT is((SELECT stock_quantity FROM public.product_variants WHERE id = 'c0000000-0000-4000-8000-000000000003'),
          33.00::numeric(10,2), 'retired rolls leave the sellable stock (3 + 18 + 12)');

-- Permissions
SELECT ok(NOT has_function_privilege('authenticated', 'public.admin_receive_roll(uuid, numeric, text, text, uuid)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.mark_order_item_cut(uuid, uuid)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.release_order_item_stock(uuid, boolean)', 'EXECUTE'),
          'roll functions are not callable from the public API');
SELECT ok(NOT has_table_privilege('anon', 'public.fabric_rolls', 'SELECT')
          AND NOT has_table_privilege('authenticated', 'public.fabric_rolls', 'INSERT')
          AND NOT has_table_privilege('authenticated', 'public.order_item_cuts', 'UPDATE')
          AND NOT has_table_privilege('authenticated', 'public.roll_events', 'TRUNCATE'),
          'rolls are read-only to signed-in users and invisible to anon');
SELECT pg_temp.act_as('authenticated', 'c0000000-0000-4000-8000-0000000000c1');
SELECT is((SELECT count(*) FROM public.fabric_rolls), 0::bigint, 'a customer sees no rolls');
RESET role;

SELECT * FROM finish();
ROLLBACK;
