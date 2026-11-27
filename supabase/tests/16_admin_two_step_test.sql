-- Migration 0053: owner-portal two-step sign-in.
-- Run: npx supabase test db   (local Docker stack only, never production)
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(54);

-- Claims builder: aal, session and the age (hours) of the TOTP amr entry
-- (NULL = no TOTP entry).
CREATE FUNCTION pg_temp.claims(p_sub uuid, p_aal text, p_session uuid, p_totp_hours_ago numeric)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', p_sub, 'role', 'authenticated', 'aal', p_aal, 'session_id', p_session,
    'amr', CASE WHEN p_totp_hours_ago IS NULL
                THEN json_build_array(json_build_object('method', 'password', 'timestamp', extract(epoch from now())::bigint))
                ELSE json_build_array(
                       json_build_object('method', 'password', 'timestamp', extract(epoch from now())::bigint),
                       json_build_object('method', 'totp', 'timestamp',
                                         extract(epoch from now() - make_interval(secs => p_totp_hours_ago * 3600))::bigint))
           END)::text, true);
  PERFORM set_config('role', 'authenticated', true);
END $$;

CREATE FUNCTION pg_temp.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM set_config('role', 'service_role', true);
END $$;

CREATE FUNCTION pg_temp.h(p text) RETURNS text LANGUAGE sql AS $$
  SELECT encode(extensions.digest(p, 'sha256'), 'hex');
$$;

INSERT INTO auth.users (id, email) VALUES
  ('f0000000-0000-4000-8000-0000000000a1', 'ts-admin@example.test'),
  ('f0000000-0000-4000-8000-0000000000a2', 'ts-admin2@example.test'),
  ('f0000000-0000-4000-8000-0000000000c1', 'ts-cust@example.test');
INSERT INTO public.user_roles (user_id, role) VALUES
  ('f0000000-0000-4000-8000-0000000000a1', 'admin'),
  ('f0000000-0000-4000-8000-0000000000a2', 'admin');

CREATE TEMP TABLE t (k text PRIMARY KEY, v jsonb);
GRANT ALL ON t TO PUBLIC;

-- 1. Lock-down
SELECT ok((SELECT bool_and(relrowsecurity) FROM pg_class
            WHERE oid IN ('public.otp_challenges'::regclass, 'public.otp_deliveries'::regclass,
                          'public.admin_step_up'::regclass, 'public.admin_otp_phones'::regclass)), 'RLS on all four tables');
SELECT ok(NOT has_table_privilege('authenticated', 'public.otp_challenges', 'SELECT'), 'authenticated cannot read codes');
SELECT ok(NOT has_table_privilege('authenticated', 'public.admin_step_up', 'INSERT'), 'authenticated cannot write step-ups');
SELECT ok(NOT has_table_privilege('anon', 'public.admin_otp_phones', 'SELECT'), 'anon cannot read phones');
SELECT ok(NOT has_function_privilege('authenticated', 'public.otp_issue(uuid,uuid,text,text,text)', 'EXECUTE'), 'authenticated cannot issue codes');
SELECT ok(NOT has_function_privilege('authenticated', 'public.otp_verify(uuid,uuid,uuid,text)', 'EXECUTE'), 'authenticated cannot verify codes');
SELECT ok(NOT has_function_privilege('anon', 'public.otp_delivery_status(text,text)', 'EXECUTE'), 'anon cannot touch delivery status');
SELECT ok(NOT has_function_privilege('anon', 'public.admin_two_step_status()', 'EXECUTE'), 'anon cannot read two-step status');
SELECT ok((SELECT 'search_path=""' = ANY(proconfig) FROM pg_proc WHERE oid = 'public.is_admin()'::regprocedure), 'is_admin pins search_path');
SELECT ok((SELECT 'search_path=""' = ANY(proconfig) FROM pg_proc WHERE oid = 'public.has_recent_second_factor()'::regprocedure), 'has_recent_second_factor pins search_path');

