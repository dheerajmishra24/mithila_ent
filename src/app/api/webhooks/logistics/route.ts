import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Logistics provider webhook: updates an order's tracking status.
//
// Auth: the provider must send a shared secret in the `x-webhook-secret` header
// that matches LOGISTICS_WEBHOOK_SECRET. If the secret is unset or wrong, the
// request is rejected (fail closed).
//
// We use the Supabase service-role client here because this request has no user
// session, and `orders` is admin-write under RLS, so the anon client would be
// silently blocked. The secret check is what authorizes the call.
export async function POST(request: Request) {
  try {
    const expectedSecret = process.env.LOGISTICS_WEBHOOK_SECRET;
    const providedSecret = request.headers.get('x-webhook-secret');

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const { order_id, tracking_status } = payload ?? {};

    if (!order_id || typeof tracking_status !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { error } = await supabase
      .from('orders')
      .update({ tracking_status })
      .eq('id', order_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
