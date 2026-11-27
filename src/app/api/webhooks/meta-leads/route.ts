import { NextResponse, after } from 'next/server';
import { metaVerifyHandshake, verifyMetaSignature } from '@/lib/webhooks/meta-signature';
import { processMetaInbox, recordMetaChanges } from '@/lib/leads/meta';

// Meta Lead Ads webhook (Meta app > Webhooks > Page, field "leadgen"):
//   Callback URL  https://<domain>/api/webhooks/meta-leads
//   Verify token  META_LEADS_VERIFY_TOKEN
//
// POST: X-Hub-Signature-256 is checked over the exact raw bytes
// (META_APP_SECRET), in constant time, before parsing. The leadgen ids are
// archived in public.lead_inbox (UNIQUE per id, so redeliveries are no-ops)
// and the 200 goes back at once; the Graph API fetch runs after the response.
// If archiving fails we answer 500 so Meta retries the delivery.

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 256 * 1024;

export async function GET(request: Request) {
  const challenge = metaVerifyHandshake(new URL(request.url), process.env.META_LEADS_VERIFY_TOKEN);
  if (!challenge) return new NextResponse('Forbidden', { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { 'content-type': 'text/plain' } });
}

export async function POST(request: Request) {
  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  if (!verifyMetaSignature(raw, request.headers.get('x-hub-signature-256'), process.env.META_APP_SECRET)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let ids: string[];
  try {
    ids = await recordMetaChanges(body);
  } catch (e) {
    console.error('meta-leads webhook: archive failed', (e as Error).message);
    return NextResponse.json({ error: 'Temporarily unavailable' }, { status: 500 });
  }
  if (ids.length > 0) {
    after(async () => {
      for (const id of ids) await processMetaInbox(id);
    });
  }
  return NextResponse.json({ received: true });
}
