// Pure helpers for the lead pipeline: no I/O, safe to unit test and to import
// from route handlers. Everything here treats its input as hostile.

export type LeadSource = 'contact' | 'wholesale' | 'meta' | 'google';

/** What lead_capture() accepts (see supabase/migrations/0054_lead_crm.sql). */
export interface LeadInput {
  source: LeadSource;
  external_id?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  city?: string | null;
  message?: string | null;
  is_test?: boolean;
  ad_consent?: boolean;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  fbclid?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  meta_lead_id?: string | null;
  google_lead_id?: string | null;
  received_at?: string | null;
  detail?: Record<string, unknown>;
}

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  // eslint-disable-next-line no-control-regex
  const s = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return s ? s.slice(0, max) : null;
};

export function normaliseEmail(v: unknown): string | null {
  const s = str(v, 254)?.toLowerCase() ?? null;
  return s && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s : null;
}

/**
 * E.164. Indian numbers may come as 10 digits, 0 + 10, 91 + 10 or +91 ...;
 * other countries only with an explicit +.
 */
export function normalisePhone(v: unknown): string | null {
  const raw = str(v, 40);
  if (!raw) return null;
  const plus = raw.startsWith('+');
  const d = raw.replace(/\D/g, '');
  if (!plus) {
    if (/^[6-9]\d{9}$/.test(d)) return `+91${d}`;
    if (/^0[6-9]\d{9}$/.test(d)) return `+91${d.slice(1)}`;
    if (/^91[6-9]\d{9}$/.test(d)) return `+${d}`;
    return null;
  }
  if (d.startsWith('91')) return /^91[6-9]\d{9}$/.test(d) ? `+${d}` : null;
  return /^[1-9]\d{7,14}$/.test(d) ? `+${d}` : null;
}

export function splitName(full: string | null | undefined): { first: string | null; last: string | null } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  return { first: parts[0], last: parts.length > 1 ? parts[parts.length - 1] : null };
}

// ---------------------------------------------------------------------------
// Attribution captured on the website (first touch of the browser session)
// ---------------------------------------------------------------------------
export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
export const CLICK_KEYS = ['gclid', 'gbraid', 'wbraid', 'fbclid'] as const;
export type Attribution = Partial<Record<(typeof UTM_KEYS)[number] | (typeof CLICK_KEYS)[number], string>>;

const CLICK_ID_RE = /^[A-Za-z0-9._~\-]{1,500}$/;
const FB_COOKIE_RE = /^fb\.[0-9]\.[0-9]{10,13}\.[A-Za-z0-9._~\-]{1,480}$/;

/**
 * Keeps only known keys with sane values. Campaign tags (utm_*) are kept
 * always; ad click identifiers only with the visitor's ad-measurement consent.
 */
export function cleanAttribution(input: unknown, adConsent: boolean): Attribution {
  const out: Attribution = {};
  if (!input || typeof input !== 'object') return out;
  const o = input as Record<string, unknown>;
  for (const k of UTM_KEYS) {
    const v = str(o[k], 200);
    if (v) out[k] = v;
  }
  if (adConsent) {
    for (const k of CLICK_KEYS) {
      const v = str(o[k], 500);
      if (v && CLICK_ID_RE.test(v)) out[k] = v;
    }
  }
  return out;
}

/** Meta browser cookies (_fbp / _fbc) when present and well-formed. */
export function cleanFbCookie(v: string | undefined | null): string | null {
  return v && FB_COOKIE_RE.test(v) ? v : null;
}

/** Meta's documented _fbc format, built from a landing-page fbclid. */
export function fbcFromFbclid(fbclid: string | null | undefined, atMs: number): string | null {
  return fbclid && CLICK_ID_RE.test(fbclid) ? `fb.1.${Math.floor(atMs)}.${fbclid}` : null;
}

// ---------------------------------------------------------------------------
// Meta Lead Ads
// ---------------------------------------------------------------------------
export interface MetaLeadgenChange {
  leadgen_id: string;
  form_id: string | null;
  page_id: string | null;
  ad_id: string | null;
  created_time: number | null;
}

const META_ID_RE = /^[0-9]{1,30}$/;

/** `leadgen` changes from a Page webhook body; anything else is ignored. */
export function extractLeadgenChanges(body: unknown): MetaLeadgenChange[] {
  const out: MetaLeadgenChange[] = [];
  const entries = (body as { entry?: unknown })?.entry;
  if (!Array.isArray(entries)) return out;
  for (const e of entries.slice(0, 100)) {
    const changes = (e as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const c of changes.slice(0, 100)) {
      const ch = c as { field?: unknown; value?: Record<string, unknown> };
      if (ch?.field !== 'leadgen' || !ch.value) continue;
      const id = str(ch.value.leadgen_id, 30);
      if (!id || !META_ID_RE.test(id)) continue;
      const opt = (k: string) => {
        const v = str(ch.value![k], 30);
        return v && META_ID_RE.test(v) ? v : null;
      };
      const t = Number(ch.value.created_time);
      out.push({ leadgen_id: id, form_id: opt('form_id'), page_id: opt('page_id'), ad_id: opt('ad_id'), created_time: Number.isFinite(t) && t > 0 ? t : null });
    }
  }
  return out;
}