-- 2. is_admin needs role AND a recent second factor
SELECT pg_temp.claims('f0000000-0000-4000-8000-0000000000a1', 'aal1', gen_random_uuid(), NULL);
SELECT is(public.is_admin(), false, 'admin with password only: not admin');
SELECT is((public.admin_two_step_status() ->> 'admin_role')::boolean, true, 'status: admin role seen');
SELECT is((public.admin_two_step_status() ->> 'second_factor')::boolean, false, 'status: no second factor');
SELECT pg_temp.claims('f0000000-0000-4000-8000-0000000000a1', 'aal2', gen_random_uuid(), 0.1);
SELECT is(public.is_admin(), true, 'admin with fresh TOTP (aal2): admin');
SELECT pg_temp.claims('f0000000-0000-4000-8000-0000000000a1', 'aal2', gen_random_uuid(), 13);
SELECT is(public.is_admin(), false, 'TOTP older than 12 h: not admin');
SELECT pg_temp.claims('f0000000-0000-4000-8000-0000000000a1', 'aal1', gen_random_uuid(), 0.1);
SELECT is(public.is_admin(), false, 'TOTP amr without aal2: not admin');
SELECT pg_temp.claims('f0000000-0000-4000-8000-0000000000c1', 'aal2', gen_random_uuid(), 0.1);
SELECT is(public.is_admin(), false, 'customer with TOTP: not admin');
SELECT is((public.admin_two_step_status() ->> 'admin_role')::boolean, false, 'status: customer has no admin role');
-- Malformed amr does not error
SELECT set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-4000-8000-0000000000a1', 'role', 'authenticated',
  'aal', 'aal2', 'amr', 'nonsense')::text, true);
SELECT is(public.is_admin(), false, 'malformed amr: not admin, no error');
-- Admin RLS follows is_admin(): a password-only admin cannot read enquiries.
SELECT pg_temp.as_service();
INSERT INTO public.contact_inquiries (id, first_name, last_name, email, message)
VALUES ('f0000000-0000-4000-8000-0000000000e1', 'Two', 'Step', 'ts-lead@example.test', 'hello');
SELECT pg_temp.claims('f0000000-0000-4000-8000-0000000000a1', 'aal1', gen_random_uuid(), NULL);
SELECT is((SELECT count(*) FROM public.contact_inquiries WHERE id = 'f0000000-0000-4000-8000-0000000000e1'), 0::bigint,
  'password-only admin: RLS hides enquiries');
SELECT pg_temp.claims('f0000000-0000-4000-8000-0000000000a1', 'aal2', gen_random_uuid(), 0.1);
SELECT is((SELECT count(*) FROM public.contact_inquiries WHERE id = 'f0000000-0000-4000-8000-0000000000e1'), 1::bigint,
  'admin with fresh TOTP: RLS shows enquiries');

-- 3. Step-up rows are per session
SELECT pg_temp.as_service();
INSERT INTO public.admin_step_up (session_id, user_id, method, expires_at) VALUES
  ('f0000000-0000-4000-8000-000000000051', 'f0000000-0000-4000-8000-0000000000a1', 'whatsapp', now() + interval '1 hour'),
  ('f0000000-0000-4000-8000-000000000052', 'f0000000-0000-4000-8000-0000000000a1', 'sms', now() - interval '1 minute');
SELECT pg_temp.claims('f0000000-0000-4000-8000-0000000000a1', 'aal1', 'f0000000-0000-4000-8000-000000000051', NULL);
SELECT is(public.is_admin(), true, 'WhatsApp step-up for this session: admin');
SELECT pg_temp.claims('f0000000-0000-4000-8000-0000000000a1', 'aal1', 'f0000000-0000-4000-8000-000000000053', NULL);
SELECT is(public.is_admin(), false, 'step-up of another session does not count');
SELECT pg_temp.claims('f0000000-0000-4000-8000-0000000000a1', 'aal1', 'f0000000-0000-4000-8000-000000000052', NULL);
SELECT is(public.is_admin(), false, 'expired step-up does not count');
SELECT pg_temp.claims('f0000000-0000-4000-8000-0000000000a2', 'aal1', 'f0000000-0000-4000-8000-000000000051', NULL);
SELECT is(public.is_admin(), false, 'another admin cannot reuse that session id');

