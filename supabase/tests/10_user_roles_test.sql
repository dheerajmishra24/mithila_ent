-- Migration 0047 (RLS-06): user_roles is the only source of the admin role.
-- Run: npx supabase test db   (local Docker stack only, never production)
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(17);

CREATE FUNCTION pg_temp.act_as(p_role text, p_sub uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role, 'aal', 'aal2', 'session_id', gen_random_uuid(), 'amr', json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint)))::text, true);
  PERFORM set_config('role', p_role, true);
END $$;

INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'customer-a@example.test'),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'owner@example.test');

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
SELECT ok(NOT has_table_privilege('anon', 'public.user_roles', 'SELECT'), 'anon cannot read user_roles');
SELECT ok(NOT has_table_privilege('authenticated', 'public.user_roles', 'SELECT')
          AND NOT has_table_privilege('authenticated', 'public.user_roles', 'INSERT')
          AND NOT has_table_privilege('authenticated', 'public.user_roles', 'UPDATE'),
          'authenticated cannot read or write user_roles');
SELECT ok(has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'EXECUTE'),
          'supabase_auth_admin can run the access-token hook');
SELECT ok(NOT has_function_privilege('authenticated', 'public.custom_access_token_hook(jsonb)', 'EXECUTE')
          AND has_table_privilege('supabase_auth_admin', 'public.user_roles', 'SELECT')
          AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles'
                        AND 'supabase_auth_admin' = ANY (roles) AND cmd = 'SELECT'),
          'authenticated cannot run the hook; supabase_auth_admin can read user_roles through a policy');

SELECT pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111111');
SELECT throws_ok(
  $$INSERT INTO public.user_roles (user_id, role) VALUES ('11111111-1111-4111-8111-111111111111', 'admin')$$,
  '42501', NULL, 'customer cannot grant themselves admin via user_roles');
SELECT is((SELECT public.is_admin()), false, 'customer is not admin');
RESET ROLE;

-- ---------------------------------------------------------------------------
-- Mirror and guard
-- ---------------------------------------------------------------------------
INSERT INTO public.user_roles (user_id, role) VALUES ('33333333-3333-4333-8333-333333333333', 'admin');
SELECT is((SELECT role::text FROM public.profiles WHERE id = '33333333-3333-4333-8333-333333333333'),
          'admin', 'granting in user_roles mirrors into profiles.role');

SELECT throws_ok(
  $$UPDATE public.profiles SET role = 'admin' WHERE id = '11111111-1111-4111-8111-111111111111'$$,
  '42501', NULL, 'profiles.role cannot be changed directly, even by postgres');
SELECT is(current_setting('app.user_roles_sync', true), 'off', 'sync flag is switched off after the mirror');

SELECT pg_temp.act_as('authenticated', '33333333-3333-4333-8333-333333333333');
SELECT is((SELECT public.is_admin()), true, 'owner JWT is admin');
SELECT is((SELECT count(*)::int FROM public.contact_inquiries), 0, 'admin policy on contact_inquiries uses is_admin()');
RESET ROLE;

-- ---------------------------------------------------------------------------
-- Hook output (called as the owner: the test runner cannot SET ROLE to
-- supabase_auth_admin; its EXECUTE grant and SELECT policy are asserted above)
-- ---------------------------------------------------------------------------
SELECT is(
  (public.custom_access_token_hook(jsonb_build_object(
      'user_id', '33333333-3333-4333-8333-333333333333',
      'claims', jsonb_build_object('role', 'authenticated'))) #>> '{claims,user_role}'),
  'admin', 'hook adds user_role=admin for the owner');
SELECT is(
  (public.custom_access_token_hook(jsonb_build_object(
      'user_id', '11111111-1111-4111-8111-111111111111',
      'claims', jsonb_build_object('role', 'authenticated'))) #>> '{claims,role}'),
  'authenticated', 'hook keeps existing claims');
SELECT is(
  (public.custom_access_token_hook(jsonb_build_object(
      'user_id', '11111111-1111-4111-8111-111111111111',
      'claims', '{}'::jsonb)) #>> '{claims,user_role}'),
  'retail', 'hook adds user_role=retail for everyone else');

-- ---------------------------------------------------------------------------
-- Revoke
-- ---------------------------------------------------------------------------
DELETE FROM public.user_roles WHERE user_id = '33333333-3333-4333-8333-333333333333';
SELECT is((SELECT role::text FROM public.profiles WHERE id = '33333333-3333-4333-8333-333333333333'),
          'retail', 'removing the user_roles row demotes the profile');
SELECT pg_temp.act_as('authenticated', '33333333-3333-4333-8333-333333333333');
SELECT is((SELECT public.is_admin()), false, 'demoted owner is no longer admin');
RESET ROLE;

SELECT is(
  (SELECT array_agg(tablename || ':' || policyname ORDER BY 1) FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual, '') || coalesce(with_check, '')) ~ 'FROM profiles'
      AND (coalesce(qual, '') || coalesce(with_check, '')) ~ 'admin'),
  NULL, 'no policy derives admin from profiles.role');

SELECT * FROM finish();
ROLLBACK;
