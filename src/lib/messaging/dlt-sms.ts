import 'server-only';
import { providerBase } from '@/lib/otp';
import type { SendResult } from './whatsapp-auth';

// DLT-registered SMS through MSG91's Flow API. MSG91_OTP_TEMPLATE_ID is the
// MSG91 template linked to the DLT template registered with the operator
// (docs/DLT_OPS_CHECKLIST.md):
//   {#numeric#} is your Mithila Enterprises verification code. It expires in
//   10 minutes. Do not share it with anyone. -MITHLA
// The only variable is the code, sent as `otp` (mapped to {#numeric#} in the
// MSG91 template). Nothing else is free text, so the operator's DLT scrubber
// matches the registered template exactly.

const MSG91 = 'https://control.msg91.com/api/v5';

export function dltSmsPayload(toE164: string, code: string) {
  return {
    template_id: process.env.MSG91_OTP_TEMPLATE_ID,
    short_url: '0',
    recipients: [{ mobiles: toE164.replace(/^\+/, ''), otp: code }],
  };
}

export async function sendDltOtpSms(toE164: string, code: string): Promise<SendResult> {
  const key = process.env.MSG91_AUTH_KEY;
  if (!key || !process.env.MSG91_OTP_TEMPLATE_ID) return { ok: false, error: 'not_configured' };
  if (!/^[0-9]{6}$/.test(code)) return { ok: false, error: 'bad_code' };
  const base = providerBase(process.env.SMS_API_BASE, MSG91);
  try {
    const res = await fetch(`${base}/flow`, {
      method: 'POST',
      headers: { authkey: key, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(dltSmsPayload(toE164, code)),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json().catch(() => ({}))) as { type?: string; message?: string; request_id?: string };
    if (!res.ok || body.type === 'error') return { ok: false, error: `http_${res.status}` };
    return { ok: true, messageId: body.request_id ?? body.message ?? null };
  } catch (err) {
    return { ok: false, error: (err as Error).name === 'TimeoutError' ? 'timeout' : 'network' };
  }
}
