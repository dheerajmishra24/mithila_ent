-- Migration 0055: DPDP consent and requests, erasure, courier tracking, e-mail suppression.
-- Run: npx supabase test db   (local Docker stack only, never production)
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(71);

CREATE FUNCTION pg_temp.as_user(p_sub uuid, p_second_factor boolean DEFAULT true) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', p_sub, 'role', 'authenticated', 'aal', CASE WHEN p_second_factor THEN 'aal2' ELSE 'aal1' END,
    'session_id', gen_random_uuid(),
    'amr', CASE WHEN p_second_factor
                THEN json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint))
                ELSE json_build_array(json_build_object('method', 'password', 'timestamp', extract(epoch from now())::bigint)) END
  )::text, true);
  PERFORM set_config('role', 'authenticated', true);
END $$;

CREATE FUNCTION pg_temp.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM set_config('role', 'service_role', true);
END $$;

CREATE FUNCTION pg_temp.as_postgres() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'postgres', true);
END $$;

INSERT INTO auth.users (id, email) VALUES
  ('f0000000-0000-4000-8000-0000000000a1', 'pm-owner@example.test'),
  ('f0000000-0000-4000-8000-0000000000c1', 'pm-cust@example.test'),
  ('f0000000-0000-4000-8000-0000000000c2', 'pm-other@example.test'),
  ('f0000000-0000-4000-8000-0000000000c3', 'pm-busy@example.test');
INSERT INTO public.user_roles (user_id, role) VALUES ('f0000000-0000-4000-8000-0000000000a1', 'admin');

INSERT INTO public.orders (id, user_id, status, is_paid, subtotal, total_amount, shipping_address) VALUES
  ('f1000001-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000c1', 'paid', true, 1000, 1050,
   '{"firstName":"Pia","email":"pm-cust@example.test","phone":"+919800000001","address1":"1 Road","city":"Pune","state":"Maharashtra","pinCode":"411001"}'),
  ('f1000002-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-0000000000c2', 'paid', true, 500, 525,
   '{"firstName":"Om","address1":"2 Road","city":"Delhi","state":"Delhi","pinCode":"110001"}'),
  ('f1000003-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-0000000000c3', 'paid', true, 700, 735,
   '{"firstName":"Bo","address1":"3 Road","city":"Delhi","state":"Delhi","pinCode":"110001"}');

CREATE TEMP TABLE t (k text PRIMARY KEY, v jsonb);
GRANT ALL ON t TO PUBLIC;

-- 1. Lock-down -----------------------------------------------------------------
SELECT ok((SELECT bool_and(relrowsecurity) FROM pg_class
            WHERE oid IN ('public.consent_events'::regclass, 'public.privacy_requests'::regclass, 'public.shipment_events'::regclass,
                          'public.email_suppressions'::regclass, 'public.email_webhook_events'::regclass)), 'RLS on all five new tables');
SELECT ok(NOT has_table_privilege('anon', 'public.consent_events', 'SELECT'), 'anon cannot read consent');
SELECT ok(NOT has_table_privilege('anon', 'public.shipment_events', 'SELECT'), 'anon cannot read shipment scans');
SELECT ok(NOT has_table_privilege('authenticated', 'public.consent_events', 'INSERT'), 'consent is written only through consent_set');
SELECT ok(NOT has_table_privilege('authenticated', 'public.privacy_requests', 'UPDATE'), 'requests are changed only through functions');
SELECT ok(NOT has_table_privilege('authenticated', 'public.email_suppressions', 'DELETE'), 'suppressions are removed only by the owner function');
SELECT ok(NOT has_table_privilege('authenticated', 'public.email_webhook_events', 'SELECT'), 'webhook log is service-only');
SELECT ok(NOT has_table_privilege('authenticated', 'public.shipment_events', 'TRUNCATE'), 'no truncate on scans');
SELECT ok(NOT has_function_privilege('authenticated', 'public.shipment_apply(jsonb)', 'EXECUTE'), 'customers cannot fake courier updates');
SELECT ok(NOT has_function_privilege('authenticated', 'public.email_event_record(text,text,text,text[],text,text)', 'EXECUTE'), 'customers cannot fake bounces');
SELECT ok(NOT has_function_privilege('anon', 'public.consent_set(text,boolean,text)', 'EXECUTE'), 'anon cannot record consent');
SELECT ok(NOT has_function_privilege('anon', 'public.privacy_erase(uuid)', 'EXECUTE'), 'anon cannot erase');
SELECT ok((SELECT bool_and('search_path=""' = ANY(proconfig)) FROM pg_proc
            WHERE oid IN ('public.consent_set(text,boolean,text)'::regprocedure, 'public.privacy_request_create(text,text)'::regprocedure,
                          'public.privacy_request_withdraw(uuid)'::regprocedure, 'public.privacy_request_update(uuid,text,text)'::regprocedure,
                          'public.privacy_erase(uuid)'::regprocedure, 'public.shipment_apply(jsonb)'::regprocedure,
                          'public.email_event_record(text,text,text,text[],text,text)'::regprocedure, 'public.email_unsuppress(text)'::regprocedure)),
          'all new functions pin search_path');