-- 4. Issuing codes
SELECT pg_temp.as_service();
SELECT throws_like($$ SELECT public.otp_issue('f0000000-0000-4000-8000-0000000000c1', gen_random_uuid(), 'phone_enrol', '+919876543210', pg_temp.h('x')) $$,
  '%NOT_ADMIN%', 'customers cannot get codes');
SELECT throws_like($$ SELECT public.otp_issue('f0000000-0000-4000-8000-0000000000a1', gen_random_uuid(), 'admin_sign_in', NULL, pg_temp.h('x')) $$,
  '%PHONE_NOT_ENROLLED%', 'sign-in code needs an enrolled phone');
SELECT throws_like($$ SELECT public.otp_issue('f0000000-0000-4000-8000-0000000000a1', gen_random_uuid(), 'phone_enrol', '+15551234567', pg_temp.h('x')) $$,
  '%INVALID_PHONE%', 'only Indian mobiles');
SELECT throws_like($$ SELECT public.otp_issue('f0000000-0000-4000-8000-0000000000a1', gen_random_uuid(), 'reset', '+919876543210', pg_temp.h('x')) $$,
  '%INVALID_PURPOSE%', 'purpose is checked');
SELECT throws_like($$ SELECT public.otp_issue('f0000000-0000-4000-8000-0000000000a1', gen_random_uuid(), 'phone_enrol', '+919876543210', 'not-a-hash') $$,
  '%otp_challenges_code_hash_check%', 'only a hex SHA-256 hash is stored');

INSERT INTO t VALUES ('c1', public.otp_issue('f0000000-0000-4000-8000-0000000000a1', 'f0000000-0000-4000-8000-000000000061',
  'phone_enrol', '+919876543210', pg_temp.h('111111')));
SELECT is((SELECT v ->> 'phone_last4' FROM t WHERE k = 'c1'), '3210', 'issue returns last 4 digits');
SELECT is((SELECT (v ->> 'attempts_left')::int FROM t WHERE k = 'c1'), 5, 'five tries');

-- 5. Wrong codes, resend keeps the count, lock after five
CREATE FUNCTION pg_temp.v(p_k text, p_code text, p_session uuid DEFAULT 'f0000000-0000-4000-8000-000000000061')
RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.otp_verify((SELECT (v ->> 'challenge_id')::uuid FROM t WHERE k = p_k),
                           'f0000000-0000-4000-8000-0000000000a1', p_session, pg_temp.h(p_code));
$$;
SELECT is(pg_temp.v('c1', '000000') ->> 'reason', 'WRONG_CODE', 'wrong code 1');
SELECT pg_temp.v('c1', '000001'); SELECT pg_temp.v('c1', '000002');
SELECT is((pg_temp.v('c1', '000003') ->> 'attempts_left')::int, 1, 'four wrong: one try left');
SELECT is(pg_temp.v('c1', '111111', 'f0000000-0000-4000-8000-000000000069') ->> 'reason', 'NOT_FOUND', 'right code, wrong session: refused');
SELECT throws_like($$ SELECT public.otp_issue('f0000000-0000-4000-8000-0000000000a1', 'f0000000-0000-4000-8000-000000000061',
  'phone_enrol', '+919876543210', pg_temp.h('222222')) $$, '%OTP_RESEND_TOO_SOON%', 'no resend within 30 s');
UPDATE public.otp_challenges SET last_sent_at = now() - interval '1 minute'
 WHERE id = (SELECT (v ->> 'challenge_id')::uuid FROM t WHERE k = 'c1');
SELECT is((public.otp_issue('f0000000-0000-4000-8000-0000000000a1', 'f0000000-0000-4000-8000-000000000061',
  'phone_enrol', '+919876543210', pg_temp.h('222222')) ->> 'attempts_left')::int, 1, 'resend keeps the failure count');
SELECT is(pg_temp.v('c1', '111111') ->> 'reason', 'LOCKED', 'old code after resend is wrong, fifth failure locks');
SELECT is(pg_temp.v('c1', '222222') ->> 'reason', 'LOCKED', 'locked: even the right code fails');
SELECT throws_like($$ SELECT public.otp_issue('f0000000-0000-4000-8000-0000000000a1', 'f0000000-0000-4000-8000-000000000062',
  'phone_enrol', '+919876543210', pg_temp.h('333333')) $$, '%OTP_LOCKED%', 'no new code for 15 min after a lock');

