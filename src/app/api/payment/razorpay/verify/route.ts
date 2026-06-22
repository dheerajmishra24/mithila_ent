import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyPaymentSignature } from '@/lib/razorpay';

// Verifies the Razorpay checkout callback signature, then marks the order paid
// via record_payment (service role). Idempotent (record_payment dedupes by id).
export async function POST(request: Request) {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();
    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (!verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: order } = await supabase.from('orders').select('total_amount').eq('id', orderId).single();

    const { error } = await supabase.rpc('record_payment', {
      p_order_id: orderId,
      p_provider: 'razorpay',
      p_provider_payment_id: razorpay_payment_id,
      p_amount: Number(order?.total_amount || 0),
      p_status: 'captured',
      p_method: 'razorpay',
      p_currency: 'INR',
      p_raw: { razorpay_order_id, razorpay_payment_id },
    });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('razorpay verify:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
