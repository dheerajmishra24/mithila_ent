-- Migration 0054: one lead pipeline (capture, dedupe, owner actions, conversions).
-- Run: npx supabase test db   (local Docker stack only, never production)
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(56);

-- Owner with a fresh TOTP check (aal2), or the same role with password only.
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

CREATE FUNCTION pg_temp.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  PERFORM set_config('role', 'anon', true);
END $$;

INSERT INTO auth.users (id, email) VALUES
  ('e0000000-0000-4000-8000-0000000000a1', 'crm-owner@example.test'),
  ('e0000000-0000-4000-8000-0000000000c1', 'crm-cust@example.test');
INSERT INTO public.user_roles (user_id, role) VALUES ('e0000000-0000-4000-8000-0000000000a1', 'admin');

CREATE TEMP TABLE t (k text PRIMARY KEY, v jsonb);
GRANT ALL ON t TO PUBLIC;

-- 1. Lock-down ---------------------------------------------------------------
SELECT ok((SELECT bool_and(relrowsecurity) FROM pg_class
            WHERE oid IN ('public.leads'::regclass, 'public.lead_events'::regclass,
                          'public.lead_inbox'::regclass, 'public.lead_conversions'::regclass)), 'RLS on all four lead tables');
SELECT ok(NOT has_table_privilege('anon', 'public.leads', 'SELECT'), 'anon cannot read leads');
SELECT ok(NOT has_table_privilege('authenticated', 'public.leads', 'INSERT'), 'authenticated cannot insert leads directly');
SELECT ok(NOT has_table_privilege('authenticated', 'public.leads', 'UPDATE'), 'authenticated cannot update leads directly');
SELECT ok(NOT has_table_privilege('authenticated', 'public.lead_conversions', 'INSERT'), 'authenticated cannot queue conversions directly');
SELECT ok(NOT has_table_privilege('authenticated', 'public.lead_events', 'DELETE'), 'authenticated cannot delete lead history');
SELECT ok(NOT has_table_privilege('authenticated', 'public.leads', 'TRUNCATE'), 'authenticated cannot truncate leads');
SELECT ok(NOT has_function_privilege('anon', 'public.lead_capture(jsonb)', 'EXECUTE'), 'anon cannot call lead_capture');
SELECT ok(NOT has_function_privilege('authenticated', 'public.lead_capture(jsonb)', 'EXECUTE'), 'authenticated cannot call lead_capture');
SELECT ok(NOT has_function_privilege('anon', 'public.lead_update(uuid,text,bigint,text)', 'EXECUTE'), 'anon cannot call lead_update');
SELECT ok(NOT has_function_privilege('anon', 'public.lead_merge(uuid,uuid)', 'EXECUTE'), 'anon cannot call lead_merge');
SELECT ok((SELECT bool_and('search_path=""' = ANY(proconfig)) FROM pg_proc
            WHERE oid IN ('public.lead_capture(jsonb)'::regprocedure, 'public.lead_update(uuid,text,bigint,text)'::regprocedure,
                          'public.lead_merge(uuid,uuid)'::regprocedure, 'public.lead_clip(text,integer)'::regprocedure)),
          'lead functions pin search_path');

-- 2. Capture: idempotent, deduplicating, consent-aware -----------------------
SELECT pg_temp.as_service();
INSERT INTO t VALUES ('a', public.lead_capture('{"source":"contact","external_id":"web:a","full_name":"Asha Devi","email":"Asha@Example.test","message":"silk","gclid":"G-NO","utm_source":"google","utm_campaign":"diwali"}'));
SELECT ok((SELECT v->>'lead_ref' ~ '^L-[0-9]{6}$' FROM t WHERE k = 'a'), 'new lead gets a readable L-000000 reference');
INSERT INTO t VALUES ('a2', public.lead_capture('{"source":"contact","external_id":"web:a","email":"asha@example.test"}'));
SELECT is((SELECT v->>'duplicate' FROM t WHERE k = 'a2'), 'true', 'same submission id again is a no-op');
SELECT is((SELECT v->>'lead_id' FROM t WHERE k = 'a2'), (SELECT v->>'lead_id' FROM t WHERE k = 'a'), '... and points at the same lead');
INSERT INTO t VALUES ('a3', public.lead_capture('{"source":"meta","external_id":"9001","email":"ASHA@example.test","phone":"+919876543210","ad_consent":true,"meta_lead_id":"9001","gclid":"G-YES"}'));
SELECT is((SELECT v->>'lead_id' FROM t WHERE k = 'a3'), (SELECT v->>'lead_id' FROM t WHERE k = 'a'), 'same e-mail from another source merges into one lead');
SELECT is((SELECT count(*) FROM public.lead_events WHERE lead_id = (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'a')), 2::bigint, 'two submissions, two history rows');
SELECT is((SELECT gclid FROM public.leads WHERE id = (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'a')), 'G-YES', 'click id kept only from the submission with consent');
SELECT is((SELECT phone_e164 FROM public.leads WHERE id = (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'a')), '+919876543210', 'blank fields filled by later submissions');
SELECT is((SELECT first_source FROM public.leads WHERE id = (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'a')), 'contact', 'first source is kept');
INSERT INTO t VALUES ('a4', public.lead_capture('{"source":"wholesale","phone":"+919876543210","company":"Devi Textiles"}'));
SELECT is((SELECT v->>'lead_id' FROM t WHERE k = 'a4'), (SELECT v->>'lead_id' FROM t WHERE k = 'a'), 'same phone merges too');

