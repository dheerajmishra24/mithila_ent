'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthError, requireAdmin, requireUser } from '@/lib/dal/session';
import { NOTICE_VERSION } from '@/lib/dal/privacy';
import { checkApiRateLimit } from '@/lib/ratelimit';

// Privacy Centre (customer) and privacy queue (owner) actions. Each one
// re-checks who is calling; the database functions (0055) check again.

export type PrivacyActionState = { ok?: string; error?: string } | null;

const PURPOSES = new Set(['marketing_email', 'marketing_whatsapp', 'ad_measurement']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function signedIn(): Promise<PrivacyActionState | null> {
  try {
    await requireUser();
    return null;
  } catch (e) {
    if (e instanceof AuthError) return { error: 'Please sign in again.' };
    throw e;
  }
}

async function owner(): Promise<PrivacyActionState | null> {
  try {
    await requireAdmin();
    return null;
  } catch (e) {
    if (e instanceof AuthError) return { error: 'Your owner session has ended. Sign in again.' };
    throw e;
  }
}

export async function setConsent(_prev: PrivacyActionState, form: FormData): Promise<PrivacyActionState> {
  const denied = await signedIn();
  if (denied) return denied;
  const purpose = String(form.get('purpose') ?? '');
  const granted = form.get('granted') === 'true';
  if (!PURPOSES.has(purpose)) return { error: 'Unknown choice.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('consent_set', { p_purpose: purpose, p_granted: granted, p_notice_version: NOTICE_VERSION });
  if (error) {
    console.error('consent_set failed:', error.message);
    return { error: 'Could not save your choice. Please try again.' };
  }
  revalidatePath('/account/privacy');
  return { ok: granted ? 'Turned on.' : 'Turned off.' };
}

const REQUEST_ERRORS: Record<string, string> = {
  ALREADY_REQUESTED: 'You already have a deletion request open.',
  TOO_MANY_OPEN_REQUESTS: 'You have several requests open already. We will reply to those first.',
  DETAILS_REQUIRED: 'Please tell us what needs to change.',
};

export async function createPrivacyRequest(_prev: PrivacyActionState, form: FormData): Promise<PrivacyActionState> {
  const denied = await signedIn();
  if (denied) return denied;
  const kind = String(form.get('kind') ?? '');
  const details = String(form.get('details') ?? '').slice(0, 2000);
  if (!['erasure', 'correction', 'grievance'].includes(kind)) return { error: 'Please choose a request type.' };
  if (kind === 'erasure' && form.get('confirm') !== 'yes') {
    return { error: 'Please tick the box to confirm you want your account deleted.' };
  }
  const user = await requireUser();
  if (!(await checkApiRateLimit(`privacy-request:${user.id}`))) {
    return { error: 'Too many requests. Please try again later.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('privacy_request_create', { p_kind: kind, p_details: details });
  if (error) {
    const known = Object.keys(REQUEST_ERRORS).find((k) => error.message.includes(k));
    if (!known) console.error('privacy_request_create failed:', error.message);
    return { error: known ? REQUEST_ERRORS[known] : 'Could not send your request. Please try again.' };
  }
  revalidatePath('/account/privacy');
  return { ok: `Request ${(data as { ref: string }).ref} received. We will reply by e-mail within 30 days.` };
}

export async function withdrawPrivacyRequest(_prev: PrivacyActionState, form: FormData): Promise<PrivacyActionState> {
  const denied = await signedIn();
  if (denied) return denied;
  const id = String(form.get('id') ?? '');
  if (!UUID_RE.test(id)) return { error: 'Unknown request.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('privacy_request_withdraw', { p_id: id });
  if (error) return { error: 'This request can no longer be withdrawn.' };
  revalidatePath('/account/privacy');
  return { ok: 'Request withdrawn.' };
}

// --- Owner -----------------------------------------------------------------

export async function updatePrivacyRequest(_prev: PrivacyActionState, form: FormData): Promise<PrivacyActionState> {
  const denied = await owner();
  if (denied) return denied;
  const id = String(form.get('id') ?? '');
  const status = String(form.get('status') ?? '');
  const resolution = String(form.get('resolution') ?? '').slice(0, 2000);
  if (!UUID_RE.test(id) || !['in_progress', 'completed', 'rejected'].includes(status)) return { error: 'Choose a valid status.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('privacy_request_update', { p_id: id, p_status: status, p_resolution: resolution });
  if (error) {
    if (error.message.includes('REASON_REQUIRED')) return { error: 'Write the reason for declining; the person will be told.' };
    if (error.message.includes('USE_ERASE')) return { error: 'Use "Erase now" to complete a deletion request.' };
    if (error.message.includes('REQUEST_CLOSED')) return { error: 'This request is already closed.' };
    console.error('privacy_request_update failed:', error.message);
    return { error: 'Could not save. Please try again.' };
  }
  revalidatePath('/admin/privacy');
  return { ok: 'Saved.' };
}

const ERASE_ERRORS: Record<string, string> = {
  ORDERS_IN_PROGRESS: 'This customer has orders that are paid or shipped. Finish or cancel them first.',
  CANNOT_ERASE_STAFF: 'This is a staff account. Remove its role before deleting it.',
  REQUEST_CLOSED: 'This request is closed or the account no longer exists.',
};

export async function eraseForRequest(_prev: PrivacyActionState, form: FormData): Promise<PrivacyActionState> {
  const denied = await owner();
  if (denied) return denied;
  const id = String(form.get('id') ?? '');
  if (!UUID_RE.test(id)) return { error: 'Unknown request.' };
  if (form.get('confirm') !== 'ERASE') return { error: 'Type ERASE to confirm.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('privacy_erase', { p_request: id });
  if (error) {
    const known = Object.keys(ERASE_ERRORS).find((k) => error.message.includes(k));
    if (!known) console.error('privacy_erase failed:', error.message);
    return { error: known ? ERASE_ERRORS[known] : 'Could not erase. Nothing was changed.' };
  }
  const userId = (data as { user_id: string | null })?.user_id;
  if (userId) {
    // Deleting the sign-in account cascades to profile, cart, credit, roles
    // and sessions; orders stay with user_id set to NULL (GST records).
    const { error: delErr } = await createAdminClient().auth.admin.deleteUser(userId);
    if (delErr && !/not.?found/i.test(delErr.message)) {
      console.error('auth deleteUser failed:', delErr.message);
      revalidatePath('/admin/privacy');
      return { error: 'Personal data was removed, but the sign-in account could not be deleted. Press "Erase now" again.' };
    }
  }
  revalidatePath('/admin/privacy');
  return { ok: 'Erased. The account is deleted; orders are kept for GST records without contact details.' };
}

export async function unsuppressEmail(_prev: PrivacyActionState, form: FormData): Promise<PrivacyActionState> {
  const denied = await owner();
  if (denied) return denied;
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(email) || email.length > 254) return { error: 'Invalid address.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('email_unsuppress', { p_email: email });
  if (error) return { error: 'Could not update. Please try again.' };
  revalidatePath('/admin/privacy');
  return { ok: `${email} can receive e-mail again.` };
}
