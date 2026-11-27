import 'server-only';
import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { smsConfigured, whatsappConfigured } from '@/lib/otp';
import { sendWhatsAppAuthCode } from './whatsapp-auth';
import { sendDltOtpSms } from './dlt-sms';

// Sends a one-time code: WhatsApp first; if WhatsApp is not set up or the send
// fails, DLT SMS straight away. When WhatsApp accepted the message, a fallback
// runs after the response: if Meta has not reported "delivered" or "read"
// within FALLBACK_MS (status webhook, /api/webhooks/whatsapp) and the code is
// still the live one, the same code goes out by SMS. The code is held only in
// this closure, never stored.

export const FALLBACK_MS = 15_000;

export type Channel = 'whatsapp' | 'sms';
export type DeliveryOutcome =
  | { ok: true; channel: Channel; smsFallback: boolean }
  | { ok: false };

async function record(challengeId: string, channel: Channel, messageId: string | null, status: 'sent' | 'failed', error?: string) {
  const { error: e } = await createAdminClient().rpc('otp_delivery_record', {
    p_challenge_id: challengeId, p_channel: channel, p_message_id: messageId ?? '', p_status: status, p_error: error ?? null,
  });
  if (e) console.error('otp_delivery_record failed:', e.message);
}

async function viaSms(challengeId: string, phone: string, code: string): Promise<boolean> {
  const r = await sendDltOtpSms(phone, code);
  await record(challengeId, 'sms', r.ok ? r.messageId : null, r.ok ? 'sent' : 'failed', r.ok ? undefined : r.error);
  return r.ok;
}

export async function deliverOtp(challengeId: string, sends: number, phone: string, code: string, prefer: Channel = 'whatsapp'): Promise<DeliveryOutcome> {
  const wa = whatsappConfigured();
  const sms = smsConfigured();

  if (prefer === 'whatsapp' && wa) {
    const r = await sendWhatsAppAuthCode(phone, code);
    await record(challengeId, 'whatsapp', r.ok ? r.messageId : null, r.ok ? 'sent' : 'failed', r.ok ? undefined : r.error);
    if (r.ok) {
      if (sms) {
        after(async () => {
          await new Promise((res) => setTimeout(res, FALLBACK_MS));
          // Skips the SMS if WhatsApp delivered it, or if this code was since
          // replaced by a resend, used, locked or expired.
          const { data: needed, error } = await createAdminClient().rpc('otp_fallback_needed', { p_challenge_id: challengeId, p_sends: sends });
          if (error) console.error('otp_fallback_needed failed:', error.message);
          else if (needed === true) await viaSms(challengeId, phone, code);
        });
      }
      return { ok: true, channel: 'whatsapp', smsFallback: sms };
    }
  }

  if (sms && (await viaSms(challengeId, phone, code))) return { ok: true, channel: 'sms', smsFallback: false };
  return { ok: false };
}
