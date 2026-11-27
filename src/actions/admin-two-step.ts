'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthError, getSessionId, requireAdmin, requireAdminRole } from '@/lib/dal/session';
import { checkApiRateLimit } from '@/lib/ratelimit';
import { generateOtp, hashOtp, normaliseIndianMobile, OTP_RE, phoneOtpAvailable, type OtpPurpose } from '@/lib/otp';
import { deliverOtp, type Channel } from '@/lib/messaging/otp-delivery';
import { sendTwoStepNoticeEmail } from '@/lib/email';

// Owner-portal two-step sign-in (migration 0053). Every action re-checks the
// caller through the DAL. Sign-in actions need the admin ROLE (the second
// factor is what they establish); settings actions need full admin rights,
// i.e. a second factor already passed in this session.

export type TwoStepState =
  | undefined
  | {
      error?: string;
      ok?: string;
      /** TOTP set-up in progress. */
      setup?: { factorId: string; qr: string; secret: string };
      /** A WhatsApp/SMS code was sent. */
      sent?: { challengeId: string; channel: Channel; last4: string; smsFallback: boolean; attemptsLeft: number };
    };

const Code = z.string().trim().regex(OTP_RE, 'Enter the 6-digit code.');
const Uuid = z.string().uuid();
const DASHBOARD = '/admin/dashboard';

async function ipAllowed(scope: string): Promise<boolean> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
  return checkApiRateLimit(`2step:${scope}:${ip}`);
}

function authFail(err: unknown): TwoStepState {
  if (err instanceof AuthError) return { error: 'Please sign in again.' };
  throw err;
}

const ISSUE_ERRORS: Record<string, string> = {
  PHONE_NOT_ENROLLED: 'No phone number is set up for codes. Use your authenticator app.',
  OTP_RATE_LIMITED: 'Too many codes requested. Wait an hour, or use your authenticator app.',
  OTP_LOCKED: 'Too many wrong codes. Wait 15 minutes, or use your authenticator app.',
  OTP_TOO_MANY_SENDS: 'That code was sent too many times. Wait for it to expire and start again.',
  OTP_RESEND_TOO_SOON: 'Please wait 30 seconds before asking for another code.',
  INVALID_PHONE: 'Enter a 10-digit Indian mobile number.',
};

const VERIFY_ERRORS: Record<string, string> = {
  WRONG_CODE: 'That code is not right.',
  EXPIRED: 'That code has expired. Ask for a new one.',
  LOCKED: 'Too many wrong codes. This code no longer works; ask for a new one in 15 minutes.',
  USED: 'That code was already used. Ask for a new one.',
  NOT_FOUND: 'That code is not valid. Ask for a new one.',
};

function issueError(message: string | undefined): string {
  const key = Object.keys(ISSUE_ERRORS).find((k) => message?.includes(k));
  return key ? ISSUE_ERRORS[key] : 'Could not send a code. Try again, or use your authenticator app.';
}

/** Issue (or resend) a code for this session and purpose, then send it. */
async function issueAndSend(userId: string, sessionId: string, purpose: OtpPurpose, phone: string | null, prefer: Channel): Promise<TwoStepState> {
  const admin = createAdminClient();
  let target = phone;
  if (purpose === 'admin_sign_in') {
    const { data } = await admin.from('admin_otp_phones').select('phone_e164').eq('user_id', userId).maybeSingle();
    target = (data?.phone_e164 as string | undefined) ?? null;
    if (!target) return { error: ISSUE_ERRORS.PHONE_NOT_ENROLLED };
  }
  const code = generateOtp();
  const { data, error } = await admin.rpc('otp_issue', {
    p_user_id: userId, p_session_id: sessionId, p_purpose: purpose, p_phone: target, p_code_hash: hashOtp(sessionId, purpose, code),
  });
  if (error || !data) return { error: issueError(error?.message) };
  const issued = data as { challenge_id: string; phone_last4: string; sends: number; attempts_left: number };
  const sent = await deliverOtp(issued.challenge_id, issued.sends, target!, code, prefer);
  if (!sent.ok) return { error: 'The code could not be sent just now. Try again, or use your authenticator app.' };
  return {
    sent: { challengeId: issued.challenge_id, channel: sent.channel, last4: issued.phone_last4, smsFallback: sent.smsFallback, attemptsLeft: issued.attempts_left },
  };
}