SELECT ok((SELECT 'security_invoker=on' = ANY(reloptions) FROM pg_class WHERE oid = 'public.consent_current'::regclass), 'consent_current is security_invoker');

-- 2. Consent ledger -------------------------------------------------------------
SELECT pg_temp.as_service();
INSERT INTO t VALUES ('lead', public.lead_capture('{"source":"contact","email":"pm-cust@example.test","ad_consent":true,"gclid":"G-1","fbclid":"FB-1"}'));
SELECT pg_temp.as_postgres();
UPDATE public.leads SET status = 'qualified' WHERE id = (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'lead');
INSERT INTO public.lead_conversions (lead_id, platform, stage) SELECT (v->>'lead_id')::uuid, 'google', 'qualified' FROM t WHERE k = 'lead';

SELECT pg_temp.as_user('f0000000-0000-4000-8000-0000000000c1');
SELECT is((public.consent_set('marketing_email', true, '2026-11')->>'changed'), 'true', 'a person can opt in to one purpose');
SELECT is((public.consent_set('marketing_email', true, '2026-11')->>'changed'), 'false', 'the same choice again records nothing');
SELECT is((public.consent_set('ad_measurement', false, '2026-11')->>'leads_updated'), '1', 'withdrawing ad measurement reaches their lead');
SELECT is((SELECT count(*) FROM public.consent_events), 2::bigint, 'they see only their own two ledger rows');
SELECT is((SELECT granted FROM public.consent_current WHERE purpose = 'marketing_email'), true, 'current view shows the latest choice');
SELECT throws_ok($$SELECT public.consent_set('sell_my_data', true, '2026-11')$$, '22023', 'INVALID_CONSENT', 'unknown purposes are refused');
SELECT throws_ok($$SELECT public.consent_set('marketing_email', true, '<script>')$$, '22023', 'INVALID_CONSENT', 'notice version is validated');
SELECT pg_temp.as_postgres();
SELECT is((SELECT ad_consent FROM public.leads WHERE email = 'pm-cust@example.test'), false, 'lead no longer marked as consenting');
SELECT is((SELECT gclid FROM public.leads WHERE email = 'pm-cust@example.test'), NULL, 'click ids dropped on withdrawal');
SELECT is((SELECT c.status FROM public.lead_conversions c JOIN public.leads l ON l.id = c.lead_id WHERE l.email = 'pm-cust@example.test'), 'failed', 'queued conversion stopped');

SELECT pg_temp.as_user('f0000000-0000-4000-8000-0000000000c2');
SELECT is((SELECT count(*) FROM public.consent_events), 0::bigint, 'another customer cannot read their consent');
SELECT pg_temp.as_user('f0000000-0000-4000-8000-0000000000a1');
SELECT is((SELECT count(*) FROM public.consent_events WHERE user_id = 'f0000000-0000-4000-8000-0000000000c1'), 2::bigint, 'the owner can read the ledger');

