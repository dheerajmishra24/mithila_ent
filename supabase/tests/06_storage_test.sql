-- Storage: product-images is public-read, owner-write, and bounded.
-- No private bucket (invoices, credit notes, exports) exists yet; see
-- docs/RLS_PGTAP_PROOF.md. Add tests here when one is created.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(7);

CREATE FUNCTION pg_temp.act_as(p_role text, p_sub uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role, 'aal', 'aal2', 'session_id', gen_random_uuid(), 'amr', json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint)))::text, true);
  PERFORM set_config('role', p_role, true);
END $$;

INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'customer-a@example.test'),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'owner@example.test');
INSERT INTO public.user_roles (user_id, role) VALUES ('33333333-3333-4333-8333-333333333333', 'admin');

SELECT is((SELECT public FROM storage.buckets WHERE id = 'product-images'), true,
          'product-images bucket exists and is public-read');
SELECT isnt((SELECT allowed_mime_types FROM storage.buckets WHERE id = 'product-images'), NULL,
            'product-images restricts MIME types');
SELECT isnt((SELECT file_size_limit FROM storage.buckets WHERE id = 'product-images'), NULL,
            'product-images has a file size limit');

SELECT pg_temp.act_as('anon');
SELECT throws_ok($$INSERT INTO storage.objects (bucket_id, name) VALUES ('product-images', 'pgtap/anon.png')$$,
                 '42501', NULL, 'anon cannot upload product images');
RESET ROLE;

SELECT pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111111');
SELECT throws_ok($$INSERT INTO storage.objects (bucket_id, name, owner) VALUES
                   ('product-images', 'pgtap/customer.png', '11111111-1111-4111-8111-111111111111')$$,
                 '42501', NULL, 'customer_a cannot upload product images');
RESET ROLE;

SELECT pg_temp.act_as('authenticated', '33333333-3333-4333-8333-333333333333');
SELECT lives_ok($$INSERT INTO storage.objects (bucket_id, name, owner) VALUES
                  ('product-images', 'pgtap/owner.png', '33333333-3333-4333-8333-333333333333')$$,
                'owner_admin can upload product images');
RESET ROLE;

SELECT is((SELECT array_agg(id ORDER BY id) FROM storage.buckets WHERE public AND id <> 'product-images'),
          NULL, 'no other bucket is public');

SELECT * FROM finish();
ROLLBACK;
