-- Lead CRM inboxes (contact_inquiries, wholesale_applications) and
-- server-internal tables (auth_attempts, pending_emails).
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(14);

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

-- Legacy inboxes: since 0054 the forms write through public.lead_capture
-- (service role), so the public can no longer insert here. Existing rows are
-- seeded as the table owner for the read checks below.
INSERT INTO public.contact_inquiries (first_name, last_name, email, message)
  VALUES ('Lead', 'One', 'lead@example.test', 'pgtap lead');
INSERT INTO public.wholesale_applications (business_name, email, requirements)
  VALUES ('pgTAP Boutique', 'b2b@example.test', 'pgtap rolls');

SELECT pg_temp.act_as('anon');
SELECT is(pg_temp.attempt(
  $$INSERT INTO public.contact_inquiries (first_name, last_name, email, message)
    VALUES ('Spam', 'Bot', 'bot@example.test', 'spam')$$),
  'denied', 'anon can no longer write the legacy Contact Us inbox');
SELECT is(pg_temp.attempt(
  $$INSERT INTO public.wholesale_applications (business_name, email, requirements)
    VALUES ('Spam Co', 'bot@example.test', 'spam')$$),
  'denied', 'anon can no longer write the legacy wholesale inbox');
SELECT is((SELECT count(*) FROM public.contact_inquiries), 0::bigint, 'anon cannot read leads');
SELECT is((SELECT count(*) FROM public.wholesale_applications), 0::bigint, 'anon cannot read wholesale applications');
SELECT ok(pg_temp.attempt($$DELETE FROM public.contact_inquiries$$) IN ('denied', '0 rows'),
          'anon cannot delete leads');
SELECT throws_ok($$SELECT count(*) FROM public.auth_attempts$$, '42501', NULL,
                 'anon cannot read the login lockout table');
SELECT throws_ok($$SELECT count(*) FROM public.pending_emails$$, '42501', NULL,
                 'anon cannot read the e-mail outbox');
RESET ROLE;

SELECT pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111111');
SELECT is((SELECT count(*) FROM public.contact_inquiries), 0::bigint, 'customer_a cannot read leads');
SELECT ok(pg_temp.attempt($$UPDATE public.wholesale_applications SET status = 'approved'$$) IN ('denied', '0 rows'),
          'customer_a cannot approve wholesale applications');
SELECT throws_ok($$SELECT count(*) FROM public.pending_emails$$, '42501', NULL,
                 'customer_a cannot read the e-mail outbox');
RESET ROLE;

SELECT pg_temp.act_as('authenticated', '33333333-3333-4333-8333-333333333333');
SELECT is((SELECT count(*) FROM public.contact_inquiries WHERE message = 'pgtap lead'), 1::bigint,
          'owner_admin reads the Contact Us lead');
SELECT is((SELECT count(*) FROM public.wholesale_applications WHERE requirements = 'pgtap rolls'), 1::bigint,
          'owner_admin reads the wholesale application');
RESET ROLE;

-- Destructive check last: if TRUNCATE is allowed it empties the table.
SELECT pg_temp.act_as('anon');
SELECT throws_ok($$TRUNCATE public.contact_inquiries$$, '42501', NULL, 'anon cannot TRUNCATE leads');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.contact_inquiries WHERE message = 'pgtap lead'), 1::bigint,
          'lead survives the delete and truncate attempts');

SELECT * FROM finish();
ROLLBACK;