-- 3. Requests ----------------------------------------------------------------------
SELECT pg_temp.as_user('f0000000-0000-4000-8000-0000000000c1');
INSERT INTO t VALUES ('erase', public.privacy_request_create('erasure', 'please delete'));
SELECT ok((SELECT v->>'ref' ~ '^PR-[0-9]{6}$' FROM t WHERE k = 'erase'), 'request gets a readable reference');
SELECT throws_ok($$SELECT public.privacy_request_create('erasure', null)$$, '22023', 'ALREADY_REQUESTED', 'one open deletion request at a time');
SELECT throws_ok($$SELECT public.privacy_request_create('correction', '')$$, '22023', 'DETAILS_REQUIRED', 'corrections need details');
SELECT throws_ok($$SELECT public.privacy_request_create('delete_everyone', 'x')$$, '22023', 'INVALID_KIND', 'unknown request kinds refused');
SELECT is((SELECT email_hash FROM public.privacy_requests WHERE id = (SELECT (v->>'id')::uuid FROM t WHERE k = 'erase')),
          encode(sha256(convert_to('pm-cust@example.test', 'UTF8')), 'hex'), 'request keeps a hash of the e-mail');
SELECT is((SELECT due_at::date - created_at::date FROM public.privacy_requests WHERE id = (SELECT (v->>'id')::uuid FROM t WHERE k = 'erase')), 30, 'reply due in 30 days');
SELECT throws_ok($$SELECT public.privacy_request_update((SELECT (v->>'id')::uuid FROM t WHERE k = 'erase'), 'rejected', 'no')$$, '42501', 'NOT_ADMIN', 'a customer cannot close requests');
SELECT throws_ok($$SELECT public.privacy_erase((SELECT (v->>'id')::uuid FROM t WHERE k = 'erase'))$$, '42501', 'NOT_ADMIN', 'a customer cannot run an erasure');
INSERT INTO t VALUES ('grief', public.privacy_request_create('grievance', 'You e-mailed me twice'));

SELECT pg_temp.as_user('f0000000-0000-4000-8000-0000000000c2');
SELECT is((SELECT count(*) FROM public.privacy_requests), 0::bigint, 'requests are private to their author');
SELECT throws_ok($$SELECT public.privacy_request_withdraw((SELECT (v->>'id')::uuid FROM t WHERE k = 'grief'))$$, 'P0002', 'REQUEST_NOT_OPEN', 'nobody else can withdraw them');
SELECT pg_temp.as_user('f0000000-0000-4000-8000-0000000000c1');
SELECT lives_ok($$SELECT public.privacy_request_withdraw((SELECT (v->>'id')::uuid FROM t WHERE k = 'grief'))$$, 'the author can withdraw an open request');

SELECT pg_temp.as_user('f0000000-0000-4000-8000-0000000000a1', false);
SELECT throws_ok($$SELECT public.privacy_erase((SELECT (v->>'id')::uuid FROM t WHERE k = 'erase'))$$, '42501', 'NOT_ADMIN', 'owner without a second factor cannot erase');
SELECT pg_temp.as_user('f0000000-0000-4000-8000-0000000000a1');
SELECT throws_ok($$SELECT public.privacy_request_update((SELECT (v->>'id')::uuid FROM t WHERE k = 'erase'), 'completed', 'done')$$, '22023', 'USE_ERASE', 'a deletion cannot be closed without erasing');
SELECT throws_ok($$SELECT public.privacy_request_update((SELECT (v->>'id')::uuid FROM t WHERE k = 'erase'), 'rejected', '')$$, '22023', 'REASON_REQUIRED', 'declining needs a reason');
SELECT throws_ok($$SELECT public.privacy_erase((SELECT (v->>'id')::uuid FROM t WHERE k = 'erase'))$$, '22023', 'ORDERS_IN_PROGRESS', 'no erasure while an order is paid but not delivered');