INSERT INTO t VALUES ('b', public.lead_capture('{"source":"contact","full_name":"No Consent","email":"nc@example.test","gclid":"G1","fbclid":"F1","fbp":"fb.1.1700000000000.1"}'));
SELECT ok((SELECT gclid IS NULL AND fbclid IS NULL AND fbp IS NULL AND NOT ad_consent FROM public.leads WHERE id = (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'b')),
          'without ad consent no click or browser id is stored');

INSERT INTO t VALUES ('test', public.lead_capture('{"source":"google","external_id":"g-test-1","email":"asha@example.test","is_test":true,"ad_consent":true,"gclid":"GT"}'));
SELECT isnt((SELECT v->>'lead_id' FROM t WHERE k = 'test'), (SELECT v->>'lead_id' FROM t WHERE k = 'a'), 'test leads never merge into real ones');

INSERT INTO t VALUES ('bad', public.lead_capture('{"source":"contact","email":"not-an-email","phone":"12345","full_name":"Bad Data"}'));
SELECT ok((SELECT email IS NULL AND phone_e164 IS NULL FROM public.leads WHERE id = (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'bad')),
          'malformed e-mail / phone are dropped, the lead is still kept');
SELECT throws_ok($$SELECT public.lead_capture('{"source":"evil"}')$$, '22023', 'INVALID_SOURCE', 'unknown source refused');
SELECT throws_ok($$INSERT INTO public.lead_events (lead_id, kind, source, external_id)
                   SELECT (v->>'lead_id')::uuid, 'submission', 'contact', 'web:a' FROM t WHERE k = 'a'$$,
                 '23505', NULL, 'UNIQUE (source, external_id) backs idempotency');

-- Leads with consent + click ids for the conversion tests
INSERT INTO t VALUES ('g', public.lead_capture('{"source":"google","external_id":"g-1","email":"g@example.test","ad_consent":true,"gclid":"GC-1"}'));
INSERT INTO t VALUES ('m', public.lead_capture('{"source":"contact","email":"m@example.test","full_name":"Meera Shah","ad_consent":true,"fbp":"fb.1.1700000000000.2"}'));
INSERT INTO t VALUES ('d', public.lead_capture('{"source":"contact","email":"meera.work@example.test","full_name":"Meera Shah","phone":"+919812345678"}'));
RESET ROLE;

-- 3. Who can read --------------------------------------------------------------
SELECT pg_temp.as_anon();
SELECT throws_ok($$SELECT count(*) FROM public.leads$$, '42501', NULL, 'anon: no access to leads');
RESET ROLE;
SELECT pg_temp.as_user('e0000000-0000-4000-8000-0000000000c1');
SELECT is((SELECT count(*) FROM public.leads), 0::bigint, 'customer sees no leads');
SELECT is((SELECT count(*) FROM public.lead_events), 0::bigint, 'customer sees no lead history');
RESET ROLE;
SELECT pg_temp.as_user('e0000000-0000-4000-8000-0000000000a1', false);
SELECT is((SELECT count(*) FROM public.leads), 0::bigint, 'owner with password only sees no leads');
RESET ROLE;
SELECT pg_temp.as_user('e0000000-0000-4000-8000-0000000000a1');
SELECT ok((SELECT count(*) FROM public.leads) >= 6, 'owner after two-step sign-in sees the leads');
RESET ROLE;

-- 4. Owner updates and conversion queue --------------------------------------
SELECT pg_temp.as_user('e0000000-0000-4000-8000-0000000000c1');
SELECT throws_ok($$SELECT public.lead_update((SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'a'), 'won', 1, NULL)$$,
                 '42501', 'NOT_ADMIN', 'customer cannot change a lead');
RESET ROLE;
SELECT pg_temp.as_user('e0000000-0000-4000-8000-0000000000a1', false);
SELECT throws_ok($$SELECT public.lead_update((SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'a'), 'won', 1, NULL)$$,
                 '42501', 'NOT_ADMIN', 'password-only owner session cannot change a lead');
RESET ROLE;

SELECT pg_temp.as_user('e0000000-0000-4000-8000-0000000000a1');
SELECT is((public.lead_update((SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'a'), 'qualified', NULL, 'called back')->>'conversions_queued')::int, 2,
          'qualified with Meta lead id + gclid queues Meta and Google');
