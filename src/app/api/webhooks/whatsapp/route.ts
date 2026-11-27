import { NextResponse, after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { metaVerifyHandshake, verifyMetaSignature } from '@/lib/webhooks/meta-signature';
import { extractStatuses } from '@/lib/webhooks/whatsapp-status';

// WhatsApp Cloud API webhook (Meta app > WhatsApp > Configuration):
//   Callback URL  https://<domain>/api/webhooks/whatsapp
//   Verify token  WHATSAPP_VERIFY_TOKEN
//   Fields        messages
// Only message *statuses* are used: they tell the sign-in code sender whether
// the WhatsApp code arrived, so the SMS fallback can stand down.
//
// POST: X-Hub-Signature-256 checked over the raw body (META_APP_SECRET), in
// constant time, before parsing; 200 straight away; statuses stored after the
// response. Status updates are forward-only in the database, so retries and
// out-of-order deliveries are harmless.

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 256 * 1024;

export async function GET(request: Request) {
  const challenge = metaVerifyHandshake(new URL(request.url), process.env.WHATSAPP_VERIFY_TOKEN);
  if (!challenge) return new NextResponse('Forbidden', { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { 'content-type': 'text/plain' } });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  if (!verifyMetaSignature(raw, request.headers.get('x-hub-signature-256'), process.env.META_APP_SECRET)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const statuses = extractStatuses(body);
  if (statuses.length > 0) {
    after(async () => {
      const admin = createAdminClient();
      for (const s of statuses) {
        const { error } = await admin.rpc('otp_delivery_status', { p_message_id: s.id, p_status: s.status });
        if (error) console.error('whatsapp webhook: status update failed', error.message);
      }
    });
  }
  return NextResponse.json({ received: true });
}
