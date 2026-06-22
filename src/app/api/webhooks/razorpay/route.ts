import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyWebhookSignature } from '@/lib/razorpay';

// Razorpay webhook — the source of truth for captures (fires even if the buyer
// closes the tab). Verifies the signature, then records the payment idempotently.
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';
    if (!verifyWebhookSignature(raw, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(raw);
    const entity = event?.payload?.payment?.entity;
    const orderId = entity?.notes?.order_id;
    const status =
      event?.event === 'payment.captured' ? 'captured' :
      event?.event === 'payment.failed' ? 'failed' : null;

    if (!orderId || !status) return NextResponse.json({ received: true });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    await supabase.rpc('record_payment', {
      p_order_id: orderId,
      p_provider: 'razorpay',
      p_provider_payment_id: entity.id,
      p_amount: Number(entity.amount || 0) / 100,
      p_status: status,
      p_method: entity.method || 'razorpay',
      p_currency: entity.currency || 'INR',
      p_raw: event,
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('razorpay webhook:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
