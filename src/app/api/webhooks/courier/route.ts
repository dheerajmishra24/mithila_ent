import { after, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { secretMatches } from '@/lib/secure-compare';
import { normaliseShiprocketPayload } from '@/lib/courier/shiprocket';
import { notifyOrderStatus } from '@/lib/orders/notify';
import { sendOwnerAlertEmail } from '@/lib/email';

// Shiprocket tracking webhook (Settings > API > Webhooks).
//
// - Shiprocket forbids "shiprocket", "kartrocket", "sr" and "kr" in the URL,
//   hence /api/webhooks/courier.
// - Auth: the security token Shiprocket sends as `x-api-key` must equal
//   SHIPROCKET_WEBHOOK_TOKEN. Shiprocket calls the token optional; here it is
//   required, and an unset token rejects everything (fail closed).
// - Shiprocket expects HTTP 200. An authenticated body we cannot use (a
//   connection test, an unknown shape) is logged and answered 200 so the
//   webhook is not disabled; only a database failure answers 500.
// - Scans are stored once (unique per AWB/time/status); the order moves
//   forward only (paid -> shipped -> delivered) inside shipment_apply().
//   E-mails and owner alerts run after the response.

const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: Request) {
  if (!secretMatches(process.env.SHIPROCKET_WEBHOOK_TOKEN, request.headers.get('x-api-key'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  const input = normaliseShiprocketPayload(body);
  if (!input) {
    console.warn('courier webhook: ignored a body without a usable AWB');
    return NextResponse.json({ ok: true, ignored: true });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('shipment_apply', { p: input });
  if (error) {
    console.error('shipment_apply failed:', error.message);
    return NextResponse.json({ error: 'Could not record the update' }, { status: 500 });
  }

  const r = data as { matched: boolean; order_id?: string; status_to?: 'shipped' | 'delivered' | null; problem?: boolean; status_label?: string };
  if (r.matched && r.order_id) {
    const orderId = r.order_id;
    after(async () => {
      if (r.status_to) await notifyOrderStatus(admin, orderId, r.status_to);
      if (r.problem) {
        await sendOwnerAlertEmail(`Delivery problem: order #${orderId.split('-')[0].toUpperCase()}`, [
          `The courier reports "${r.status_label}" for AWB ${input.awb}.`,
          'Check the order in the owner portal and contact the customer or the courier.',
        ]);
      }
    });
  }
  return NextResponse.json({ ok: true });
}
