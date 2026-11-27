import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { providerBase } from '@/lib/otp';
import { captureLead } from './capture';
import { extractLeadgenChanges, metaFieldsToLead, type LeadInput, type MetaLeadgenChange } from './parse';

// Meta Lead Ads: the webhook only says "lead X exists"; the details come from
// the Graph API with a Page access token. Every change is archived in
// public.lead_inbox first (UNIQUE per leadgen_id), so a failed fetch is
// retried by /api/cron/leads and nothing is lost.

const GRAPH = 'https://graph.facebook.com/v21.0';
const MAX_ATTEMPTS = 10;
const LEAD_FIELDS = 'id,created_time,field_data,ad_id,form_id,campaign_id';

export const metaLeadsConfigured = () => Boolean(process.env.META_PAGE_ACCESS_TOKEN);
const graphBase = () => providerBase(process.env.META_GRAPH_API_BASE, GRAPH);

export interface GraphLead {
  id: string;
  created_time?: string;
  field_data?: unknown;
  ad_id?: string;
  form_id?: string;
  campaign_id?: string;
}

export class GraphError extends Error {
  constructor(message: string, readonly tokenProblem: boolean) {
    super(message);
  }
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) throw new GraphError('META_PAGE_ACCESS_TOKEN not set', true);
  const url = new URL(graphBase() + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as { error?: { code?: number; message?: string } } | null;
  if (!res.ok || json?.error) {
    const code = Number(json?.error?.code);
    // 190: token invalid or expired; 102: session problem.
    const tokenProblem = code === 190 || code === 102;
    throw new GraphError(`Graph ${res.status} code ${Number.isFinite(code) ? code : '?'}: ${String(json?.error?.message ?? '').slice(0, 200)}`, tokenProblem);
  }
  return json as T;
}

export const fetchMetaLead = (id: string) => graphGet<GraphLead>(`/${encodeURIComponent(id)}`, { fields: LEAD_FIELDS });

function toLeadInput(lead: GraphLead, change: Partial<MetaLeadgenChange>): LeadInput {
  const { fields, answers, isTest } = metaFieldsToLead(lead.field_data);
  const created = lead.created_time ? Date.parse(lead.created_time) : NaN;
  return {
    source: 'meta',
    external_id: lead.id,
    ...fields,
    is_test: isTest,
    ad_consent: true, // collected by Meta on the advertiser's behalf, under Meta's lead form notice
    meta_lead_id: lead.id,
    received_at: Number.isFinite(created) ? new Date(created).toISOString() : null,
    detail: {
      channel: 'meta_lead_ads',
      form_id: lead.form_id ?? change.form_id ?? null,
      ad_id: lead.ad_id ?? change.ad_id ?? null,
      campaign_id: lead.campaign_id ?? null,
      page_id: change.page_id ?? null,
      answers,
    },
  };
}

/** Archives the webhook's leadgen changes; returns the ids of NEW inbox rows. */
export async function recordMetaChanges(body: unknown): Promise<string[]> {
  const changes = extractLeadgenChanges(body);
  if (changes.length === 0) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('lead_inbox')
    .upsert(changes.map((c) => ({ provider: 'meta', external_id: c.leadgen_id, payload: c })), {
      onConflict: 'provider,external_id',
      ignoreDuplicates: true,
    })
    .select('id');
  if (error) throw new Error(`lead_inbox: ${error.message}`);
  return (data ?? []).map((r) => r.id as string);
}

