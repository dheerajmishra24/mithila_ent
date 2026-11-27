-- 0054: one lead pipeline for the owner CRM (Phase 6).
--
-- Every enquiry, whatever its source (Contact Us, wholesale form, Meta Lead
-- Ads, Google Ads lead forms), lands in public.leads through ONE function,
-- lead_capture(), which:
--   * is idempotent per source event: (source, external_id) is UNIQUE in
--     public.lead_events, so a webhook delivered twice creates one lead;
--   * merges repeat contacts: same e-mail or same phone -> same lead (under
--     advisory locks, so two parallel submissions cannot create twins);
--   * keeps a history row per submission in public.lead_events.
-- Meta webhooks are archived raw in public.lead_inbox before processing, so a
-- failed Graph fetch can be replayed.
-- When the owner marks a lead qualified or won, lead_update() queues a
-- conversion for each ad platform that can attribute it (public.lead_conversions,
-- UNIQUE per lead/platform/stage). The app sends them (Meta Conversions API,
-- Google Data Manager API) with a stable event_id for de-duplication.
--
-- Access: the owner (is_admin()) can READ through RLS; every write goes
-- through SECURITY DEFINER functions. lead_capture is service_role only;
-- lead_update / lead_merge check is_admin() themselves. anon and
-- authenticated get no table privileges except SELECT (filtered by RLS).
-- The legacy insert-only inboxes (contact_inquiries, wholesale_applications)
-- are copied in and closed to new public inserts.

-- ---------------------------------------------------------------------------
-- A) Tables
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.lead_ref_seq;

