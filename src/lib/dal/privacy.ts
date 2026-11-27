import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, requireUser } from '@/lib/dal/session';

// DPDP Privacy Centre and the owner's privacy queue (migration 0055).
// Customers read their own consent and requests through RLS; the owner
// reads everything after requireAdmin().

/** Bump when the wording below changes, so the ledger shows what was shown. */
export const NOTICE_VERSION = '2026-11';

export const CONSENT_PURPOSES = [
  {
    id: 'marketing_email',
    title: 'Offers and new arrivals by e-mail',
    body: 'Occasional e-mails about new fabrics, sales and swatch kits. Order and delivery e-mails are sent either way.',
  },
  {
    id: 'marketing_whatsapp',
    title: 'Offers on WhatsApp',
    body: 'Occasional WhatsApp messages about new fabrics and sales. Order updates and sign-in codes are sent either way.',
  },
  {
    id: 'ad_measurement',
    title: 'Ad measurement with Google and Meta',
    body: 'Lets us tell Google and Meta, using a scrambled (hashed) copy of your e-mail or phone, that an enquiry or order came from their ad. Turning this off also stops reporting for enquiries you already sent.',
  },
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number]['id'];

export const REQUEST_KIND_LABEL: Record<string, string> = {
  erasure: 'Delete my account and data',
  correction: 'Correct my data',
  grievance: 'Complaint about my data',
  access: 'Downloaded my data',
};

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  open: 'Received',
  in_progress: 'In progress',
  completed: 'Completed',
  rejected: 'Declined',
  withdrawn: 'Withdrawn',
};

export interface MyPrivacy {
  consents: Record<ConsentPurpose, { granted: boolean; at: string } | null>;
  requests: { id: string; ref: string; kind: string; status: string; createdAt: string; dueAt: string; resolution: string | null }[];
}

export async function getMyPrivacy(): Promise<MyPrivacy> {
  const user = await requireUser();
  const supabase = await createClient();
  const [consents, requests] = await Promise.all([
    supabase.from('consent_current').select('purpose, granted, created_at').eq('user_id', user.id),
    supabase
      .from('privacy_requests')
      .select('id, ref, kind, status, created_at, due_at, resolution')
      .eq('user_id', user.id)
      .neq('kind', 'access')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  const out = Object.fromEntries(CONSENT_PURPOSES.map((p) => [p.id, null])) as MyPrivacy['consents'];
  for (const c of consents.data ?? []) {
    if (c.purpose in out) out[c.purpose as ConsentPurpose] = { granted: c.granted, at: c.created_at };
  }
  return {
    consents: out,
    requests: (requests.data ?? []).map((r) => ({
      id: r.id, ref: r.ref, kind: r.kind, status: r.status, createdAt: r.created_at, dueAt: r.due_at, resolution: r.resolution,
    })),
  };
}

/**
 * Everything the shop holds about the signed-in person, as one JSON
 * document (DPDP Act s.11). Owner-only working notes on leads are left out.
 * Logged as a completed "access" request.
 */
export async function buildMyDataExport(): Promise<Record<string, unknown>> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error: logErr } = await supabase.rpc('privacy_request_create', { p_kind: 'access', p_details: null });
  if (logErr) throw new Error(logErr.message.includes('TOO_MANY') ? 'TOO_MANY' : 'EXPORT_FAILED');

  const admin = createAdminClient();
  const [profile, orders, credit, consents, requests, leads, authUser] = await Promise.all([
    supabase.from('profiles').select('customer_code, full_name, phone, saved_addresses, created_at').eq('id', user.id).maybeSingle(),
    supabase
      .from('orders')
      .select('id, created_at, status, total_amount, shipping_address, invoice_number, courier_name, awb_code, order_items(quantity, unit_price, product_variants(color, products(title)))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('swatch_credit_ledger').select('created_at, entry, amount, balance_after, note').eq('user_id', user.id).order('created_at'),
    supabase.from('consent_events').select('created_at, purpose, granted, notice_version, source').eq('user_id', user.id).order('id'),
    supabase.from('privacy_requests').select('ref, created_at, kind, status, details, resolution').eq('user_id', user.id).order('created_at'),
    user.email
      ? admin
          .from('leads')
          .select('lead_ref, created_at, first_source, full_name, email, phone_e164, company, city, message, status, utm_source, utm_campaign, ad_consent')
          .eq('email', user.email.toLowerCase())
      : Promise.resolve({ data: [] }),
    admin.auth.admin.getUserById(user.id),
  ]);

  return {
    generated_at: new Date().toISOString(),
    controller: 'Mithila Enterprises',
    account: {
      email: user.email,
      phone: authUser.data.user?.phone || null,
      created_at: authUser.data.user?.created_at ?? null,
      last_sign_in_at: authUser.data.user?.last_sign_in_at ?? null,
    },
    profile: profile.data ?? null,
    orders: orders.data ?? [],
    swatch_credit: credit.data ?? [],
    consent_history: consents.data ?? [],
    privacy_requests: requests.data ?? [],
    enquiries: leads.data ?? [],
    notes: [
      'Orders and tax invoices are kept for the period the GST law requires, even after an account is deleted.',
      'Payments are processed by Razorpay; card and bank details are never stored by Mithila Enterprises.',
    ],
  };
}

// --- Owner -----------------------------------------------------------------

export interface PrivacyQueueRow {
  id: string;
  ref: string;
  kind: string;
  status: string;
  contactEmail: string | null;
  details: string | null;
  resolution: string | null;
  createdAt: string;
  dueAt: string;
  hasAccount: boolean;
  overdue: boolean;
}

export async function listPrivacyRequests(show: 'open' | 'all' = 'open'): Promise<PrivacyQueueRow[]> {
  await requireAdmin();
  const supabase = await createClient();
  let q = supabase
    .from('privacy_requests')
    .select('id, ref, kind, status, contact_email, details, resolution, created_at, due_at, user_id')
    .neq('kind', 'access')
    .order('due_at', { ascending: true })
    .limit(200);
  if (show === 'open') q = q.in('status', ['open', 'in_progress']);
  const { data, error } = await q;
  if (error) throw new Error('Could not load privacy requests');
  const now = Date.now();
  return (data ?? []).map((r) => ({
    id: r.id,
    ref: r.ref,
    kind: r.kind,
    status: r.status,
    contactEmail: r.contact_email,
    details: r.details,
    resolution: r.resolution,
    createdAt: r.created_at,
    dueAt: r.due_at,
    hasAccount: r.user_id != null,
    overdue: ['open', 'in_progress'].includes(r.status) && Date.parse(r.due_at) < now,
  }));
}

export async function listEmailSuppressions(): Promise<{ email: string; reason: string; detail: string | null; createdAt: string }[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('email_suppressions')
    .select('email, reason, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error('Could not load e-mail suppressions');
  return (data ?? []).map((s) => ({ email: s.email, reason: s.reason, detail: s.detail, createdAt: s.created_at }));
}