/** Fetches (unless given) and captures one archived lead. Never throws. */
export async function processMetaInbox(inboxId: string, prefetched?: GraphLead): Promise<'done' | 'failed' | 'skipped'> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from('lead_inbox')
    .select('id, external_id, payload, processed_at, attempts')
    .eq('id', inboxId)
    .maybeSingle();
  if (!row || row.processed_at || row.attempts >= MAX_ATTEMPTS) return 'skipped';
  try {
    const lead = prefetched ?? (await fetchMetaLead(row.external_id));
    if (String(lead.id) !== row.external_id) throw new Error('Graph returned a different lead');
    const r = await captureLead(toLeadInput(lead, (row.payload ?? {}) as Partial<MetaLeadgenChange>));
    if (!r.ok) throw new Error(r.error);
    await admin.from('lead_inbox').update({
      processed_at: new Date().toISOString(), lead_id: r.leadId, attempts: row.attempts + 1, last_error: null,
    }).eq('id', row.id);
    return 'done';
  } catch (e) {
    const msg = (e instanceof GraphError && e.tokenProblem ? 'TOKEN_INVALID: ' : '') + (e as Error).message;
    await admin.from('lead_inbox').update({ attempts: row.attempts + 1, last_error: msg.slice(0, 1000) }).eq('id', row.id);
    return 'failed';
  }
}

export async function retryMetaInbox(limit = 25): Promise<{ retried: number; done: number }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('lead_inbox')
    .select('id')
    .is('processed_at', null)
    .lt('attempts', MAX_ATTEMPTS)
    .order('received_at', { ascending: true })
    .limit(limit);
  let done = 0;
  for (const r of data ?? []) if ((await processMetaInbox(r.id)) === 'done') done += 1;
  return { retried: (data ?? []).length, done };
}

/**
 * Daily safety net: lists recent leads of each known form straight from the
 * Graph API and captures any the webhook missed. Forms come from
 * META_LEAD_FORM_IDS plus those seen in the inbox in the last 30 days.
 */
export async function backfillMetaForms(hours = 48): Promise<{ forms: number; added: number; tokenProblem: boolean }> {
  if (!metaLeadsConfigured()) return { forms: 0, added: 0, tokenProblem: false };
  const admin = createAdminClient();
  const forms = new Set(
    (process.env.META_LEAD_FORM_IDS ?? '').split(',').map((s) => s.trim()).filter((s) => /^[0-9]{1,30}$/.test(s)),
  );
  const { data: seen } = await admin
    .from('lead_inbox')
    .select('payload')
    .gte('received_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
    .limit(500);
  for (const r of seen ?? []) {
    const f = (r.payload as { form_id?: unknown })?.form_id;
    if (typeof f === 'string' && /^[0-9]{1,30}$/.test(f)) forms.add(f);
  }

  const since = Math.floor(Date.now() / 1000) - hours * 3600;
  let added = 0;
  try {
    for (const form of [...forms].slice(0, 20)) {
      let after: string | undefined;
      for (let page = 0; page < 5; page += 1) {
        const params: Record<string, string> = {
          fields: LEAD_FIELDS,
          limit: '100',
          filtering: JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: since }]),
        };
        if (after) params.after = after;
        const res = await graphGet<{ data?: GraphLead[]; paging?: { cursors?: { after?: string }; next?: string } }>(
          `/${form}/leads`, params,
        );
        for (const lead of res.data ?? []) {
          if (!lead?.id || !/^[0-9]{1,30}$/.test(String(lead.id))) continue;
          const { data: ins } = await admin
            .from('lead_inbox')
            .upsert([{ provider: 'meta', external_id: String(lead.id), payload: { leadgen_id: String(lead.id), form_id: form, ad_id: lead.ad_id ?? null, backfill: true } }], {
              onConflict: 'provider,external_id',
              ignoreDuplicates: true,
            })
            .select('id');
          const id = ins?.[0]?.id as string | undefined;
          if (id && (await processMetaInbox(id, lead)) === 'done') added += 1;
        }
        after = res.paging?.next ? res.paging?.cursors?.after : undefined;
        if (!after) break;
      }
    }
  } catch (e) {
    if (e instanceof GraphError && e.tokenProblem) return { forms: forms.size, added, tokenProblem: true };
    console.error('Meta lead backfill failed:', (e as Error).message);
  }
  return { forms: forms.size, added, tokenProblem: false };
}

/** Archived leads waiting because the Page token stopped working. */
export async function metaLeadsBlockedByToken(): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from('lead_inbox')
    .select('id', { count: 'exact', head: true })
    .is('processed_at', null)
    .like('last_error', 'TOKEN_INVALID:%');
  return count ?? 0;
}
