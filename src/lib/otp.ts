import 'server-only';
import crypto from 'crypto';

// One-time codes for owner-portal two-step sign-in (migration 0053).
// The database stores only HMAC-SHA256(pepper, session:purpose:code); the
// pepper lives in OTP_PEPPER and never reaches the database, so a database
// leak does not reveal live codes.

export type OtpPurpose = 'admin_sign_in' | 'phone_enrol';

const PEPPER_MIN = 32;

function pepper(): string | null {
  const p = process.env.OTP_PEPPER;
  return p && p.length >= PEPPER_MIN ? p : null;
}

/** Six digits from the OS CSPRNG, uniform over 000000-999999. */
export function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtp(sessionId: string, purpose: OtpPurpose, code: string): string {
  const p = pepper();
  if (!p) throw new Error('OTP_PEPPER is not set');
  return crypto.createHmac('sha256', p).update(`${sessionId}:${purpose}:${code}`).digest('hex');
}

export const OTP_RE = /^[0-9]{6}$/;

/**
 * Indian mobile numbers only (WhatsApp and DLT SMS both need them). Accepts
 * "98765 43210", "+91 98765-43210", "09876543210"; returns +91XXXXXXXXXX or null.
 */
export function normaliseIndianMobile(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '');
  const m = /^(?:\+?91|0)?([6-9][0-9]{9})$/.exec(digits);
  return m ? `+91${m[1]}` : null;
}

export function maskPhone(last4: string | null | undefined): string {
  return last4 ? `+91 ••••••${last4.slice(-4)}` : '';
}

function isLocalUrl(u: string): boolean {
  try {
    const h = new URL(u).hostname;
    return h === '127.0.0.1' || h === 'localhost' || h === '::1';
  } catch {
    return false;
  }
}

/**
 * Provider base URL. An override is honoured only when it points at this
 * machine and we are not on Vercel (local tests run a fake provider); anything
 * else falls back to the real provider, so a stray env var cannot redirect
 * codes to a third party.
 */
export function providerBase(override: string | undefined, real: string): string {
  if (override && !process.env.VERCEL && isLocalUrl(override)) return override.replace(/\/$/, '');
  return real;
}

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_AUTH_TEMPLATE);
}

export function smsConfigured(): boolean {
  return Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_OTP_TEMPLATE_ID);
}

/** Codes by WhatsApp/SMS are offered only when a pepper and a channel are set. */
export function phoneOtpAvailable(): boolean {
  return pepper() !== null && (whatsappConfigured() || smsConfigured());
}
