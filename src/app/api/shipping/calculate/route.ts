import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateShippingRates, isValidPinCode } from '@/lib/shipping';
import { gstRateFor, splitGst } from '@/lib/gst';
import { checkApiRateLimit } from '@/lib/ratelimit';

// Checkout-only quote endpoint. SEC-05: requires a signed-in user (checkout
// needs one anyway), is rate limited per user because every call spends a
// courier API request, validates the PIN code, and returns generic errors.
const MAX_ITEMS = 50;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (!(await checkApiRateLimit(`shipping-quote:${userData.user.id}`))) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const items = body?.items;
    const pinCode = typeof body?.pinCode === 'string' ? body.pinCode.trim() : '';
    const state = typeof body?.state === 'string' ? body.state.trim().slice(0, 64) : '';
    // Display-only estimate input: the order total is recomputed in the database.
    const discount = Number.isFinite(Number(body?.discount)) ? Math.max(Number(body.discount), 0) : 0;

    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS || !state) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    if (!isValidPinCode(pinCode)) {
      return NextResponse.json({ error: 'Invalid PIN code' }, { status: 400 });
    }

    const lines = items
      .map((i: any) => ({
        id: typeof (i?.id ?? i?.variant_id) === 'string' ? (i.id ?? i.variant_id) : null,
        quantity: Number(i?.quantity),
      }))
      .filter((i: { id: string | null; quantity: number }) =>
        i.id && Number.isFinite(i.quantity) && i.quantity > 0 && i.quantity <= 1000);
    if (lines.length === 0) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Weight, price, HSN and GST rate come from the database, never the client.
    // Same rules as create_order_atomic / apply_order_gst (migration 0051):
    // tax on the value after a pro-rata discount, GST 2.0 rate by HSN.
    let totalWeightGrams = 0;
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, weight_grams, price, products(gst_rate, hsn_code)')
      .in('id', lines.map((l: { id: string }) => l.id));

    const priced = lines.flatMap((item: { id: string; quantity: number }) => {
      const v = variants?.find((x) => x.id === item.id);
      if (!v) return [];
      const p = (Array.isArray(v.products) ? v.products[0] : v.products) as { gst_rate?: number; hsn_code?: string | null } | null;
      totalWeightGrams += (v.weight_grams || 200) * item.quantity;
      return [{ quantity: item.quantity, line: Math.round(Number(v.price || 0) * item.quantity * 100) / 100, hsn: p?.hsn_code ?? null, fallback: Number(p?.gst_rate ?? 5) }];
    });
    const baseAmount = priced.reduce((t: number, l: { line: number }) => t + l.line, 0);
    const disc = Math.min(discount, baseAmount);

    let totalIgst = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    for (const l of priced) {
      const share = baseAmount > 0 ? (l.line * disc) / baseAmount : 0;
      const taxable = Math.max(l.line - share, 0);
      const rate = gstRateFor(l.hsn, taxable / l.quantity, l.fallback);
      const t = splitGst(state, taxable, rate);
      totalIgst += t.igst;
      totalCgst += t.cgst;
      totalSgst += t.sgst;
    }
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const totalGst = round2(totalIgst + totalCgst + totalSgst);

    const weightKg = totalWeightGrams / 1000;
    const shipRes = await calculateShippingRates(pinCode, weightKg > 0 ? weightKg : 0.2);

    return NextResponse.json({
      shippingAmount: shipRes.rate,
      totalGst,
      breakdown: {
        igst: round2(totalIgst),
        cgst: round2(totalCgst),
        sgst: round2(totalSgst),
      },
      courierId: shipRes.courierId ?? null,
      baseAmount
    });
  } catch (err) {
    console.error('Shipping calculation error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Could not calculate shipping' }, { status: 500 });
  }
}
