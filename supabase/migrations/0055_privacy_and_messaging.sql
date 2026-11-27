-- 0055: privacy (DPDP) and messaging.
--
-- A) Consent ledger. One row per choice, never updated, so the shop can show
--    what a person agreed to and when (DPDP Act s.6). Purposes are separate
--    and default to "not given". Withdrawing ad measurement also takes the
--    person's leads out of ad-platform reporting.
-- B) Data-principal requests (erasure, correction, grievance, access log)
--    and an owner-run erasure that keeps the tax records the GST law needs
--    and removes everything else.
-- C) Courier tracking: AWB and courier on the order, a scan timeline fed by
--    the Shiprocket webhook, forward-only order status moves.
-- D) E-mail suppression fed by the signed Resend webhook (hard bounces and
--    spam complaints).
--
-- Access: anon gets nothing. Signed-in people read only their own consent,
-- requests and shipment scans; the owner (is_admin()) reads all. Every
-- write goes through SECURITY DEFINER functions with search_path = ''.

-- ---------------------------------------------------------------------------
-- A) Consent ledger
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.consent_events (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose        text NOT NULL CHECK (purpose IN ('marketing_email', 'marketing_whatsapp', 'ad_measurement')),
  granted        boolean NOT NULL,
  notice_version text NOT NULL CHECK (notice_version ~ '^[A-Za-z0-9._-]{1,40}$'),
  source         text NOT NULL CHECK (source IN ('privacy_centre', 'signup', 'checkout')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consent_events_user_idx ON public.consent_events (user_id, purpose, id DESC);

CREATE OR REPLACE VIEW public.consent_current WITH (security_invoker = on) AS
  SELECT DISTINCT ON (user_id, purpose) user_id, purpose, granted, notice_version, created_at
    FROM public.consent_events
   ORDER BY user_id, purpose, id DESC;

-- ---------------------------------------------------------------------------
-- B) Data-principal requests
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.privacy_request_seq;

CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref           text NOT NULL UNIQUE DEFAULT ('PR-' || lpad(nextval('public.privacy_request_seq')::text, 6, '0')),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- SHA-256 of the lower-cased e-mail: lets the owner show a request was
  -- handled after the account itself is gone.
  email_hash    text NOT NULL CHECK (email_hash ~ '^[0-9a-f]{64}$'),
  contact_email text CHECK (contact_email IS NULL OR length(contact_email) <= 254),
  kind          text NOT NULL CHECK (kind IN ('erasure', 'correction', 'grievance', 'access')),
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'rejected', 'withdrawn')),
  details       text CHECK (length(details) <= 2000),
  resolution    text CHECK (length(resolution) <= 2000),
  created_at    timestamptz NOT NULL DEFAULT now(),
  due_at        timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  closed_at     timestamptz,
  closed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS privacy_requests_one_open_erasure
  ON public.privacy_requests (user_id) WHERE kind = 'erasure' AND status IN ('open', 'in_progress');
CREATE INDEX IF NOT EXISTS privacy_requests_queue_idx ON public.privacy_requests (status, due_at);
CREATE INDEX IF NOT EXISTS privacy_requests_user_idx ON public.privacy_requests (user_id);

-- ---------------------------------------------------------------------------
-- C) Courier tracking
-- ---------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_name         text CHECK (length(courier_name) <= 100),
  ADD COLUMN IF NOT EXISTS awb_code             text CHECK (awb_code ~ '^[A-Za-z0-9-]{4,40}$'),
  ADD COLUMN IF NOT EXISTS shipment_status      text CHECK (length(shipment_status) <= 100),
  ADD COLUMN IF NOT EXISTS shipment_status_at   timestamptz,
  ADD COLUMN IF NOT EXISTS expected_delivery_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS orders_awb_code_key ON public.orders (awb_code) WHERE awb_code IS NOT NULL;

