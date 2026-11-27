-- Catalog CMS and discount codes: public read of active catalog only,
-- owner-only writes, discount codes never readable by customers.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(16);

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

INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'customer-a@example.test'),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'owner@example.test');
INSERT INTO public.user_roles (user_id, role) VALUES ('33333333-3333-4333-8333-333333333333', 'admin');

INSERT INTO public.products (id, slug, title, status) VALUES
  ('d1000000-0000-4000-8000-000000000001', 'pgtap-active-silk', 'pgTAP Active Silk', 'active'),
  ('d2000000-0000-4000-8000-000000000002', 'pgtap-draft-silk',  'pgTAP Draft Silk',  'draft');
INSERT INTO public.product_variants (id, product_id, sku, color, price, stock_quantity) VALUES
  ('e1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'PGTAP-ACT', 'Ivory', 900, 10),
  ('e2000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000002', 'PGTAP-DRF', 'Ivory', 900, 10);
INSERT INTO public.discounts (code, type, value, target_type, is_active) VALUES
  ('PGTAPSECRET', 'percentage', 50, 'all', true);

-- anon storefront
SELECT pg_temp.act_as('anon');
SELECT is((SELECT count(*) FROM public.products WHERE slug LIKE 'pgtap-%'), 1::bigint,
          'anon sees the active product only');
SELECT is((SELECT count(*) FROM public.product_variants WHERE sku = 'PGTAP-DRF'), 0::bigint,
          'anon cannot read variants (price/SKU) of a draft product');
SELECT is((SELECT count(*) FROM public.discounts), 0::bigint, 'anon cannot list discount codes');
SELECT throws_ok($$SELECT public.validate_discount('PGTAPSECRET', 1000)$$, '42501', NULL,
          'anon cannot probe discount codes (0049; checkout validates server-side)');
SELECT throws_ok($$INSERT INTO public.categories (slug, name) VALUES ('pgtap-x', 'x')$$,
                 '42501', NULL, 'anon cannot create categories');
RESET ROLE;

-- customer_a (signed in, not admin)
SELECT pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111111');
SELECT is((SELECT count(*) FROM public.discounts), 0::bigint, 'customer_a cannot list discount codes');
SELECT throws_ok($$INSERT INTO public.products (slug, title, status) VALUES ('pgtap-evil', 'Evil', 'active')$$,
                 '42501', NULL, 'customer_a cannot create products');
SELECT ok(pg_temp.attempt(
  $$UPDATE public.product_variants SET price = 1 WHERE id = 'e1000000-0000-4000-8000-000000000001'$$) IN ('denied', '0 rows'),
  'customer_a cannot reprice a variant');
SELECT ok(pg_temp.attempt(
  $$UPDATE public.discounts SET value = 100 WHERE code = 'PGTAPSECRET'$$) IN ('denied', '0 rows'),
  'customer_a cannot change a discount');
SELECT ok(pg_temp.attempt(
  $$DELETE FROM public.products WHERE id = 'd1000000-0000-4000-8000-000000000001'$$) IN ('denied', '0 rows'),
  'customer_a cannot delete products');
RESET ROLE;
SELECT is((SELECT price FROM public.product_variants WHERE id = 'e1000000-0000-4000-8000-000000000001'),
          900::numeric, 'variant price unchanged');
SELECT is((SELECT value FROM public.discounts WHERE code = 'PGTAPSECRET'), 50::numeric,
          'discount value unchanged');

-- owner_admin
SELECT pg_temp.act_as('authenticated', '33333333-3333-4333-8333-333333333333');
SELECT is((SELECT count(*) FROM public.products WHERE slug LIKE 'pgtap-%'), 2::bigint,
          'owner_admin sees draft and active products');
SELECT is((SELECT count(*) FROM public.discounts WHERE code = 'PGTAPSECRET'), 1::bigint,
          'owner_admin can read discount codes');
SELECT lives_ok($$INSERT INTO public.categories (slug, name) VALUES ('pgtap-owner-cat', 'Owner Cat')$$,
                'owner_admin can create categories');
SELECT is(pg_temp.attempt(
  $$UPDATE public.product_variants SET price = 950 WHERE id = 'e1000000-0000-4000-8000-000000000001'$$),
  '1 rows', 'owner_admin can reprice a variant');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
