import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { providerBase } from '@/lib/otp';
import { googleIngestBody, metaCapiBody, type ConversionLead, type ConversionRow } from './conversion-payloads';

// Sends queued lead outcomes (public.lead_conversions) to Meta's Conversions
// API and Google's Data Manager API. A platform that is not configured is
// skipped and its rows stay queued; a failure is retried up to MAX_ATTEMPTS
// times by /api/cron/leads. event_id is stable per row, so a retry after an
// unclear failure is de-duplicated by the platform.

const MAX_ATTEMPTS = 5;
const GRAPH = 'https://graph.facebook.com/v21.0';
const DATA_MANAGER = 'https://datamanager.googleapis.com/v1';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';

export const metaCapiConfigured = () => Boolean(process.env.META_PIXEL_ID && process.env.META_CAPI_TOKEN);
export const googleConversionsConfigured = () =>
  Boolean(process.env.GOOGLE_DM_CLIENT_ID && process.env.GOOGLE_DM_CLIENT_SECRET && process.env.GOOGLE_DM_REFRESH_TOKEN && process.env.GOOGLE_ADS_CUSTOMER_ID);

const googleActionFor = (stage: ConversionRow['stage']) =>
  (stage === 'won' ? process.env.GOOGLE_ADS_WON_ACTION_ID : process.env.GOOGLE_ADS_QUALIFIED_ACTION_ID) || null;

const digits = (s: string | undefined) => (s ?? '').replace(/\D/g, '') || null;

type Outcome = { ok: true } | { ok: false; error: string };

async function postJson(url: string, body: unknown, headers: Record<string, string>): Promise<Outcome> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  if (res.ok) return { ok: true };
  const json = (await res.json().catch(() => null)) as { error?: { message?: string; code?: number | string } } | null;
  return { ok: false, error: `HTTP ${res.status}: ${String(json?.error?.message ?? '').slice(0, 300)}` };
}

async function sendMeta(lead: ConversionLead, conv: ConversionRow): Promise<Outcome> {
  // test_event_code only outside production, so live events are never marked as tests.
  const testCode = process.env.VERCEL_ENV === 'production' ? null : process.env.META_CAPI_TEST_CODE || null;
  const base = providerBase(process.env.META_GRAPH_API_BASE, GRAPH);
  return postJson(`${base}/${encodeURIComponent(process.env.META_PIXEL_ID!)}/events`, metaCapiBody(lead, conv, { testEventCode: testCode }), {
    Authorization: `Bearer ${process.env.META_CAPI_TOKEN}`,
  });
}

let googleToken: { value: string; expires: number } | null = null;

async function googleAccessToken(): Promise<string> {
  if (googleToken && googleToken.expires > Date.now() + 60_000) return googleToken.value;
  const res = await fetch(providerBase(process.env.GOOGLE_OAUTH_TOKEN_URL, GOOGLE_TOKEN), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.GOOGLE_DM_CLIENT_ID!,
      client_secret: process.env.GOOGLE_DM_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_DM_REFRESH_TOKEN!,
    }),
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; error?: string } | null;
  if (!res.ok || !json?.access_token) throw new Error(`Google token: HTTP ${res.status} ${String(json?.error ?? '').slice(0, 100)}`);
  googleToken = { value: json.access_token, expires: Date.now() + Math.max(60, Number(json.expires_in) || 3600) * 1000 };
  return googleToken.value;
}

async function sendGoogle(lead: ConversionLead, conv: ConversionRow, actionId: string): Promise<Outcome> {
  const token = await googleAccessToken();
  const base = providerBase(process.env.GOOGLE_DM_API_BASE, DATA_MANAGER);
  const body = googleIngestBody(lead, conv, {
    customerId: digits(process.env.GOOGLE_ADS_CUSTOMER_ID)!,
    loginCustomerId: digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID),
    conversionActionId: actionId,
  });
  return postJson(`${base}/events:ingest`, body, { Authorization: `Bearer ${token}` });
}

const LEAD_COLUMNS = 'email, phone_e164, full_name, city, fbc, fbp, fbclid, meta_lead_id, gclid, gbraid, wbraid, created_at';

export async function sendPendingConversions(limit = 25, onlyLead?: string): Promise<{ sent: number; failed: number; waiting: number }> {
  const admin = createAdminClient();
  let q = admin
    .from('lead_conversions')
    .select(`id, lead_id, platform, stage, event_id, event_time, value_paise, attempts, leads!inner(${LEAD_COLUMNS})`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (onlyLead) q = q.eq('lead_id', onlyLead);
  const { data, error } = await q;
  if (error) throw new Error(`lead_conversions: ${error.message}`);

  let sent = 0;
  let failed = 0;
  let waiting = 0;
  for (const row of data ?? []) {
    const lead = row.leads as unknown as ConversionLead;
    const conv = row as unknown as ConversionRow;
    let outcome: Outcome;
    try {
      if (row.platform === 'meta') {
        if (!metaCapiConfigured()) { waiting += 1; continue; }
        outcome = await sendMeta(lead, conv);
      } else {
        const action = googleActionFor(conv.stage);
        if (!googleConversionsConfigured() || !action) { waiting += 1; continue; }
        outcome = await sendGoogle(lead, conv, action);
      }
    } catch (e) {
      outcome = { ok: false, error: (e as Error).message.slice(0, 300) };
    }

    const attempts = row.attempts + 1;
    const final = outcome.ok || attempts >= MAX_ATTEMPTS;
    await admin.from('lead_conversions').update(
      outcome.ok
        ? { status: 'sent', sent_at: new Date().toISOString(), attempts, last_error: null }
        : { status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', attempts, last_error: outcome.error },
    ).eq('id', row.id).eq('status', 'pending');
    if (final) {
      await admin.from('lead_events').insert({
        lead_id: row.lead_id, kind: 'conversion', source: 'system',
        detail: { platform: row.platform, stage: row.stage, ok: outcome.ok },
      });
    }
    if (outcome.ok) sent += 1; else failed += 1;
  }
  return { sent, failed, waiting };
}