-- Keyed by AWB, not by order: scans that arrive before the owner records the
-- AWB on the order are kept and show up once it is recorded.
CREATE TABLE IF NOT EXISTS public.shipment_events (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  awb_code     text NOT NULL CHECK (awb_code ~ '^[A-Za-z0-9-]{4,40}$'),
  event_at     timestamptz NOT NULL,
  status_label text NOT NULL CHECK (length(status_label) BETWEEN 1 AND 100),
  activity     text CHECK (length(activity) <= 300),
  location     text CHECK (length(location) <= 200),
  is_return    boolean NOT NULL DEFAULT false,
  received_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS shipment_events_dedupe
  ON public.shipment_events (awb_code, event_at, status_label, (coalesce(activity, '')));

-- ---------------------------------------------------------------------------
-- D) E-mail suppression
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.email_suppressions (
  email      text PRIMARY KEY CHECK (email = lower(email) AND length(email) <= 254 AND email ~ '^[^@\s]+@[^@\s]+$'),
  reason     text NOT NULL CHECK (reason IN ('bounce', 'complaint')),
  detail     text CHECK (length(detail) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per signed webhook message (svix-id), so redeliveries are no-ops.
-- No recipient is stored here.
CREATE TABLE IF NOT EXISTS public.email_webhook_events (
  message_id  text PRIMARY KEY CHECK (length(message_id) BETWEEN 1 AND 200),
  event_type  text NOT NULL CHECK (length(event_type) <= 60),
  email_id    text CHECK (length(email_id) <= 100),
  received_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- E) RLS and grants
-- ---------------------------------------------------------------------------

ALTER TABLE public.consent_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppressions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.consent_events, public.privacy_requests, public.shipment_events,
  public.email_suppressions, public.email_webhook_events, public.consent_current FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.privacy_request_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.consent_events, public.consent_current, public.privacy_requests,
  public.shipment_events, public.email_suppressions TO authenticated;
GRANT ALL ON TABLE public.consent_events, public.privacy_requests, public.shipment_events,
  public.email_suppressions, public.email_webhook_events, public.consent_current TO service_role;
GRANT USAGE ON SEQUENCE public.privacy_request_seq TO service_role;

DROP POLICY IF EXISTS "Own consent or owner" ON public.consent_events;
CREATE POLICY "Own consent or owner" ON public.consent_events FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Own requests or owner" ON public.privacy_requests;
CREATE POLICY "Own requests or owner" ON public.privacy_requests FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Scans of own orders or owner" ON public.shipment_events;
CREATE POLICY "Scans of own orders or owner" ON public.shipment_events FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR EXISTS (SELECT 1 FROM public.orders o
                WHERE o.awb_code = shipment_events.awb_code
                  AND o.user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Owner reads suppressions" ON public.email_suppressions;
CREATE POLICY "Owner reads suppressions" ON public.email_suppressions FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));
-- email_webhook_events: no policies; service_role only.

-- ---------------------------------------------------------------------------
-- F) Functions
-- ---------------------------------------------------------------------------

