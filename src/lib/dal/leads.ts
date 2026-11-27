import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from './session';

// Owner CRM reads. Each function checks admin itself; RLS (is_admin()) is the
// second wall. Returns plain DTOs.

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost', 'spam'] as const;
export const LEAD_SOURCES = ['contact', 'wholesale', 'meta', 'google'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const SOURCE_LABEL: Record<string, string> = {
  contact: 'Contact form',
  wholesale: 'Wholesale form',
  meta: 'Meta lead ad',
  google: 'Google lead form',
};

export interface LeadFilters {
  status: LeadStatus | null;
  source: string | null;
  q: string | null;
  test: boolean;
}

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export function parseLeadFilters(sp: SP): LeadFilters {
  const status = one(sp.status);
  const source = one(sp.source);
  // Search text goes into a PostgREST or() filter: keep letters, digits and
  // a few safe symbols only, so it cannot add filter syntax.
  const q = one(sp.q).normalize('NFKC').replace(/[^\p{L}\p{N}@.+\- ]/gu, '').trim().slice(0, 60);
  return {
    status: (LEAD_STATUSES as readonly string[]).includes(status) ? (status as LeadStatus) : null,
    source: (LEAD_SOURCES as readonly string[]).includes(source) ? source : null,
    q: q || null,
    test: one(sp.test) === '1',
  };
}

export interface LeadRow {
  id: string;
  lead_ref: string;
  full_name: string | null;
  email: string | null;
  phone_e164: string | null;
  company: string | null;
  city: string | null;
  message: string | null;
  first_source: string;
  status: LeadStatus;
  value_paise: number | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
  last_activity_at: string;
}

const LIST_COLUMNS =
  'id, lead_ref, full_name, email, phone_e164, company, city, message, first_source, status, value_paise, utm_source, utm_medium, utm_campaign, created_at, last_activity_at';

export async function listLeads(f: LeadFilters, limit = 200): Promise<LeadRow[]> {
  await requireAdmin();
  const supabase = await createClient();
  let query = supabase
    .from('leads')
    .select(LIST_COLUMNS)
    .is('merged_into', null)
    .eq('is_test', f.test)
    .order('last_activity_at', { ascending: false })
    .limit(limit);
  if (f.status) query = query.eq('status', f.status);
  if (f.source) query = query.eq('first_source', f.source);
  if (f.q) {
    const like = `%${f.q.replace(/ /g, '%')}%`;
    query = query.or(['full_name', 'email', 'company', 'phone_e164', 'lead_ref'].map((c) => `${c}.ilike.${like}`).join(','));
  }
  const { data, error } = await query;
  if (error) throw new Error(`leads: ${error.message}`);
  return (data ?? []) as LeadRow[];
}

export interface PipelineSummary {
  byStatus: Record<LeadStatus, number>;
  conversions: { sent: number; pending: number; failed: number };
  inboxWaiting: number;
  inboxTokenProblem: number;
}

export async function pipelineSummary(): Promise<PipelineSummary> {
  await requireAdmin();
  const supabase = await createClient();
  const [statuses, conv, inbox, token] = await Promise.all([
    supabase.from('leads').select('status').is('merged_into', null).eq('is_test', false).limit(20000),
    supabase.from('lead_conversions').select('status').limit(20000),
    supabase.from('lead_inbox').select('id', { count: 'exact', head: true }).is('processed_at', null),
    supabase.from('lead_inbox').select('id', { count: 'exact', head: true }).is('processed_at', null).like('last_error', 'TOKEN_INVALID:%'),
  ]);
  const byStatus = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<LeadStatus, number>;
  for (const r of statuses.data ?? []) byStatus[r.status as LeadStatus] = (byStatus[r.status as LeadStatus] ?? 0) + 1;
  const conversions = { sent: 0, pending: 0, failed: 0 };
  for (const r of conv.data ?? []) conversions[r.status as keyof typeof conversions] += 1;
  return { byStatus, conversions, inboxWaiting: inbox.count ?? 0, inboxTokenProblem: token.count ?? 0 };
}

export interface LeadDetail extends LeadRow {
  notes: string | null;
  is_test: boolean;
  ad_consent: boolean;
  merged_into: string | null;
  utm_term: string | null;
  utm_content: string | null;
  has_google_click: boolean;
  has_meta_signal: boolean;
}

export interface LeadEventRow {
  id: string;
  kind: string;
  source: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface ConversionDto {
  platform: string;
  stage: string;
  status: string;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
}

export async function getLead(id: string): Promise<{
  lead: LeadDetail;
  events: LeadEventRow[];
  conversions: ConversionDto[];
  duplicates: LeadRow[];
} | null> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data: raw } = await supabase
    .from('leads')
    .select(`${LIST_COLUMNS}, notes, is_test, ad_consent, merged_into, utm_term, utm_content, gclid, gbraid, wbraid, fbc, fbp, fbclid, meta_lead_id`)
    .eq('id', id)
    .maybeSingle();
  if (!raw) return null;
  const { gclid, gbraid, wbraid, fbc, fbp, fbclid, meta_lead_id, ...rest } = raw as Record<string, unknown>;
  // Click ids stay server-side; the page only needs to know they exist.
  const lead = {
    ...rest,
    has_google_click: Boolean(gclid || gbraid || wbraid),
    has_meta_signal: Boolean(fbc || fbp || fbclid || meta_lead_id),
  } as LeadDetail;

  const [events, conversions, byEmail, byPhone, byName] = await Promise.all([
    supabase.from('lead_events').select('id, kind, source, detail, created_at').eq('lead_id', id).order('created_at', { ascending: false }).limit(100),
    supabase.from('lead_conversions').select('platform, stage, status, attempts, last_error, sent_at').eq('lead_id', id).order('created_at'),
    lead.email ? dupQuery(supabase, lead).eq('email', lead.email) : null,
    lead.phone_e164 ? dupQuery(supabase, lead).eq('phone_e164', lead.phone_e164) : null,
    lead.full_name && lead.full_name.length >= 4 ? dupQuery(supabase, lead).ilike('full_name', lead.full_name.replace(/[%_\\]/g, '')) : null,
  ]);
  const seen = new Map<string, LeadRow>();
  for (const r of [byEmail, byPhone, byName]) for (const d of (r?.data ?? []) as LeadRow[]) seen.set(d.id, d);
  return {
    lead,
    events: (events.data ?? []) as LeadEventRow[],
    conversions: (conversions.data ?? []) as ConversionDto[],
    duplicates: [...seen.values()].slice(0, 10),
  };
}

function dupQuery(supabase: Awaited<ReturnType<typeof createClient>>, lead: LeadDetail) {
  return supabase
    .from('leads')
    .select(LIST_COLUMNS)
    .is('merged_into', null)
    .eq('is_test', lead.is_test)
    .neq('id', lead.id)
    .limit(10);
}
