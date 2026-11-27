'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AuthError, requireAdmin } from '@/lib/dal/session';
import { sendPendingConversions } from '@/lib/leads/conversions';
import { retryMetaInbox } from '@/lib/leads/meta';

// Owner CRM actions. Each one re-checks admin (role + recent second factor)
// here, and the database functions check is_admin() again.

export type LeadActionState = { ok?: string; error?: string } | null;

const STATUSES = new Set(['new', 'contacted', 'qualified', 'won', 'lost', 'spam']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function admin(): Promise<LeadActionState | null> {
  try {
    await requireAdmin();
    return null;
  } catch (e) {
    if (e instanceof AuthError) return { error: 'Your owner session has ended. Sign in again.' };
    throw e;
  }
}

/** Rupees as typed ("12,500.50") -> paise; '' -> null; otherwise undefined (invalid). */
function rupeesToPaise(v: FormDataEntryValue | null): number | null | undefined {
  const s = String(v ?? '').replace(/[,\s₹]/g, '');
  if (s === '') return null;
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return undefined;
  return Math.round(Number(s) * 100);
}

export async function updateLead(_prev: LeadActionState, form: FormData): Promise<LeadActionState> {
  const denied = await admin();
  if (denied) return denied;
  const id = String(form.get('lead_id') ?? '');
  const status = String(form.get('status') ?? '');
  const value = rupeesToPaise(form.get('value'));
  const notes = String(form.get('notes') ?? '').slice(0, 4000);
  if (!UUID_RE.test(id) || !STATUSES.has(status)) return { error: 'Please choose a valid status.' };
  if (value === undefined) return { error: 'Order value must be an amount in rupees, like 12500 or 12500.50.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('lead_update', {
    p_lead: id, p_status: status, p_value_paise: value, p_notes: notes,
  });
  if (error) {
    console.error('lead_update failed:', error.message);
    return { error: error.message.includes('LEAD_NOT_FOUND') ? 'This lead no longer exists (it may have been merged).' : 'Could not save. Please try again.' };
  }
  const queued = Number((data as { conversions_queued?: number })?.conversions_queued ?? 0);
  if (queued > 0) {
    after(async () => {
      try {
        await sendPendingConversions(10, id);
      } catch (e) {
        console.error('conversion send failed:', (e as Error).message);
      }
    });
  }
  revalidatePath('/admin/leads');
  revalidatePath(`/admin/leads/${id}`);
  return { ok: queued > 0 ? `Saved. ${queued} ad-platform conversion${queued > 1 ? 's' : ''} queued.` : 'Saved.' };
}

export async function mergeLead(_prev: LeadActionState, form: FormData): Promise<LeadActionState> {
  const denied = await admin();
  if (denied) return denied;
  const keep = String(form.get('keep') ?? '');
  const drop = String(form.get('drop') ?? '');
  if (!UUID_RE.test(keep) || !UUID_RE.test(drop) || keep === drop) return { error: 'Choose two different leads.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('lead_merge', { p_keep: keep, p_drop: drop });
  if (error) {
    console.error('lead_merge failed:', error.message);
    return { error: 'Could not merge these leads (one may already be merged).' };
  }
  revalidatePath('/admin/leads');
  // The duplicate's row (and this form) disappears, so confirm at page level.
  const ref = (data as { merged_ref?: string })?.merged_ref ?? '';
  redirect(`/admin/leads/${keep}${/^L-\d{6}$/.test(ref) ? `?merged=${ref}` : ''}`);
}

export async function retryLeadInbox(_prev: LeadActionState): Promise<LeadActionState> {
  const denied = await admin();
  if (denied) return denied;
  const r = await retryMetaInbox(25);
  revalidatePath('/admin/leads');
  return { ok: r.retried === 0 ? 'Nothing waiting.' : `Retried ${r.retried}; ${r.done} fetched.` };
}