-- A person records one consent choice for themself.
CREATE OR REPLACE FUNCTION public.consent_set(p_purpose text, p_granted boolean, p_notice_version text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid     uuid := (SELECT auth.uid());
  v_email   text;
  v_prev    boolean;
  v_leads   integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_SIGNED_IN' USING ERRCODE = '42501';
  END IF;
  IF p_purpose IS NULL OR p_purpose NOT IN ('marketing_email', 'marketing_whatsapp', 'ad_measurement')
     OR p_granted IS NULL OR p_notice_version IS NULL OR p_notice_version !~ '^[A-Za-z0-9._-]{1,40}$' THEN
    RAISE EXCEPTION 'INVALID_CONSENT' USING ERRCODE = '22023';
  END IF;

  -- Serialise one person's changes so the ledger order is the real order.
  PERFORM pg_advisory_xact_lock(hashtextextended('consent:' || v_uid::text, 0));

  SELECT c.granted INTO v_prev
    FROM public.consent_events c
   WHERE c.user_id = v_uid AND c.purpose = p_purpose
   ORDER BY c.id DESC LIMIT 1;
  -- Same as the current choice: nothing to record. (A first explicit "no"
  -- is still recorded: it is the person's choice.)
  IF v_prev IS NOT NULL AND v_prev = p_granted THEN
    RETURN jsonb_build_object('changed', false);
  END IF;

  INSERT INTO public.consent_events (user_id, purpose, granted, notice_version, source)
  VALUES (v_uid, p_purpose, p_granted, p_notice_version, 'privacy_centre');

  -- Withdrawal must reach the ad platforms: stop reporting this person's
  -- leads and drop the click ids that would identify them.
  IF p_purpose = 'ad_measurement' AND NOT p_granted THEN
    SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
    IF v_email IS NOT NULL THEN
      WITH hit AS (
        UPDATE public.leads l
           SET ad_consent = false, gclid = NULL, gbraid = NULL, wbraid = NULL,
               fbclid = NULL, fbp = NULL, fbc = NULL, updated_at = now()
         WHERE l.email = lower(v_email)
        RETURNING l.id
      ), stopped AS (
        UPDATE public.lead_conversions c
           SET status = 'failed', last_error = 'Not sent: the person withdrew ad-measurement consent'
         WHERE c.status = 'pending' AND c.lead_id IN (SELECT id FROM hit)
        RETURNING c.id
      )
      SELECT count(*) INTO v_leads FROM hit;
    END IF;
  END IF;

  RETURN jsonb_build_object('changed', true, 'leads_updated', v_leads);
END;
$$;

-- A person opens a request about their own data.
CREATE OR REPLACE FUNCTION public.privacy_request_create(p_kind text, p_details text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid   uuid := (SELECT auth.uid());
  v_email text;
  v_open  integer;
  v_row   public.privacy_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_SIGNED_IN' USING ERRCODE = '42501';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('erasure', 'correction', 'grievance', 'access') THEN
    RAISE EXCEPTION 'INVALID_KIND' USING ERRCODE = '22023';
  END IF;
  IF p_kind IN ('correction', 'grievance') AND length(btrim(coalesce(p_details, ''))) < 5 THEN
    RAISE EXCEPTION 'DETAILS_REQUIRED' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('privacy:' || v_uid::text, 0));
  SELECT count(*) INTO v_open FROM public.privacy_requests r
   WHERE r.user_id = v_uid AND r.status IN ('open', 'in_progress');
  IF v_open >= 5 THEN
    RAISE EXCEPTION 'TOO_MANY_OPEN_REQUESTS' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'access' AND (SELECT count(*) FROM public.privacy_requests r
       WHERE r.user_id = v_uid AND r.kind = 'access' AND r.created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'TOO_MANY_OPEN_REQUESTS' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'erasure' AND EXISTS (SELECT 1 FROM public.privacy_requests r
       WHERE r.user_id = v_uid AND r.kind = 'erasure' AND r.status IN ('open', 'in_progress')) THEN
    RAISE EXCEPTION 'ALREADY_REQUESTED' USING ERRCODE = '22023';
  END IF;

  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = v_uid;
  INSERT INTO public.privacy_requests (user_id, email_hash, contact_email, kind, status, details, closed_at, resolution)
  VALUES (
    v_uid,
    encode(sha256(convert_to(coalesce(v_email, v_uid::text), 'UTF8')), 'hex'),
    v_email,
    p_kind,
    CASE WHEN p_kind = 'access' THEN 'completed' ELSE 'open' END,
    nullif(left(btrim(coalesce(p_details, '')), 2000), ''),
    CASE WHEN p_kind = 'access' THEN now() END,
    CASE WHEN p_kind = 'access' THEN 'Self-service download from the Privacy Centre.' END
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('id', v_row.id, 'ref', v_row.ref, 'status', v_row.status);
END;
$$;

-- A person withdraws their own open request.
CREATE OR REPLACE FUNCTION public.privacy_request_withdraw(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'NOT_SIGNED_IN' USING ERRCODE = '42501';
  END IF;
  UPDATE public.privacy_requests r
     SET status = 'withdrawn', closed_at = now(), resolution = 'Withdrawn by the person.'
   WHERE r.id = p_id AND r.user_id = (SELECT auth.uid()) AND r.status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_OPEN' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- Owner moves a request along. Erasure is completed only by privacy_erase().
CREATE OR REPLACE FUNCTION public.privacy_request_update(p_id uuid, p_status text, p_resolution text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.privacy_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('in_progress', 'completed', 'rejected') THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_row FROM public.privacy_requests r WHERE r.id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status NOT IN ('open', 'in_progress') THEN
    RAISE EXCEPTION 'REQUEST_CLOSED' USING ERRCODE = '22023';
  END IF;
  IF v_row.kind = 'erasure' AND p_status = 'completed' THEN
    RAISE EXCEPTION 'USE_ERASE' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'rejected' AND length(btrim(coalesce(p_resolution, ''))) < 5 THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE public.privacy_requests r
     SET status = p_status,
         resolution = coalesce(nullif(left(btrim(coalesce(p_resolution, '')), 2000), ''), r.resolution),
         closed_at = CASE WHEN p_status IN ('completed', 'rejected') THEN now() END,
         closed_by = CASE WHEN p_status IN ('completed', 'rejected') THEN (SELECT auth.uid()) END
   WHERE r.id = p_id;
END;
$$;

-- Owner carries out an erasure request. Removes the person's personal data
-- except what the tax law requires the shop to keep (orders and their tax
-- invoices: CGST Act s.35/36). The app then deletes the sign-in account,
-- which cascades to profile, cart, swatch credit, roles and sessions.
CREATE OR REPLACE FUNCTION public.privacy_erase(p_request uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_req    public.privacy_requests%ROWTYPE;
  v_email  text;
  v_leads  integer := 0;
  v_orders integer := 0;
  v_ids    uuid[] := ARRAY[]::uuid[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_req FROM public.privacy_requests r WHERE r.id = p_request FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_req.kind <> 'erasure' THEN
    RAISE EXCEPTION 'NOT_ERASURE' USING ERRCODE = '22023';
  END IF;
  IF v_req.status = 'completed' THEN
    -- Already erased; the app may still need to finish deleting the account.
    RETURN jsonb_build_object('user_id', v_req.user_id, 'already', true);
  END IF;
  IF v_req.status NOT IN ('open', 'in_progress') OR v_req.user_id IS NULL THEN
    RAISE EXCEPTION 'REQUEST_CLOSED' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_req.user_id) THEN
    RAISE EXCEPTION 'CANNOT_ERASE_STAFF' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders o
              WHERE o.user_id = v_req.user_id AND o.status IN ('paid', 'shipped')) THEN
    RAISE EXCEPTION 'ORDERS_IN_PROGRESS' USING ERRCODE = '22023';
  END IF;

  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = v_req.user_id;

  IF v_email IS NOT NULL THEN
    -- Leads with this e-mail, plus every lead merged with them either way
    -- (the owner merged them because they are the same person).
    WITH RECURSIVE edges(a, b) AS (
      SELECT l.id, l.merged_into FROM public.leads l WHERE l.merged_into IS NOT NULL
      UNION ALL
      SELECT l.merged_into, l.id FROM public.leads l WHERE l.merged_into IS NOT NULL
    ), grp(id) AS (
      SELECT l.id FROM public.leads l WHERE l.email = v_email
      UNION
      SELECT e.b FROM edges e JOIN grp g ON e.a = g.id
    )
    SELECT coalesce(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_ids FROM grp;

    DELETE FROM public.lead_inbox i WHERE i.lead_id = ANY (v_ids);
    UPDATE public.leads l SET merged_into = NULL WHERE l.id = ANY (v_ids);
    DELETE FROM public.leads l WHERE l.id = ANY (v_ids);
    GET DIAGNOSTICS v_leads = ROW_COUNT;

    DELETE FROM public.pending_emails pe WHERE lower(pe.recipient) = v_email;
    DELETE FROM public.email_suppressions s WHERE s.email = v_email;
  END IF;

  -- Tax records stay, without contact details the invoice does not need.
  UPDATE public.orders o
     SET shipping_address = o.shipping_address - 'email' - 'phone'
   WHERE o.user_id = v_req.user_id AND o.shipping_address IS NOT NULL;
  GET DIAGNOSTICS v_orders = ROW_COUNT;

  UPDATE public.profiles p
     SET full_name = NULL, phone = NULL, saved_addresses = '[]'::jsonb, razorpay_customer_id = NULL
   WHERE p.id = v_req.user_id;
  DELETE FROM public.consent_events c WHERE c.user_id = v_req.user_id;

  UPDATE public.privacy_requests r
     SET status = 'completed', closed_at = now(), closed_by = (SELECT auth.uid()), contact_email = NULL,
         resolution = format('Erased. %s lead record(s) deleted; %s order(s) kept for GST records without contact details.', v_leads, v_orders)
   WHERE r.id = p_request;
  -- Earlier requests from the same person lose their contact copy too.
  UPDATE public.privacy_requests r
     SET contact_email = NULL, details = NULL
   WHERE r.user_id = v_req.user_id AND r.id <> p_request;

  RETURN jsonb_build_object('user_id', v_req.user_id, 'leads_deleted', v_leads, 'orders_kept', v_orders, 'already', false);
END;
$$;

-- Courier webhook (service_role): store scans, update the order, move its
-- status forward. Input is already normalised by the app:
-- {awb, courier_name, status_label, status_at, etd, is_return, order_ref,
--  scans: [{at, label, activity, location}]}; times are ISO-8601.
CREATE OR REPLACE FUNCTION public.shipment_apply(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_awb     text := btrim(coalesce(p->>'awb', ''));
  v_label   text := upper(left(btrim(coalesce(p->>'status_label', '')), 100));
  v_at      timestamptz;
  v_return  boolean := coalesce((p->>'is_return')::boolean, false);
  v_ref     text := btrim(coalesce(p->>'order_ref', ''));
  v_order   public.orders%ROWTYPE;
  v_found   boolean := false;
  v_kind    text;
  v_latest  boolean;
  v_changed boolean := false;
  v_to      text;
  v_inserted integer;
BEGIN
  IF v_awb !~ '^[A-Za-z0-9-]{4,40}$' THEN
    RAISE EXCEPTION 'INVALID_AWB' USING ERRCODE = '22023';
  END IF;
  v_at := coalesce(nullif(p->>'status_at', '')::timestamptz, now());

  INSERT INTO public.shipment_events (awb_code, event_at, status_label, activity, location, is_return)
  SELECT v_awb, (s->>'at')::timestamptz, upper(left(btrim(s->>'label'), 100)),
         nullif(left(btrim(coalesce(s->>'activity', '')), 300), ''),
         nullif(left(btrim(coalesce(s->>'location', '')), 200), ''),
         v_return
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p->'scans') = 'array' THEN p->'scans' ELSE '[]'::jsonb END) s
   WHERE nullif(s->>'at', '') IS NOT NULL AND btrim(coalesce(s->>'label', '')) <> ''
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_label <> '' AND NOT EXISTS (SELECT 1 FROM public.shipment_events e
                                    WHERE e.awb_code = v_awb AND e.status_label = v_label AND e.event_at = v_at) THEN
    INSERT INTO public.shipment_events (awb_code, event_at, status_label, is_return)
    VALUES (v_awb, v_at, v_label, v_return)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT * INTO v_order FROM public.orders o WHERE o.awb_code = v_awb FOR UPDATE;
  v_found := FOUND;
  IF NOT v_found AND v_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_order FROM public.orders o WHERE o.id = v_ref::uuid AND o.awb_code IS NULL FOR UPDATE;
    v_found := FOUND;
  ELSIF NOT v_found AND v_ref ~* '^[0-9a-f]{8}$' THEN
    -- The short order number customers see (#1A2B3C4D); only if unambiguous.
    IF (SELECT count(*) FROM public.orders o WHERE o.id::text LIKE lower(v_ref) || '-%') = 1 THEN
      SELECT * INTO v_order FROM public.orders o
       WHERE o.id::text LIKE lower(v_ref) || '-%' AND o.awb_code IS NULL FOR UPDATE;
      v_found := FOUND;
    END IF;
  END IF;
  IF NOT v_found THEN
    RETURN jsonb_build_object('matched', false, 'scans_added', v_inserted);
  END IF;

  v_kind := CASE
    WHEN v_return OR v_label LIKE 'RTO%' OR v_label IN ('UNDELIVERED', 'CANCELED', 'CANCELLED', 'LOST', 'DAMAGED', 'DESTROYED', 'DISPOSED OFF') THEN 'problem'
    WHEN v_label = 'DELIVERED' THEN 'delivered'
    WHEN v_label IN ('PICKED UP', 'SHIPPED', 'OUT FOR DELIVERY', 'REACHED AT DESTINATION HUB', 'REACHED DESTINATION HUB', 'MISROUTED', 'DELAYED')
      OR v_label LIKE 'IN TRANSIT%' THEN 'moving'
    ELSE 'info'
  END;
  v_latest := v_label <> '' AND (v_order.shipment_status_at IS NULL OR v_at >= v_order.shipment_status_at);
  v_changed := v_latest AND v_label IS DISTINCT FROM v_order.shipment_status;

  IF v_order.status = 'paid' AND v_latest AND v_kind = 'delivered' THEN
    v_to := 'delivered';
  ELSIF v_order.status = 'paid' AND v_latest AND v_kind = 'moving' THEN
    v_to := 'shipped';
  ELSIF v_order.status = 'shipped' AND v_latest AND v_kind = 'delivered' THEN
    v_to := 'delivered';
  END IF;

  UPDATE public.orders o
     SET awb_code = v_awb,
         courier_name = coalesce(nullif(left(btrim(coalesce(p->>'courier_name', '')), 100), ''), o.courier_name),
         shipment_status = CASE WHEN v_latest THEN v_label ELSE o.shipment_status END,
         shipment_status_at = CASE WHEN v_latest THEN v_at ELSE o.shipment_status_at END,
         expected_delivery_at = coalesce(nullif(p->>'etd', '')::timestamptz, o.expected_delivery_at),
         tracking_status = left(coalesce(nullif(left(btrim(coalesce(p->>'courier_name', '')), 100), ''), o.courier_name, 'Courier') || ' · AWB ' || v_awb, 200),
         status = coalesce(v_to::public.order_status, o.status)
   WHERE o.id = v_order.id;

  RETURN jsonb_build_object(
    'matched', true,
    'order_id', v_order.id,
    'status_to', v_to,
    'status_label', v_label,
    'status_changed', v_changed,
    'problem', v_kind = 'problem' AND v_changed,
    'scans_added', v_inserted
  );
END;
$$;

-- Resend webhook (service_role): record once per message, suppress hard
-- bounces and complaints.
CREATE OR REPLACE FUNCTION public.email_event_record(
  p_message_id text, p_type text, p_email_id text, p_recipients text[], p_bounce_type text, p_detail text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_n integer := 0;
BEGIN
  IF p_message_id IS NULL OR length(p_message_id) NOT BETWEEN 1 AND 200 OR p_type IS NULL OR length(p_type) > 60 THEN
    RAISE EXCEPTION 'INVALID_EVENT' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.email_webhook_events (message_id, event_type, email_id)
  VALUES (p_message_id, p_type, left(p_email_id, 100))
  ON CONFLICT (message_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('new', false, 'suppressed', 0);
  END IF;

  IF p_type = 'email.complained' OR (p_type = 'email.bounced' AND coalesce(p_bounce_type, '') <> 'Temporary') THEN
    INSERT INTO public.email_suppressions AS s (email, reason, detail)
    SELECT DISTINCT lower(btrim(e)),
           CASE WHEN p_type = 'email.complained' THEN 'complaint' ELSE 'bounce' END,
           nullif(left(btrim(coalesce(p_detail, '')), 500), '')
      FROM unnest(coalesce(p_recipients, ARRAY[]::text[])) e
     WHERE lower(btrim(e)) ~ '^[^@\s]+@[^@\s]+$' AND length(btrim(e)) <= 254
    ON CONFLICT (email) DO UPDATE
       SET reason = CASE WHEN excluded.reason = 'complaint' THEN 'complaint' ELSE s.reason END,
           detail = coalesce(excluded.detail, s.detail),
           created_at = now();
    GET DIAGNOSTICS v_n = ROW_COUNT;
  END IF;
  RETURN jsonb_build_object('new', true, 'suppressed', v_n);
END;
$$;

-- Owner lets an address receive mail again (e.g. the customer fixed their mailbox).
CREATE OR REPLACE FUNCTION public.email_unsuppress(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.email_suppressions s WHERE s.email = lower(btrim(p_email));
END;
$$;

REVOKE ALL ON FUNCTION public.consent_set(text, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.privacy_request_create(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.privacy_request_withdraw(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.privacy_request_update(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.privacy_erase(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.email_unsuppress(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shipment_apply(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_event_record(text, text, text, text[], text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consent_set(text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_request_create(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_request_withdraw(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_request_update(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_erase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_unsuppress(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shipment_apply(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_event_record(text, text, text, text[], text, text) TO service_role;
