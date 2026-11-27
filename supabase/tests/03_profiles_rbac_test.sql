-- Profiles and admin role: horizontal isolation and vertical escalation.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(13);

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
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'customer-b@example.test'),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'owner@example.test');
INSERT INTO public.user_roles (user_id, role) VALUES ('33333333-3333-4333-8333-333333333333', 'admin');
UPDATE public.profiles SET full_name = 'Customer B' WHERE id = '22222222-2222-4222-8222-222222222222';

-- Sign-up trigger created a profile for every new user, as non-admin.
SELECT is((SELECT role::text FROM public.profiles WHERE id = '11111111-1111-4111-8111-111111111111'),
          'retail', 'new sign-up gets the retail role');

-- customer_a
SELECT pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111111');
SELECT is((SELECT count(*) FROM public.profiles), 1::bigint, 'customer_a sees only own profile');
SELECT is(public.is_admin(), false, 'is_admin() is false for customer_a');
SELECT is(pg_temp.attempt(
  $$UPDATE public.profiles SET full_name = 'Customer A' WHERE id = '11111111-1111-4111-8111-111111111111'$$),
  '1 rows', 'customer_a can update own name');
SELECT throws_ok(
  $$UPDATE public.profiles SET role = 'admin' WHERE id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', NULL, 'customer_a cannot make self admin');
SELECT ok(pg_temp.attempt(
  $$UPDATE public.profiles SET full_name = 'pwned' WHERE id = '22222222-2222-4222-8222-222222222222'$$) IN ('denied', '0 rows'),
  'customer_a UPDATE of customer_b''s profile changes nothing');
SELECT throws_ok(
  $$INSERT INTO public.profiles (id, role) VALUES (gen_random_uuid(), 'admin')$$,
  '42501', NULL, 'customer_a cannot insert an admin profile');
RESET ROLE;
SELECT is((SELECT full_name FROM public.profiles WHERE id = '11111111-1111-4111-8111-111111111111'),
          'Customer A', 'customer_a''s own name change was saved');
SELECT is((SELECT full_name FROM public.profiles WHERE id = '22222222-2222-4222-8222-222222222222'),
          'Customer B', 'customer_b''s profile is unchanged');
SELECT is((SELECT role::text FROM public.profiles WHERE id = '11111111-1111-4111-8111-111111111111'),
          'retail', 'customer_a is still retail');

-- anon
SELECT pg_temp.act_as('anon');
SELECT is((SELECT count(*) FROM public.profiles), 0::bigint, 'anon sees no profiles');
RESET ROLE;

-- owner_admin
SELECT pg_temp.act_as('authenticated', '33333333-3333-4333-8333-333333333333');
SELECT is(public.is_admin(), true, 'is_admin() is true for owner_admin');
SELECT ok((SELECT count(*) FROM public.profiles) >= 3, 'owner_admin reads all profiles');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
