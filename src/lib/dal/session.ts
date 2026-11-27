import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Data Access Layer: the one place that answers "who is calling, and are they
// allowed?" (CLAUDE.md invariant 1, SEC-12). Proxy redirects are routing only;
// every Server Component, Server Action and Route Handler that needs a user or
// an admin calls one of these. They return small DTOs, never the raw session.

export interface SessionUser {
  id: string;
  email: string | null;
}

export class AuthError extends Error {
  constructor(public readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN') {
    super(code === 'UNAUTHENTICATED' ? 'Unauthorized' : 'Forbidden');
    this.name = 'AuthError';
  }
}

/** The verified user for this request, or null. Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
});

/**
 * Whether the caller is an admin. Asks the database (public.is_admin(), which
 * reads public.user_roles, migration 0047), so it cannot drift from what RLS
 * enforces. Cached per request.
 */
export const isAdmin = cache(async (): Promise<boolean> => {
  const user = await getSessionUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('is_admin');
  if (error) {
    console.error('isAdmin check failed:', error.message);
    return false;
  }
  return data === true;
});

export interface TwoStepStatus {
  /** Holds the admin role in public.user_roles. */
  adminRole: boolean;
  /** This session passed a second factor in the last 12 hours (migration 0053). */
  secondFactor: boolean;
  /** Last 4 digits of the verified WhatsApp/SMS number, if any. */
  phoneLast4: string | null;
}

/**
 * The caller's two-step state. Admin rights (is_admin) need the role AND a
 * recent second factor; this tells the sign-in pages which part is missing.
 */
export const getTwoStepStatus = cache(async (): Promise<TwoStepStatus> => {
  const none: TwoStepStatus = { adminRole: false, secondFactor: false, phoneLast4: null };
  const user = await getSessionUser();
  if (!user) return none;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_two_step_status');
  if (error || !data) {
    if (error) console.error('admin_two_step_status failed:', error.message);
    // Before migration 0053 is applied the function does not exist: fall back
    // to is_admin() so deploying this code first cannot lock the owner out.
    const admin = await isAdmin();
    return { adminRole: admin, secondFactor: admin, phoneLast4: null };
  }
  const d = data as { admin_role?: boolean; second_factor?: boolean; phone_last4?: string | null };
  return { adminRole: d.admin_role === true, secondFactor: d.second_factor === true, phoneLast4: d.phone_last4 ?? null };
});

/** The verified JWT's session id (what WhatsApp/SMS step-ups are bound to). */
export const getSessionId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  const sid = (data.claims as { session_id?: unknown }).session_id;
  return typeof sid === 'string' && /^[0-9a-f-]{36}$/i.test(sid) ? sid : null;
});

/**
 * For the two-step sign-in page and its actions: an admin-role user who may
 * not have passed the second factor yet. Never grants admin rights itself.
 */
export async function requireAdminRole(): Promise<SessionUser & { sessionId: string; twoStep: TwoStepStatus }> {
  const user = await requireUser();
  const twoStep = await getTwoStepStatus();
  if (!twoStep.adminRole) throw new AuthError('FORBIDDEN');
  const sessionId = await getSessionId();
  if (!sessionId) throw new AuthError('UNAUTHENTICATED');
  return { ...user, sessionId, twoStep };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError('UNAUTHENTICATED');
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!(await isAdmin())) throw new AuthError('FORBIDDEN');
  return user;
}

/**
 * For Server Component pages and layouts: redirects instead of throwing.
 * Signed out -> /login; admin role without a recent second factor ->
 * /admin-verify; signed in but not an admin -> home page.
 */
export async function requireAdminPage(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/admin/dashboard');
  if (!(await isAdmin())) {
    // Admin role but no recent second factor: finish two-step sign-in first.
    if ((await getTwoStepStatus()).adminRole) redirect('/admin-verify');
    redirect('/');
  }
  return user;
}

/** For customer pages: signed out -> /login, then back to `next`. */
export async function requireUserPage(next = '/account'): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}
