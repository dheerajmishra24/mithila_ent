import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Payment-gateway webhook (Razorpay / Stripe / etc.).
//
// Auth: the gateway must send a shared secret in the `x-webhook-secret` header
// matching PAYMENT_WEBHOOK_SECRET (fail closed). Uses the service-role client so
// it can call record_payment(), which logs the payment and marks the order paid.
//
// Expected JSON body:
//   { order_id, amount, status?, provider?, provider_payment_id?, method?, currency? }
export async function POST(request: Request) {
  try {
    const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET;
    const providedSecret = request.headers.get('x-webhook-secret');
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const {
      order_id,
      amount,
      status = 'captured',
      provider = 'gateway',
      provider_payment_id = null,
      method = null,
      currency = 'INR',
    } = payload ?? {};

    if (!order_id || amount == null) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data, error } = await supabase.rpc('record_payment', {
      p_order_id: order_id,
      p_provider: provider,
      p_provider_payment_id: provider_payment_id,
      p_amount: amount,
      p_status: status,
      p_method: method,
      p_currency: currency,
      p_raw: payload,
    });

    if (error) throw error;
    return NextResponse.json({ success: true, payment_id: data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