type Answer = { q: string; a: string };

/** Graph lead `field_data` -> lead fields; other questions kept as answers. */
export function metaFieldsToLead(fieldData: unknown): { fields: Partial<LeadInput>; answers: Answer[]; isTest: boolean } {
  const fields: Partial<LeadInput> = {};
  const answers: Answer[] = [];
  let first: string | null = null;
  let last: string | null = null;
  let isTest = false;
  if (!Array.isArray(fieldData)) return { fields, answers, isTest };
  for (const f of fieldData.slice(0, 50)) {
    const name = str((f as { name?: unknown })?.name, 100)?.toLowerCase();
    const values = (f as { values?: unknown })?.values;
    const value = Array.isArray(values) ? str(values.map((x) => String(x)).join(', '), 1000) : null;
    if (!name || !value) continue;
    // Meta's Lead Ads Testing Tool fills every field with "<test lead: ...>".
    if (value.startsWith('<test lead')) isTest = true;
    switch (name) {
      case 'full_name': fields.full_name = value.slice(0, 200); break;
      case 'first_name': first = value; break;
      case 'last_name': last = value; break;
      case 'email': case 'work_email': fields.email = fields.email ?? normaliseEmail(value); break;
      case 'phone_number': case 'work_phone_number': fields.phone = fields.phone ?? normalisePhone(value); break;
      case 'city': fields.city = value.slice(0, 120); break;
      case 'company_name': fields.company = value.slice(0, 200); break;
      default: if (answers.length < 20) answers.push({ q: name.slice(0, 100), a: value.slice(0, 500) });
    }
  }
  if (!fields.full_name && (first || last)) fields.full_name = [first, last].filter(Boolean).join(' ').slice(0, 200);
  return { fields, answers, isTest };
}

// ---------------------------------------------------------------------------
// Google Ads lead form webhook
// ---------------------------------------------------------------------------
export interface GoogleLead {
  leadId: string;
  googleKey: string | null;
  isTest: boolean;
  gclid: string | null;
  formId: string | null;
  campaignId: string | null;
  adgroupId: string | null;
  creativeId: string | null;
  fields: Partial<LeadInput>;
  answers: Answer[];
}

/** Parses the documented webhook body; returns null if it is not one. */
export function parseGoogleLead(body: unknown): GoogleLead | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const leadId = str(b.lead_id, 200);
  if (!leadId || !/^[A-Za-z0-9._\-]{1,200}$/.test(leadId)) return null;
  const idOf = (v: unknown) => {
    const s = str(v, 40);
    return s && /^[0-9]{1,40}$/.test(s) ? s : null;
  };
  const gclidRaw = str(b.gcl_id, 500);
  const fields: Partial<LeadInput> = {};
  const answers: Answer[] = [];
  let first: string | null = null;
  let last: string | null = null;
  const cols = Array.isArray(b.user_column_data) ? b.user_column_data.slice(0, 50) : [];
  for (const c of cols) {
    const col = c as { column_id?: unknown; string_value?: unknown; column_name?: unknown };
    const id = str(col?.column_id, 100)?.toUpperCase();
    const value = str(col?.string_value, 1000);
    if (!id || !value) continue;
    switch (id) {
      case 'FULL_NAME': fields.full_name = value.slice(0, 200); break;
      case 'FIRST_NAME': first = value; break;
      case 'LAST_NAME': last = value; break;
      case 'EMAIL': case 'WORK_EMAIL': fields.email = fields.email ?? normaliseEmail(value); break;
      case 'PHONE_NUMBER': case 'WORK_PHONE': fields.phone = fields.phone ?? normalisePhone(value); break;
      case 'CITY': fields.city = value.slice(0, 120); break;
      case 'COMPANY_NAME': fields.company = value.slice(0, 200); break;
      default: {
        // Custom questions are kept as answers; other known columns ignored.
        const label = str(col?.column_name, 100);
        if (label && answers.length < 20 && !/^(POSTAL_CODE|REGION|COUNTRY|STREET_ADDRESS|JOB_TITLE)$/.test(id)) {
          answers.push({ q: label, a: value.slice(0, 500) });
        }
      }
    }
  }
  if (!fields.full_name && (first || last)) fields.full_name = [first, last].filter(Boolean).join(' ').slice(0, 200);
  return {
    leadId,
    googleKey: typeof b.google_key === 'string' ? b.google_key : null,
    isTest: b.is_test === true,
    gclid: gclidRaw && CLICK_ID_RE.test(gclidRaw) ? gclidRaw : null,
    formId: idOf(b.form_id),
    campaignId: idOf(b.campaign_id),
    adgroupId: idOf(b.adgroup_id),
    creativeId: idOf(b.creative_id),
    fields,
    answers,
  };
}