-- 4. Courier tracking ---------------------------------------------------------------
SELECT pg_temp.as_service();
INSERT INTO t VALUES ('s0', public.shipment_apply('{"awb":"AWB-EARLY-1","status_label":"PICKED UP","status_at":"2026-11-20T10:00:00+05:30","scans":[{"at":"2026-11-20T10:00:00+05:30","label":"PICKED UP","activity":"Picked up"}]}'));
SELECT is((SELECT v->>'matched' FROM t WHERE k = 's0'), 'false', 'scans for an AWB not on any order are kept, unmatched');
INSERT INTO t VALUES ('s1', public.shipment_apply('{"awb":"AWB100001","courier_name":"Delhivery","order_ref":"F1000001","status_label":"IN TRANSIT","status_at":"2026-11-21T09:00:00+05:30","etd":"2026-11-24T18:00:00+05:30","scans":[{"at":"2026-11-20T18:00:00+05:30","label":"PICKED UP","activity":"Picked up","location":"Delhi"},{"at":"2026-11-21T09:00:00+05:30","label":"IN TRANSIT","activity":"At hub"}]}'));
SELECT is((SELECT v->>'status_to' FROM t WHERE k = 's1'), 'shipped', 'matched by the short order number; paid moves to shipped');
SELECT is((SELECT awb_code FROM public.orders WHERE id = 'f1000001-0000-4000-8000-000000000001'), 'AWB100001', 'AWB recorded on the order');
SELECT is((SELECT count(*) FROM public.shipment_events WHERE awb_code = 'AWB100001'), 2::bigint, 'two scans stored');
SELECT lives_ok($$SELECT public.shipment_apply('{"awb":"AWB100001","order_ref":"F1000001","status_label":"IN TRANSIT","status_at":"2026-11-21T09:00:00+05:30","scans":[{"at":"2026-11-20T18:00:00+05:30","label":"PICKED UP","activity":"Picked up","location":"Delhi"},{"at":"2026-11-21T09:00:00+05:30","label":"IN TRANSIT","activity":"At hub"}]}')$$, 'redelivery accepted');
SELECT is((SELECT count(*) FROM public.shipment_events WHERE awb_code = 'AWB100001'), 2::bigint, '... and stores nothing twice');
INSERT INTO t VALUES ('s2', public.shipment_apply('{"awb":"AWB100001","status_label":"DELIVERED","status_at":"2026-11-23T12:00:00+05:30"}'));
SELECT is((SELECT status::text FROM public.orders WHERE id = 'f1000001-0000-4000-8000-000000000001'), 'delivered', 'delivered scan moves the order to delivered');
INSERT INTO t VALUES ('s3', public.shipment_apply('{"awb":"AWB100001","status_label":"IN TRANSIT","status_at":"2026-11-22T08:00:00+05:30"}'));
SELECT is((SELECT status::text || '/' || shipment_status FROM public.orders WHERE id = 'f1000001-0000-4000-8000-000000000001'), 'delivered/DELIVERED',
          'a late, older scan never moves the order back');
INSERT INTO t VALUES ('s4', public.shipment_apply('{"awb":"AWB200002","order_ref":"f1000002-0000-4000-8000-000000000002","status_label":"RTO INITIATED","status_at":"2026-11-22T08:00:00+05:30","is_return":true}'));
SELECT is((SELECT (v->>'problem')::boolean FROM t WHERE k = 's4'), true, 'return to origin is flagged for the owner');
SELECT is((SELECT status::text FROM public.orders WHERE id = 'f1000002-0000-4000-8000-000000000002'), 'paid', '... and does not mark the order shipped');
SELECT throws_ok($$SELECT public.shipment_apply('{"awb":"x'' OR 1=1 --"}')$$, '22023', 'INVALID_AWB', 'malformed AWB refused');

SELECT pg_temp.as_user('f0000000-0000-4000-8000-0000000000c1');
SELECT is((SELECT count(*) FROM public.shipment_events), 4::bigint, 'a customer sees all scans of their own shipment (late ones too), and only those');
SELECT pg_temp.as_user('f0000000-0000-4000-8000-0000000000c2');
SELECT is((SELECT count(*) FROM public.shipment_events WHERE awb_code = 'AWB100001'), 0::bigint, 'not another customer''s scans');