// ---------------------------------------------------------------------------
// Sign-in (admin role, no second factor yet)
// ---------------------------------------------------------------------------

/** First-time set-up: start an authenticator-app enrolment. */
export async function startAuthenticatorSetup(_prev: TwoStepState, _form: FormData): Promise<TwoStepState> {
  let me;
  try {
    me = await requireAdminRole();
  } catch (e) {
    return authFail(e);
  }
  if (!(await ipAllowed('setup'))) return { error: 'Too many requests. Wait a minute and try again.' };
  const supabase = await createClient();
  const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
  if (listErr) return { error: 'Could not start set-up. Try again.' };
  // Someone who already has a second factor must use it; a phone number alone
  // still counts, so a stolen password cannot add a new authenticator.
  if (!me.twoStep.secondFactor && ((factors?.totp?.length ?? 0) > 0 || me.twoStep.phoneLast4)) {
    return { error: 'Two-step sign-in is already set up for this account. Use your existing method.' };
  }
  for (const f of factors?.all ?? []) {
    if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Owner portal ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) return { error: 'Could not start set-up. Try again.' };
  return { setup: { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret } };
}

/** Finish set-up with the first code from the app. Signs the session in to aal2. */
export async function confirmAuthenticatorSetup(_prev: TwoStepState, form: FormData): Promise<TwoStepState> {
  let me;
  try {
    me = await requireAdminRole();
  } catch (e) {
    return authFail(e);
  }
  if (!(await ipAllowed('verify'))) return { error: 'Too many attempts. Wait a minute and try again.' };
  const factorId = Uuid.safeParse(form.get('factorId'));
  const code = Code.safeParse(form.get('code'));
  if (!factorId.success || !code.success) return { error: 'Enter the 6-digit code from your app.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factorId.data, code: code.data });
  if (error) return { error: 'That code is not right. Check the time on your phone and try the newest code.' };
  if (me.email) await sendTwoStepNoticeEmail(me.email, 'An authenticator app was added to your owner portal account.');
  revalidatePath('/', 'layout');
  redirect(DASHBOARD);
}

export async function verifyAuthenticatorCode(_prev: TwoStepState, form: FormData): Promise<TwoStepState> {
  try {
    await requireAdminRole();
  } catch (e) {
    return authFail(e);
  }
  if (!(await ipAllowed('verify'))) return { error: 'Too many attempts. Wait a minute and try again.' };
  const code = Code.safeParse(form.get('code'));
  if (!code.success) return { error: code.error.issues[0].message };
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0];
  if (!factor) return { error: 'No authenticator app is set up for this account.' };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.data });
  if (error) return { error: 'That code is not right. Try the newest code in your app.' };
  revalidatePath('/', 'layout');
  redirect(DASHBOARD);
}

export async function sendSignInCode(_prev: TwoStepState, form: FormData): Promise<TwoStepState> {
  let me;
  try {
    me = await requireAdminRole();
  } catch (e) {
    return authFail(e);
  }
  if (!phoneOtpAvailable()) return { error: 'Codes by WhatsApp or SMS are not available. Use your authenticator app.' };
  if (!(await ipAllowed('send'))) return { error: 'Too many requests. Wait a minute and try again.' };
  const prefer: Channel = form.get('channel') === 'sms' ? 'sms' : 'whatsapp';
  return issueAndSend(me.id, me.sessionId, 'admin_sign_in', null, prefer);
}

export async function verifySignInCode(prev: TwoStepState, form: FormData): Promise<TwoStepState> {
  let me;
  try {
    me = await requireAdminRole();
  } catch (e) {
    return authFail(e);
  }
  if (!(await ipAllowed('verify'))) return { ...prev, error: 'Too many attempts. Wait a minute and try again.' };
  const challengeId = Uuid.safeParse(form.get('challengeId'));
  const code = Code.safeParse(form.get('code'));
  if (!challengeId.success) return { error: 'Ask for a code first.' };
  if (!code.success) return { ...prev, error: code.error.issues[0].message };
  const { data, error } = await createAdminClient().rpc('otp_verify', {
    p_challenge_id: challengeId.data, p_user_id: me.id, p_session_id: me.sessionId,
    p_code_hash: hashOtp(me.sessionId, 'admin_sign_in', code.data),
  });
  const r = data as { ok: boolean; reason: string | null; attempts_left: number } | null;
  if (error || !r) return { ...prev, error: 'Could not check the code. Try again.' };
  if (!r.ok) {
    const msg = VERIFY_ERRORS[r.reason ?? 'NOT_FOUND'] ?? VERIFY_ERRORS.NOT_FOUND;
    const left = r.reason === 'WRONG_CODE' ? ` ${r.attempts_left} ${r.attempts_left === 1 ? 'try' : 'tries'} left.` : '';
    return {
      sent: prev?.sent && r.reason === 'WRONG_CODE' ? { ...prev.sent, attemptsLeft: r.attempts_left } : undefined,
      error: msg + left,
    };
  }
  revalidatePath('/', 'layout');
  redirect(DASHBOARD);
}