SELECT is((public.lead_update((SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'a'), 'qualified', NULL, NULL)->>'conversions_queued')::int, 0,
          'saving the same stage again queues nothing');
SELECT is((public.lead_update((SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'a'), 'won', 1250050, NULL)->>'conversions_queued')::int, 2,
          'won queues one more per platform');
SELECT is((public.lead_update((SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'b'), 'won', 100, NULL)->>'conversions_queued')::int, 0,
          'no ad consent: nothing is reported');
SELECT is((public.lead_update((SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'test'), 'won', 100, NULL)->>'conversions_queued')::int, 0,
          'test lead: nothing is reported');
SELECT is((public.lead_update((SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'm'), 'qualified', NULL, NULL)->>'conversions_queued')::int, 1,
          'web lead with consent and only Meta browser id: Meta only');
SELECT throws_ok($$SELECT public.lead_update((SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'a'), 'paid', NULL, NULL)$$,
                 '22023', 'INVALID_STATUS', 'unknown status refused');
SELECT throws_ok($$SELECT public.lead_update((SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'a'), NULL, -5, NULL)$$,
                 '22023', 'INVALID_VALUE', 'negative value refused');
RESET ROLE;

SELECT is((SELECT value_paise FROM public.lead_conversions c JOIN t ON (t.v->>'lead_id')::uuid = c.lead_id
            WHERE t.k = 'a' AND c.platform = 'google' AND c.stage = 'won'), 1250050::bigint, 'won conversion carries the order value');
SELECT is((SELECT count(*) FROM public.lead_conversions c JOIN t ON (t.v->>'lead_id')::uuid = c.lead_id
            WHERE t.k = 'a' AND c.stage = 'qualified' AND c.value_paise IS NULL), 2::bigint, 'qualified conversions carry no value');
SELECT is((SELECT actor FROM public.lead_events e JOIN t ON (t.v->>'lead_id')::uuid = e.lead_id
            WHERE t.k = 'a' AND e.kind = 'status' ORDER BY e.created_at LIMIT 1), 'e0000000-0000-4000-8000-0000000000a1'::uuid,
          'status change records who made it');
SELECT is((SELECT notes FROM public.leads WHERE id = (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'a')), 'called back', 'notes saved');

-- 5. Merge ---------------------------------------------------------------------
SELECT pg_temp.as_user('e0000000-0000-4000-8000-0000000000c1');
SELECT throws_ok($$SELECT public.lead_merge((SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'm'), (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'd'))$$,
                 '42501', 'NOT_ADMIN', 'customer cannot merge');
RESET ROLE;
SELECT pg_temp.as_user('e0000000-0000-4000-8000-0000000000a1');
SELECT lives_ok($$SELECT public.lead_merge((SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'm'), (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'd'))$$,
                'owner merges the duplicate Meera into the first');
SELECT throws_ok($$SELECT public.lead_merge((SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'm'), (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'd'))$$,
                 '22023', 'CANNOT_MERGE', 'an already merged lead cannot be merged again');
SELECT throws_ok($$SELECT public.lead_merge((SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'm'), (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'm'))$$,
                 '22023', 'CANNOT_MERGE', 'a lead cannot be merged into itself');
SELECT throws_ok($$SELECT public.lead_merge((SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'a'), (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'test'))$$,
                 '22023', 'CANNOT_MERGE', 'a test lead cannot be merged into a real one');
RESET ROLE;
SELECT is((SELECT merged_into FROM public.leads WHERE id = (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'd')),
          (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'm'), 'dropped lead points at the kept one');
SELECT is((SELECT phone_e164 FROM public.leads WHERE id = (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'm')), '+919812345678',
          'kept lead gains the duplicate''s phone');
SELECT is((SELECT count(*) FROM public.lead_events WHERE lead_id = (SELECT (v->>'lead_id')::uuid FROM t WHERE k = 'd')), 0::bigint,
          'history moved to the kept lead');
SELECT pg_temp.as_service();
INSERT INTO t VALUES ('d2', public.lead_capture('{"source":"contact","email":"meera.work@example.test","message":"again"}'));
RESET ROLE;
SELECT is((SELECT v->>'lead_id' FROM t WHERE k = 'd2'), (SELECT v->>'lead_id' FROM t WHERE k = 'm'),
          'a new enquiry from the merged-away e-mail lands on the kept lead');

-- 6. Legacy inboxes closed to the public --------------------------------------
SELECT ok(NOT has_table_privilege('anon', 'public.contact_inquiries', 'INSERT'), 'anon can no longer insert legacy contact rows');
SELECT ok(NOT has_table_privilege('anon', 'public.wholesale_applications', 'INSERT'), 'anon can no longer insert legacy wholesale rows');

SELECT * FROM finish();
ROLLBACK;