-- 5. E-mail suppression ----------------------------------------------------------------
SELECT pg_temp.as_service();
SELECT is((public.email_event_record('msg_a', 'email.bounced', 'em_1', ARRAY['Pm-Cust@Example.test'], 'Permanent', '550 unknown')->>'suppressed'), '1', 'hard bounce suppresses the address');
SELECT is((public.email_event_record('msg_a', 'email.bounced', 'em_1', ARRAY['pm-cust@example.test'], 'Permanent', '550 unknown')->>'new'), 'false', 'redelivered message is a no-op');
SELECT is((public.email_event_record('msg_b', 'email.bounced', 'em_2', ARRAY['busy@example.test'], 'Temporary', 'mailbox full')->>'suppressed'), '0', 'temporary bounce does not suppress');
SELECT is((public.email_event_record('msg_c', 'email.complained', 'em_3', ARRAY['pm-cust@example.test', 'not-an-address'], NULL, NULL)->>'suppressed'), '1', 'complaint suppresses; junk addresses ignored');
SELECT is((SELECT reason FROM public.email_suppressions WHERE email = 'pm-cust@example.test'), 'complaint', 'complaint outranks bounce');
SELECT is((public.email_event_record('msg_d', 'email.delivered', 'em_4', ARRAY['fine@example.test'], NULL, NULL)->>'suppressed'), '0', 'delivered events only logged');

SELECT pg_temp.as_user('f0000000-0000-4000-8000-0000000000c1');
SELECT is((SELECT count(*) FROM public.email_suppressions), 0::bigint, 'customers cannot read the suppression list');
SELECT pg_temp.as_user('f0000000-0000-4000-8000-0000000000a1');
SELECT is((SELECT count(*) FROM public.email_suppressions WHERE email = 'pm-cust@example.test'), 1::bigint, 'the owner can');

-- 6. Erasure -----------------------------------------------------------------------------
SELECT pg_temp.as_service();
INSERT INTO t VALUES ('l2', public.lead_capture('{"source":"wholesale","email":"pm-cust-shop@example.test","full_name":"Pia Shop","phone":"+919800000099"}'));
SELECT pg_temp.as_postgres();
-- The owner had merged the shop lead into the customer's lead: same person.
UPDATE public.leads SET merged_into = (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'lead') WHERE id = (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'l2');
INSERT INTO public.pending_emails (order_id, recipient, kind) VALUES ('f1000001-0000-4000-8000-000000000001', 'pm-cust@example.test', 'order_delivered');

SELECT pg_temp.as_user('f0000000-0000-4000-8000-0000000000a1');
INSERT INTO t VALUES ('erased', public.privacy_erase((SELECT (v->>'id')::uuid FROM t WHERE k = 'erase')));
SELECT is((SELECT v->>'leads_deleted' FROM t WHERE k = 'erased'), '2', 'their lead and the lead merged into it are deleted');
SELECT pg_temp.as_postgres();
SELECT is((SELECT count(*) FROM public.leads WHERE email IN ('pm-cust@example.test', 'pm-cust-shop@example.test')), 0::bigint, 'no lead rows left');
SELECT is((SELECT count(*) FROM public.orders WHERE id = 'f1000001-0000-4000-8000-000000000001'), 1::bigint, 'the order stays for GST records');
SELECT is((SELECT shipping_address ?| ARRAY['email', 'phone'] FROM public.orders WHERE id = 'f1000001-0000-4000-8000-000000000001'), false, '... without e-mail or phone');
SELECT is((SELECT count(*) FROM public.pending_emails WHERE recipient = 'pm-cust@example.test'), 0::bigint, 'queued e-mails removed');
SELECT is((SELECT count(*) FROM public.email_suppressions WHERE email = 'pm-cust@example.test'), 0::bigint, 'suppression entry removed');
SELECT is((SELECT count(*) FROM public.consent_events WHERE user_id = 'f0000000-0000-4000-8000-0000000000c1'), 0::bigint, 'consent history removed');
SELECT is((SELECT status || '/' || coalesce(contact_email, '-') FROM public.privacy_requests WHERE id = (SELECT (v->>'id')::uuid FROM t WHERE k = 'erase')), 'completed/-',
          'request closed, contact copy removed');
SELECT pg_temp.as_user('f0000000-0000-4000-8000-0000000000a1');
SELECT is((public.privacy_erase((SELECT (v->>'id')::uuid FROM t WHERE k = 'erase'))->>'already'), 'true', 'running it again is safe (lets the app retry the account delete)');

SELECT * FROM finish();
ROLLBACK;