CREATE TABLE IF NOT EXISTS public.leads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_ref          text NOT NULL UNIQUE
                      DEFAULT ('L-' || lpad(nextval('public.lead_ref_seq')::text, 6, '0')),
  full_name         text CHECK (length(full_name) <= 200),
  email             text CHECK (email IS NULL OR (length(email) <= 254 AND email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+$')),
  phone_e164        text CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  company           text CHECK (length(company) <= 200),
  city              text CHECK (length(city) <= 120),
  message           text CHECK (length(message) <= 4000),
  first_source      text NOT NULL CHECK (first_source IN ('contact', 'wholesale', 'meta', 'google')),
  status            text NOT NULL DEFAULT 'new'
                      CHECK (status IN ('new', 'contacted', 'qualified', 'won', 'lost', 'spam')),
  value_paise       bigint CHECK (value_paise IS NULL OR value_paise BETWEEN 0 AND 100000000000),
  notes             text CHECK (length(notes) <= 4000),
  is_test           boolean NOT NULL DEFAULT false,
  -- Visitor agreed that the outcome may be reported to Google/Meta to measure
  -- ads (web forms: separate unticked box). Platform-native leads: true.
  ad_consent        boolean NOT NULL DEFAULT false,
  utm_source        text CHECK (length(utm_source) <= 200),
  utm_medium        text CHECK (length(utm_medium) <= 200),
  utm_campaign      text CHECK (length(utm_campaign) <= 200),
  utm_term          text CHECK (length(utm_term) <= 200),
  utm_content       text CHECK (length(utm_content) <= 200),
  gclid             text CHECK (length(gclid) <= 500),
  gbraid            text CHECK (length(gbraid) <= 500),
  wbraid            text CHECK (length(wbraid) <= 500),
  fbclid            text CHECK (length(fbclid) <= 500),
  fbp               text CHECK (length(fbp) <= 500),
  fbc               text CHECK (length(fbc) <= 500),
  meta_lead_id      text CHECK (length(meta_lead_id) <= 100),
  google_lead_id    text CHECK (length(google_lead_id) <= 200),
  merged_into       uuid REFERENCES public.leads(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  last_activity_at  timestamptz NOT NULL DEFAULT now(),
  status_changed_at timestamptz,
  CHECK (merged_into IS NULL OR merged_into <> id)
);
CREATE INDEX IF NOT EXISTS leads_email_idx ON public.leads (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_phone_idx ON public.leads (phone_e164) WHERE phone_e164 IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_list_idx ON public.leads (is_test, status, last_activity_at DESC) WHERE merged_into IS NULL;
CREATE INDEX IF NOT EXISTS leads_merged_into_idx ON public.leads (merged_into) WHERE merged_into IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lead_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('submission', 'status', 'merge', 'conversion')),
  source      text NOT NULL CHECK (source IN ('contact', 'wholesale', 'meta', 'google', 'owner', 'system')),
  external_id text CHECK (length(external_id) <= 200),
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (octet_length(detail::text) <= 16384),
  actor       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lead_events_source_external_uq
  ON public.lead_events (source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS lead_events_lead_idx ON public.lead_events (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lead_events_actor_idx ON public.lead_events (actor) WHERE actor IS NOT NULL;

-- Raw Meta Lead Ads webhook changes, archived before the Graph fetch.
CREATE TABLE IF NOT EXISTS public.lead_inbox (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     text NOT NULL CHECK (provider IN ('meta')),
  external_id  text NOT NULL CHECK (length(external_id) BETWEEN 1 AND 100),
  payload      jsonb NOT NULL CHECK (octet_length(payload::text) <= 65536),
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts     smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 100),
  last_error   text CHECK (length(last_error) <= 1000),
  lead_id      uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  UNIQUE (provider, external_id)
);
CREATE INDEX IF NOT EXISTS lead_inbox_pending_idx ON public.lead_inbox (received_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS lead_inbox_lead_idx ON public.lead_inbox (lead_id) WHERE lead_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lead_conversions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  platform    text NOT NULL CHECK (platform IN ('meta', 'google')),
  stage       text NOT NULL CHECK (stage IN ('qualified', 'won')),
  event_id    uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_time  timestamptz NOT NULL DEFAULT now(),
  value_paise bigint CHECK (value_paise IS NULL OR value_paise >= 0),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts    smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 100),
  last_error  text CHECK (length(last_error) <= 1000),
  sent_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, platform, stage)
);
CREATE INDEX IF NOT EXISTS lead_conversions_pending_idx ON public.lead_conversions (created_at) WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- B) Privileges and RLS: owner reads, nobody writes directly
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_inbox       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_conversions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.leads, public.lead_events, public.lead_inbox, public.lead_conversions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.lead_ref_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.leads, public.lead_events, public.lead_inbox, public.lead_conversions TO authenticated;
GRANT ALL ON TABLE public.leads, public.lead_events, public.lead_inbox, public.lead_conversions TO service_role;
GRANT USAGE ON SEQUENCE public.lead_ref_seq TO service_role;

DROP POLICY IF EXISTS "Owner reads leads" ON public.leads;
CREATE POLICY "Owner reads leads" ON public.leads FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
DROP POLICY IF EXISTS "Owner reads lead events" ON public.lead_events;
CREATE POLICY "Owner reads lead events" ON public.lead_events FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
DROP POLICY IF EXISTS "Owner reads lead inbox" ON public.lead_inbox;
CREATE POLICY "Owner reads lead inbox" ON public.lead_inbox FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
DROP POLICY IF EXISTS "Owner reads lead conversions" ON public.lead_conversions;
CREATE POLICY "Owner reads lead conversions" ON public.lead_conversions FOR SELECT TO authenticated USING ((SELECT public.is_admin()));



