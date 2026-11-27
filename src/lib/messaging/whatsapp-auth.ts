import 'server-only';
import { providerBase } from '@/lib/otp';

// WhatsApp Cloud API: send a one-time code with an approved AUTHENTICATION
// template (Meta's preset category: no links, offers or emojis in the text,
// and a "copy code" button). The template name and language come from env;
// the code is the body variable and the button's URL-suffix parameter, as Meta
// requires for copy-code authentication templates.

export type SendResult = { ok: true; messageId: string | null } | { ok: false; error: string };

const GRAPH = 'https://graph.facebook.com/v21.0';

export function whatsappAuthPayload(toE164: string, code: string) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toE164.replace(/^\+/, ''),
    type: 'template',
    template: {
      name: process.env.WHATSAPP_AUTH_TEMPLATE,
      language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
      ],
    },
  };
}

export async function sendWhatsAppAuthCode(toE164: string, code: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId || !process.env.WHATSAPP_AUTH_TEMPLATE) return { ok: false, error: 'not_configured' };
  const base = providerBase(process.env.WHATSAPP_API_BASE, GRAPH);
  try {
    const res = await fetch(`${base}/${encodeURIComponent(phoneId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(whatsappAuthPayload(toE164, code)),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[]; error?: { code?: number; message?: string } };
    if (!res.ok) return { ok: false, error: `http_${res.status}${body.error?.code ? `_${body.error.code}` : ''}` };
    return { ok: true, messageId: body.messages?.[0]?.id ?? null };
  } catch (err) {
    return { ok: false, error: (err as Error).name === 'TimeoutError' ? 'timeout' : 'network' };
  }
}
