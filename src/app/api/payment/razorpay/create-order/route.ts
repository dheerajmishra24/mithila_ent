import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createRazorpayOrder, razorpayConfigured, getOrCreateRazorpayCustomer } from '@/lib/razorpay';
import { checkApiRateLimit, clientIp } from '@/lib/ratelimit';

// Creates a Razorpay order for one of OUR orders (which must already exist and
// belong to the signed-in user — enforced by RLS on the read below), binds it to
// our order (orders.razorpay_order_id), and returns what the checkout widget needs.
export async function POST(request: Request) {
  try {
    if (!razorpayConfigured()) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 });
    }
    if (!(await checkApiRateLimit('rp-create:' + clientIp(request)))) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    const { orderId } = await request.json();
    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: order } = await supabase
      .from('orders')
      .select('id, amount_due, is_paid, user_id, shipping_address, razorpay_order_id')
      .eq('id', orderId)
      .single();

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.is_paid) return NextResponse.json({ error: 'Order already paid' }, { status: 409 });

    // amount_due = order total minus any swatch credit applied (migration 0052).
    const amountPaise = Math.round(Number(order.amount_due) * 100);
    if (!Number.isFinite(amountPaise) || amountPaise < 100) {
      return NextResponse.json({ error: 'Invalid order amount' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch or create Razorpay Customer ID for vaulting cards
    let customerId: string | undefined = undefined;
    if (order.user_id) {
      const { data: profile } = await supabase.from('profiles').select('razorpay_customer_id').eq('id', order.user_id).single();
      customerId = profile?.razorpay_customer_id ?? undefined;

      if (!customerId) {
        const addr = order.shipping_address as { firstName?: string; lastName?: string; email?: string } | null;
        const name = [addr?.firstName, addr?.lastName].filter(Boolean).join(' ') || 'Customer';
        const email = addr?.email || 'customer@example.com';

        customerId = await getOrCreateRazorpayCustomer(name, email);
        if (customerId) {
          // profiles.razorpay_customer_id is not client-writable (migration 0039).
          const { error: custErr } = await admin
            .from('profiles')
            .update({ razorpay_customer_id: customerId })
            .eq('id', order.user_id);
          if (custErr) console.error('save razorpay_customer_id:', custErr);
        }
      }
    }

    // Reuse the Razorpay order already bound to this order (Razorpay allows
    // several payment attempts per order), so reopening checkout cannot leave a
    // payment attached to an orphaned Razorpay order.
    if (order.razorpay_order_id) {
      return NextResponse.json({
        razorpayOrderId: order.razorpay_order_id,
        amount: amountPaise,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID,
        customerId,
      });
    }

    const rp = await createRazorpayOrder(amountPaise, String(order.id), { order_id: String(order.id) }, customerId);

    // Bind it to our order; /verify only accepts payments for this id (migration 0041).
    const { data: bound, error: bindErr } = await admin
      .from('orders')
      .update({ razorpay_order_id: rp.id })
      .eq('id', order.id)
      .eq('is_paid', false)
      .is('razorpay_order_id', null)
      .select('id');
    if (bindErr || !bound || bound.length !== 1) {
      console.error('bind razorpay_order_id:', bindErr);
      return NextResponse.json({ error: 'Could not start payment. Please retry.' }, { status: 409 });
    }

    return NextResponse.json({
      razorpayOrderId: rp.id,
      amount: rp.amount,
      currency: rp.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      customerId,
    });
  } catch (err) {
    console.error('razorpay create-order:', err);
    return NextResponse.json({ error: 'Could not start payment' }, { status: 500 });
  }
}