// ---------------------------------------------------------------------------
// Settings (full admin: second factor already passed)
// ---------------------------------------------------------------------------

export async function startPhoneEnrol(_prev: TwoStepState, form: FormData): Promise<TwoStepState> {
  let me;
  try {
    me = await requireAdmin();
  } catch (e) {
    return authFail(e);
  }
  if (!phoneOtpAvailable()) return { error: 'WhatsApp and SMS are not set up on the server yet.' };
  if (!(await ipAllowed('enrol'))) return { error: 'Too many requests. Wait a minute and try again.' };
  const phone = normaliseIndianMobile(String(form.get('phone') ?? '').slice(0, 20));
  if (!phone) return { error: ISSUE_ERRORS.INVALID_PHONE };
  const sessionId = await getSessionId();
  if (!sessionId) return { error: 'Please sign in again.' };
  return issueAndSend(me.id, sessionId, 'phone_enrol', phone, 'whatsapp');
}

export async function confirmPhoneEnrol(prev: TwoStepState, form: FormData): Promise<TwoStepState> {
  let me;
  try {
    me = await requireAdmin();
  } catch (e) {
    return authFail(e);
  }
  if (!(await ipAllowed('verify'))) return { ...prev, error: 'Too many attempts. Wait a minute and try again.' };
  const challengeId = Uuid.safeParse(form.get('challengeId'));
  const code = Code.safeParse(form.get('code'));
  if (!challengeId.success) return { error: 'Send a code first.' };
  if (!code.success) return { ...prev, error: code.error.issues[0].message };
  const sessionId = await getSessionId();
  if (!sessionId) return { error: 'Please sign in again.' };
  const { data, error } = await createAdminClient().rpc('otp_verify', {
    p_challenge_id: challengeId.data, p_user_id: me.id, p_session_id: sessionId,
    p_code_hash: hashOtp(sessionId, 'phone_enrol', code.data),
  });
  const r = data as { ok: boolean; reason: string | null; attempts_left: number } | null;
  if (error || !r) return { ...prev, error: 'Could not check the code. Try again.' };
  if (!r.ok) {
    const left = r.reason === 'WRONG_CODE' ? ` ${r.attempts_left} ${r.attempts_left === 1 ? 'try' : 'tries'} left.` : '';
    return { sent: r.reason === 'WRONG_CODE' ? prev?.sent : undefined, error: (VERIFY_ERRORS[r.reason ?? 'NOT_FOUND'] ?? VERIFY_ERRORS.NOT_FOUND) + left };
  }
  if (me.email) await sendTwoStepNoticeEmail(me.email, 'A phone number for WhatsApp/SMS sign-in codes was added to your owner portal account.');
  revalidatePath('/admin/settings');
  return { ok: 'Phone number verified. You can now sign in with a WhatsApp or SMS code.' };
}

export async function removeOtpPhone(_prev: TwoStepState, _form: FormData): Promise<TwoStepState> {
  let me;
  try {
    me = await requireAdmin();
  } catch (e) {
    return authFail(e);
  }
  // Keep at least one method: the phone can go only if an authenticator app is set up.
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if ((factors?.totp?.length ?? 0) === 0) return { error: 'Set up an authenticator app before removing your phone number.' };
  const { error } = await createAdminClient().rpc('admin_remove_otp_phone', { p_user_id: me.id });
  if (error) return { error: 'Could not remove the number. Try again.' };
  if (me.email) await sendTwoStepNoticeEmail(me.email, 'The phone number for WhatsApp/SMS sign-in codes was removed from your owner portal account.');
  revalidatePath('/admin/settings');
  return { ok: 'Phone number removed.' };
}
