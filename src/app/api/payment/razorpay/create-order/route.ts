import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createRazorpayOrder, razorpayConfigured } from '@/lib/razorpay';
import { checkApiRateLimit, clientIp } from '@/lib/ratelimit';

// Creates a Razorpay order for one of OUR orders (which must already exist and
// belong to the signed-in user — enforced by RLS). Returns the data the client
// checkout widget needs.
export async function POST(request: Request) {
  try {
    if (!razorpayConfigured()) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 });
    }
    if (!(await checkApiRateLimit('rp-create:' + clientIp(request)))) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    const { orderId } = await request.json();
    if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });

    const supabase = await createClient();
    const { data: order } = await supabase
      .from('orders')
      .select('id, total_amount, is_paid')
      .eq('id', orderId)
      .single();

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.is_paid) return NextResponse.json({ error: 'Order already paid' }, { status: 409 });

    const amountPaise = Math.round(Number(order.total_amount) * 100);
    const rp = await createRazorpayOrder(amountPaise, String(order.id), { order_id: String(order.id) });

    return NextResponse.json({
      razorpayOrderId: rp.id,
      amount: rp.amount,
      currency: rp.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('razorpay create-order:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
