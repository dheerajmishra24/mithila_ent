import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';

// Resend e-mail events (Resend dashboard > Webhooks), signed with Svix.
//
// - Verified with the Resend SDK (resend.webhooks.verify, Standard Webhooks:
//   HMAC-SHA256 over "id.timestamp.raw-body", 5-minute timestamp window)
//   against RESEND_WEBHOOK_SECRET (whsec_...). Unset secret = reject all.
// - The raw body is verified before it is parsed.
// - Each svix-id is recorded once (public.email_webhook_events), so Resend's
//   retries and manual replays change nothing.
// - email.bounced (except bounce.type "Temporary") and email.complained put
//   the recipient on public.email_suppressions; the e-mail queue then stops
//   writing to that address. Recording is one small insert, done before 200.

const MAX_BODY_BYTES = 256 * 1024;
const verifier = new Resend(process.env.RESEND_API_KEY || 're_verify_only');

type ResendEvent = {
  type?: unknown;
  data?: { email_id?: unknown; to?: unknown; bounce?: { type?: unknown; subType?: unknown; message?: unknown } };
};

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signature = request.headers.get('svix-signature');
  if (!secret || !id || !timestamp || !signature) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  let event: ResendEvent;
  try {
    event = verifier.webhooks.verify({ payload: raw, headers: { id, timestamp, signature }, webhookSecret: secret }) as ResendEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const type = typeof event?.type === 'string' ? event.type.slice(0, 60) : 'unknown';
  const data = event?.data ?? {};
  const recipients = Array.isArray(data.to) ? data.to.filter((t): t is string => typeof t === 'string').slice(0, 50) : [];
  const bounce = data.bounce ?? {};
  const detail = [bounce.type, bounce.subType, bounce.message]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(' · ')
    .replace(/[<>]/g, '')
    .slice(0, 500);

  const { error } = await createAdminClient().rpc('email_event_record', {
    p_message_id: id.slice(0, 200),
    p_type: type,
    p_email_id: typeof data.email_id === 'string' ? data.email_id.slice(0, 100) : null,
    p_recipients: recipients,
    p_bounce_type: typeof bounce.type === 'string' ? bounce.type : null,
    p_detail: detail || null,
  });
  if (error) {
    console.error('email_event_record failed:', error.message);
    return NextResponse.json({ error: 'Could not record the event' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