-- 6. Successful phone enrolment, then a sign-in code
UPDATE public.otp_challenges SET locked_at = now() - interval '16 minutes', created_at = now() - interval '2 hours'
 WHERE user_id = 'f0000000-0000-4000-8000-0000000000a1';
INSERT INTO t VALUES ('c2', public.otp_issue('f0000000-0000-4000-8000-0000000000a1', 'f0000000-0000-4000-8000-000000000062',
  'phone_enrol', '+919876543210', pg_temp.h('444444')));
SELECT is(pg_temp.v('c2', '444444', 'f0000000-0000-4000-8000-000000000062') ->> 'ok', 'true', 'right code accepted');
SELECT is(pg_temp.v('c2', '444444', 'f0000000-0000-4000-8000-000000000062') ->> 'reason', 'USED', 'single use');
SELECT is((SELECT phone_e164 FROM public.admin_otp_phones WHERE user_id = 'f0000000-0000-4000-8000-0000000000a1'),
  '+919876543210', 'phone enrolled');

INSERT INTO t VALUES ('c3', public.otp_issue('f0000000-0000-4000-8000-0000000000a1', 'f0000000-0000-4000-8000-000000000063',
  'admin_sign_in', NULL, pg_temp.h('555555')));
SELECT public.otp_delivery_record((SELECT (v ->> 'challenge_id')::uuid FROM t WHERE k = 'c3'), 'whatsapp', 'wamid.TEST1', 'sent');
SELECT is(public.otp_fallback_needed((SELECT (v ->> 'challenge_id')::uuid FROM t WHERE k = 'c3'), 1::smallint), true,
  'WhatsApp only "sent": SMS fallback needed');
SELECT is(public.otp_fallback_needed((SELECT (v ->> 'challenge_id')::uuid FROM t WHERE k = 'c3'), 2::smallint), false,
  'fallback for a replaced code: not sent');
SELECT is(public.otp_delivery_status('wamid.TEST1', 'delivered'), true, 'status -> delivered');
SELECT is(public.otp_delivery_status('wamid.TEST1', 'sent'), false, 'status never goes backwards');
SELECT is(public.otp_fallback_needed((SELECT (v ->> 'challenge_id')::uuid FROM t WHERE k = 'c3'), 1::smallint), false,
  'delivered on WhatsApp: no SMS');
SELECT is(pg_temp.v('c3', '555555', 'f0000000-0000-4000-8000-000000000063') ->> 'ok', 'true', 'sign-in code accepted');
SELECT is((SELECT method FROM public.admin_step_up WHERE session_id = 'f0000000-0000-4000-8000-000000000063'), 'whatsapp',
  'step-up recorded for the session, by WhatsApp');
SELECT pg_temp.claims('f0000000-0000-4000-8000-0000000000a1', 'aal1', 'f0000000-0000-4000-8000-000000000063', NULL);
SELECT is(public.is_admin(), true, 'that session is now admin');
SELECT is(public.admin_two_step_status() ->> 'phone_last4', '3210', 'status shows the phone last 4');

-- 7. Expiry and the hourly limit
SELECT pg_temp.as_service();
INSERT INTO t VALUES ('c4', public.otp_issue('f0000000-0000-4000-8000-0000000000a1', 'f0000000-0000-4000-8000-000000000064',
  'admin_sign_in', NULL, pg_temp.h('666666')));
UPDATE public.otp_challenges SET expires_at = now() - interval '1 second'
 WHERE id = (SELECT (v ->> 'challenge_id')::uuid FROM t WHERE k = 'c4');
SELECT is(pg_temp.v('c4', '666666', 'f0000000-0000-4000-8000-000000000064') ->> 'reason', 'EXPIRED', 'expired code refused');
SELECT throws_like($$ SELECT public.otp_issue('f0000000-0000-4000-8000-0000000000a1', gen_random_uuid(),
  'admin_sign_in', NULL, pg_temp.h('777777')) $$, '%OTP_RATE_LIMITED%', 'fourth new code in an hour refused');

SELECT * FROM finish();
ROLLBACK;