-- ---------------------------------------------------------------------------
-- C) lead_capture: the single entry point (service_role only)
-- ---------------------------------------------------------------------------
-- Trimmed, control-character-free, length-capped text; '' becomes NULL.
CREATE OR REPLACE FUNCTION public.lead_clip(p_value text, p_max integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT nullif(left(btrim(regexp_replace(coalesce(p_value, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')), p_max), '')
$$;

-- p keys: source, external_id, full_name, email, phone, company, city, message,
-- is_test, ad_consent, utm_source..utm_content, gclid, gbraid, wbraid, fbclid,
-- fbp, fbc, meta_lead_id, google_lead_id, detail (jsonb), received_at.
-- The app normalises e-mail and phone (E.164) first; values that still fail
-- the checks are dropped rather than failing the capture. Ad click
-- identifiers are kept only when ad_consent is true for this submission.
CREATE OR REPLACE FUNCTION public.lead_capture(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source  text := p->>'source';
  v_ext     text := public.lead_clip(p->>'external_id', 200);
  v_email   text := lower(public.lead_clip(p->>'email', 254));
  v_phone   text := public.lead_clip(p->>'phone', 16);
  v_test    boolean := coalesce((p->>'is_test')::boolean, false);
  v_consent boolean := coalesce((p->>'ad_consent')::boolean, false);
  v_at      timestamptz := least(coalesce((p->>'received_at')::timestamptz, now()), now());
  v_detail  jsonb := coalesce(p->'detail', '{}'::jsonb);
  v_lead    public.leads%ROWTYPE;
  v_found   boolean;
  v_dup     uuid;
  v_target  uuid;
  v_lock    bigint;
BEGIN
  IF v_source IS NULL OR v_source NOT IN ('contact', 'wholesale', 'meta', 'google') THEN
    RAISE EXCEPTION 'INVALID_SOURCE' USING ERRCODE = '22023';
  END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+$' THEN v_email := NULL; END IF;
  IF v_phone IS NOT NULL AND v_phone !~ '^\+[1-9][0-9]{7,14}$' THEN v_phone := NULL; END IF;
  IF jsonb_typeof(v_detail) <> 'object' OR octet_length(v_detail::text) > 16000 THEN
    v_detail := jsonb_build_object('detail_dropped', true);
  END IF;

  -- Serialise on the source event and on each contact key, always in the
  -- same order, so parallel deliveries / submissions cannot create twins.
  FOR v_lock IN
    SELECT DISTINCT hashtextextended(k, 0) AS h FROM unnest(ARRAY[
      CASE WHEN v_ext   IS NOT NULL THEN 'lead-ext:' || v_source || ':' || v_ext END,
      CASE WHEN v_email IS NOT NULL THEN 'lead-em:' || v_test::text || ':' || v_email END,
      CASE WHEN v_phone IS NOT NULL THEN 'lead-ph:' || v_test::text || ':' || v_phone END
    ]) AS k WHERE k IS NOT NULL ORDER BY h
  LOOP
    PERFORM pg_advisory_xact_lock(v_lock);
  END LOOP;

  IF v_ext IS NOT NULL THEN
    SELECT e.lead_id INTO v_dup FROM public.lead_events e WHERE e.source = v_source AND e.external_id = v_ext;
    IF FOUND THEN
      RETURN jsonb_build_object('lead_id', v_dup, 'duplicate', true, 'existing', true);
    END IF;
  END IF;

  -- Match on e-mail or phone, including leads already merged away (their
  -- merged_into points at the surviving lead; merges keep that one hop).
  SELECT coalesce(l.merged_into, l.id) INTO v_target FROM public.leads l
   WHERE l.is_test = v_test
     AND ((v_email IS NOT NULL AND l.email = v_email) OR (v_phone IS NOT NULL AND l.phone_e164 = v_phone))
   ORDER BY (l.merged_into IS NULL) DESC, l.created_at
   LIMIT 1;
  v_found := false;
  IF v_target IS NOT NULL THEN
    SELECT l.* INTO v_lead FROM public.leads l WHERE l.id = v_target AND l.merged_into IS NULL FOR UPDATE;
    v_found := FOUND;
  END IF;

  IF v_found THEN
    UPDATE public.leads l SET
      full_name      = coalesce(l.full_name, public.lead_clip(p->>'full_name', 200)),
      email          = coalesce(l.email, v_email),
      phone_e164     = coalesce(l.phone_e164, v_phone),
      company        = coalesce(l.company, public.lead_clip(p->>'company', 200)),
      city           = coalesce(l.city, public.lead_clip(p->>'city', 120)),
      message        = coalesce(public.lead_clip(p->>'message', 4000), l.message),
      ad_consent     = l.ad_consent OR v_consent,
      utm_source     = coalesce(l.utm_source,   public.lead_clip(p->>'utm_source', 200)),
      utm_medium     = coalesce(l.utm_medium,   public.lead_clip(p->>'utm_medium', 200)),
      utm_campaign   = coalesce(l.utm_campaign, public.lead_clip(p->>'utm_campaign', 200)),
      utm_term       = coalesce(l.utm_term,     public.lead_clip(p->>'utm_term', 200)),
      utm_content    = coalesce(l.utm_content,  public.lead_clip(p->>'utm_content', 200)),
      gclid          = coalesce(l.gclid,  CASE WHEN v_consent THEN public.lead_clip(p->>'gclid', 500) END),
      gbraid         = coalesce(l.gbraid, CASE WHEN v_consent THEN public.lead_clip(p->>'gbraid', 500) END),
      wbraid         = coalesce(l.wbraid, CASE WHEN v_consent THEN public.lead_clip(p->>'wbraid', 500) END),
      fbclid         = coalesce(l.fbclid, CASE WHEN v_consent THEN public.lead_clip(p->>'fbclid', 500) END),
      fbp            = coalesce(l.fbp,    CASE WHEN v_consent THEN public.lead_clip(p->>'fbp', 500) END),
      fbc            = coalesce(l.fbc,    CASE WHEN v_consent THEN public.lead_clip(p->>'fbc', 500) END),
      meta_lead_id   = coalesce(l.meta_lead_id,   public.lead_clip(p->>'meta_lead_id', 100)),
      google_lead_id = coalesce(l.google_lead_id, public.lead_clip(p->>'google_lead_id', 200)),
      status            = CASE WHEN l.status = 'lost' THEN 'new' ELSE l.status END,
      status_changed_at = CASE WHEN l.status = 'lost' THEN now() ELSE l.status_changed_at END,
      last_activity_at  = greatest(l.last_activity_at, v_at),
      updated_at        = now()
    WHERE l.id = v_lead.id
    RETURNING l.* INTO v_lead;
  ELSE
    INSERT INTO public.leads (
      full_name, email, phone_e164, company, city, message, first_source, is_test, ad_consent,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      gclid, gbraid, wbraid, fbclid, fbp, fbc, meta_lead_id, google_lead_id,
      created_at, last_activity_at)
    VALUES (
      public.lead_clip(p->>'full_name', 200), v_email, v_phone,
      public.lead_clip(p->>'company', 200), public.lead_clip(p->>'city', 120),
      public.lead_clip(p->>'message', 4000), v_source, v_test, v_consent,
      public.lead_clip(p->>'utm_source', 200), public.lead_clip(p->>'utm_medium', 200),
      public.lead_clip(p->>'utm_campaign', 200), public.lead_clip(p->>'utm_term', 200),
      public.lead_clip(p->>'utm_content', 200),
      CASE WHEN v_consent THEN public.lead_clip(p->>'gclid', 500) END,
      CASE WHEN v_consent THEN public.lead_clip(p->>'gbraid', 500) END,
      CASE WHEN v_consent THEN public.lead_clip(p->>'wbraid', 500) END,
      CASE WHEN v_consent THEN public.lead_clip(p->>'fbclid', 500) END,
      CASE WHEN v_consent THEN public.lead_clip(p->>'fbp', 500) END,
      CASE WHEN v_consent THEN public.lead_clip(p->>'fbc', 500) END,
      public.lead_clip(p->>'meta_lead_id', 100), public.lead_clip(p->>'google_lead_id', 200),
      v_at, v_at)
    RETURNING * INTO v_lead;
  END IF;

  INSERT INTO public.lead_events (lead_id, kind, source, external_id, detail, created_at)
  VALUES (v_lead.id, 'submission', v_source, v_ext, v_detail, v_at);

  RETURN jsonb_build_object('lead_id', v_lead.id, 'lead_ref', v_lead.lead_ref,
                            'duplicate', false, 'existing', v_found);
END $$;

-- ---------------------------------------------------------------------------
-- D) Owner actions (checked with is_admin(): role + recent second factor)
-- ---------------------------------------------------------------------------
-- Status / value / notes. NULL leaves a field as it is; notes '' clears it.
-- Moving to qualified or won queues one conversion per platform that can
-- attribute the lead (only with ad consent, never for test leads).
CREATE OR REPLACE FUNCTION public.lead_update(p_lead uuid, p_status text, p_value_paise bigint, p_notes text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v     public.leads%ROWTYPE;
  v_old text;
  v_n   integer := 0;
  v_k   integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('new', 'contacted', 'qualified', 'won', 'lost', 'spam') THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = '22023';
  END IF;
  IF p_value_paise IS NOT NULL AND (p_value_paise < 0 OR p_value_paise > 100000000000) THEN
    RAISE EXCEPTION 'INVALID_VALUE' USING ERRCODE = '22023';
  END IF;

  SELECT l.* INTO v FROM public.leads l WHERE l.id = p_lead AND l.merged_into IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAD_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  v_old := v.status;

  UPDATE public.leads l SET
    status            = coalesce(p_status, l.status),
    value_paise       = coalesce(p_value_paise, l.value_paise),
    notes             = CASE WHEN p_notes IS NULL THEN l.notes ELSE public.lead_clip(p_notes, 4000) END,
    status_changed_at = CASE WHEN coalesce(p_status, l.status) <> l.status THEN now() ELSE l.status_changed_at END,
    updated_at        = now()
  WHERE l.id = p_lead
  RETURNING l.* INTO v;

  IF v.status <> v_old THEN
    INSERT INTO public.lead_events (lead_id, kind, source, detail, actor)
    VALUES (v.id, 'status', 'owner', jsonb_build_object('from', v_old, 'to', v.status), (SELECT auth.uid()));

    IF v.status IN ('qualified', 'won') AND NOT v.is_test AND v.ad_consent THEN
      IF v.meta_lead_id IS NOT NULL OR v.fbc IS NOT NULL OR v.fbclid IS NOT NULL OR v.fbp IS NOT NULL THEN
        INSERT INTO public.lead_conversions (lead_id, platform, stage, value_paise)
        VALUES (v.id, 'meta', v.status, CASE WHEN v.status = 'won' THEN v.value_paise END)
        ON CONFLICT (lead_id, platform, stage) DO NOTHING;
        GET DIAGNOSTICS v_k = ROW_COUNT;
        v_n := v_n + v_k;
      END IF;
      IF v.gclid IS NOT NULL OR v.gbraid IS NOT NULL OR v.wbraid IS NOT NULL THEN
        INSERT INTO public.lead_conversions (lead_id, platform, stage, value_paise)
        VALUES (v.id, 'google', v.status, CASE WHEN v.status = 'won' THEN v.value_paise END)
        ON CONFLICT (lead_id, platform, stage) DO NOTHING;
        GET DIAGNOSTICS v_k = ROW_COUNT;
        v_n := v_n + v_k;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('status', v.status, 'conversions_queued', v_n);
END $$;

-- Merge p_drop into p_keep: history, conversions and blank fields move to
-- p_keep; p_drop stays as a pointer (merged_into), so nothing is lost.
CREATE OR REPLACE FUNCTION public.lead_merge(p_keep uuid, p_drop uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  k public.leads%ROWTYPE;
  d public.leads%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN' USING ERRCODE = '42501';
  END IF;
  IF p_keep IS NULL OR p_drop IS NULL OR p_keep = p_drop THEN
    RAISE EXCEPTION 'CANNOT_MERGE' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.leads l WHERE l.id IN (p_keep, p_drop) ORDER BY l.id FOR UPDATE;
  SELECT l.* INTO k FROM public.leads l WHERE l.id = p_keep;
  SELECT l.* INTO d FROM public.leads l WHERE l.id = p_drop;
  IF k.id IS NULL OR d.id IS NULL OR k.merged_into IS NOT NULL OR d.merged_into IS NOT NULL OR k.is_test <> d.is_test THEN
    RAISE EXCEPTION 'CANNOT_MERGE' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.lead_conversions c
   WHERE c.lead_id = p_drop
     AND EXISTS (SELECT 1 FROM public.lead_conversions x
                  WHERE x.lead_id = p_keep AND x.platform = c.platform AND x.stage = c.stage);
  UPDATE public.lead_conversions SET lead_id = p_keep WHERE lead_id = p_drop;
  UPDATE public.lead_events      SET lead_id = p_keep WHERE lead_id = p_drop;
  UPDATE public.lead_inbox       SET lead_id = p_keep WHERE lead_id = p_drop;

  UPDATE public.leads l SET
    full_name        = coalesce(l.full_name, d.full_name),
    email            = coalesce(l.email, d.email),
    phone_e164       = coalesce(l.phone_e164, d.phone_e164),
    company          = coalesce(l.company, d.company),
    city             = coalesce(l.city, d.city),
    message          = coalesce(l.message, d.message),
    notes            = coalesce(l.notes, d.notes),
    value_paise      = coalesce(l.value_paise, d.value_paise),
    ad_consent       = l.ad_consent OR d.ad_consent,
    utm_source       = coalesce(l.utm_source, d.utm_source),
    utm_medium       = coalesce(l.utm_medium, d.utm_medium),
    utm_campaign     = coalesce(l.utm_campaign, d.utm_campaign),
    utm_term         = coalesce(l.utm_term, d.utm_term),
    utm_content      = coalesce(l.utm_content, d.utm_content),
    gclid            = coalesce(l.gclid, d.gclid),
    gbraid           = coalesce(l.gbraid, d.gbraid),
    wbraid           = coalesce(l.wbraid, d.wbraid),
    fbclid           = coalesce(l.fbclid, d.fbclid),
    fbp              = coalesce(l.fbp, d.fbp),
    fbc              = coalesce(l.fbc, d.fbc),
    meta_lead_id     = coalesce(l.meta_lead_id, d.meta_lead_id),
    google_lead_id   = coalesce(l.google_lead_id, d.google_lead_id),
    created_at       = least(l.created_at, d.created_at),
    last_activity_at = greatest(l.last_activity_at, d.last_activity_at),
    updated_at       = now()
  WHERE l.id = p_keep;

  UPDATE public.leads SET merged_into = p_keep, updated_at = now() WHERE id = p_drop;
  UPDATE public.leads SET merged_into = p_keep WHERE merged_into = p_drop;

  INSERT INTO public.lead_events (lead_id, kind, source, detail, actor)
  VALUES (p_keep, 'merge', 'owner', jsonb_build_object('merged_ref', d.lead_ref), (SELECT auth.uid()));

  RETURN jsonb_build_object('kept', p_keep, 'merged_ref', d.lead_ref);
END $$;

REVOKE ALL ON FUNCTION public.lead_clip(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lead_capture(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lead_update(uuid, text, bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lead_merge(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_clip(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.lead_capture(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.lead_update(uuid, text, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lead_merge(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- E) Legacy inboxes: copy into the pipeline, close to public inserts
-- ---------------------------------------------------------------------------
SELECT public.lead_capture(jsonb_build_object(
  'source', 'contact', 'external_id', 'legacy:' || c.id,
  'full_name', btrim(c.first_name || ' ' || c.last_name), 'email', c.email,
  'city', c.location, 'message', c.message, 'received_at', c.created_at,
  'detail', jsonb_build_object('form', 'contact', 'legacy', true)))
FROM public.contact_inquiries c ORDER BY c.created_at;

SELECT public.lead_capture(jsonb_build_object(
  'source', 'wholesale', 'external_id', 'legacy:' || w.id,
  'company', w.business_name, 'email', w.email, 'message', w.requirements,
  'received_at', w.created_at,
  'detail', jsonb_build_object('form', 'wholesale', 'legacy', true, 'gstin', w.tax_id)))
FROM public.wholesale_applications w ORDER BY w.created_at;

-- The forms now write through lead_capture (service role).
DROP POLICY IF EXISTS "Anyone can insert contact inquiries" ON public.contact_inquiries;
DROP POLICY IF EXISTS "Anyone can insert wholesale applications" ON public.wholesale_applications;
REVOKE INSERT ON public.contact_inquiries, public.wholesale_applications FROM anon, authenticated;
