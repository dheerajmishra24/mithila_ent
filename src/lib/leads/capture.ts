import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { splitName, type LeadInput } from './parse';

export type CaptureResult =
  | { ok: true; leadId: string | null; duplicate: boolean }
  | { ok: false; error: string };

// lead_capture() missing = migration 0054 not applied yet.
const MISSING_FUNCTION = new Set(['PGRST202', '42883']);

/**
 * Every lead, from every source, goes through here into public.lead_capture
 * (service role). Idempotent per (source, external_id); repeat contacts with
 * the same e-mail or phone are merged by the database.
 */
export async function captureLead(input: LeadInput): Promise<CaptureResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('lead_capture', { p: input });
  if (!error) {
    const d = (data ?? {}) as { lead_id?: string; duplicate?: boolean };
    return { ok: true, leadId: d.lead_id ?? null, duplicate: Boolean(d.duplicate) };
  }
  if (MISSING_FUNCTION.has(error.code ?? '')) return legacyCapture(admin, input);
  return { ok: false, error: error.message };
}

// Before 0054 exists, web forms keep landing in the old inboxes.
async function legacyCapture(admin: SupabaseClient, input: LeadInput): Promise<CaptureResult> {
  let r;
  if (input.source === 'contact') {
    const n = splitName(input.full_name);
    r = await admin.from('contact_inquiries').insert({
      first_name: (input.detail?.first_name as string) || n.first || '-',
      last_name: (input.detail?.last_name as string) || n.last || '-',
      email: input.email,
      location: input.city ?? null,
      message: input.message ?? '',
    });
  } else if (input.source === 'wholesale') {
    r = await admin.from('wholesale_applications').insert({
      business_name: input.company ?? '-',
      tax_id: (input.detail?.gstin as string) ?? null,
      email: input.email,
      requirements: input.message ?? '',
    });
  } else {
    return { ok: false, error: 'lead pipeline not installed (migration 0054)' };
  }
  return r.error ? { ok: false, error: r.error.message } : { ok: true, leadId: null, duplicate: false };
}
