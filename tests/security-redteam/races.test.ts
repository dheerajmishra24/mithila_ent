import crypto from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { catalogue, dbEnabled, persona, race, record, service, SHIPPING, stockOf, type Fixture, type Persona } from './harness';

// Playbook Step 5: TOCTOU money and inventory races, fired as barrier-synchronised
// bursts straight at the RPCs the server calls (create_order_atomic,
// partial_cancel_order_item, cancel_order_restock, record_payment, adjust_stock)
// and at the webhook inbox. The invariants are checked in the database.

const N = 20;

describe.skipIf(!dbEnabled)('red-team: concurrency races (local stack)', () => {
  let cat: Fixture;
  let a: Persona;
  let admin: Persona;

  beforeAll(async () => {
    cat = await catalogue('race');
    a = await persona('race-a');
    admin = await persona('race-admin', { admin: true });
  }, 60_000);

  const order = (userId: string, items: { variant_id: string; quantity: number }[], code: string | null = null) =>
    service().rpc('create_order_atomic', {
      p_user_id: userId,
      p_items: items,
      p_shipping: SHIPPING,
      p_shipping_amount: 60,
      p_discount_code: code,
      p_idempotency_key: crypto.randomUUID(),
    });

  it('single-use coupon: 20 parallel checkouts redeem it once', async () => {
    const variant = await cat.variant(1000);
    const code = `RT1-${crypto.randomUUID().slice(0, 8)}`.toUpperCase();
    const d = await service()
      .from('discounts')
      .insert({ code, type: 'fixed_amount', value: 10, target_type: 'all', max_uses: 1, current_uses: 0, is_active: true })
      .select('id')
      .single();
    expect(d.error).toBeNull();

    const r = await race(N, () => order(a.id, [{ variant_id: variant, quantity: 1 }], code));
    record('coupon_global_histogram', r.histogram);

    const after = await service().from('discounts').select('current_uses').eq('id', d.data!.id).single();
    const used = await service().from('orders').select('id', { count: 'exact', head: true }).eq('applied_discount_id', d.data!.id);
    record('coupon_global_invariant', { succeeded: r.ok.length, current_uses: after.data?.current_uses, orders_with_coupon: used.count });
    expect(r.ok.length).toBe(1);
    expect(after.data?.current_uses).toBe(1);
    expect(used.count).toBe(1);
  }, 60_000);

  it('per-user coupon: one customer firing 20 checkouts redeems it once', async () => {
    const variant = await cat.variant(1000);
    const code = `RTU-${crypto.randomUUID().slice(0, 8)}`.toUpperCase();
    const d = await service()
      .from('discounts')
      .insert({ code, type: 'percentage', value: 10, target_type: 'all', max_uses: 100, max_uses_per_user: 1, current_uses: 0, is_active: true })
      .select('id')
      .single();
    expect(d.error).toBeNull();
    const buyer = await persona('race-peruser');

    const r = await race(N, () => order(buyer.id, [{ variant_id: variant, quantity: 1 }], code));
    record('coupon_per_user_histogram', r.histogram);
    const used = await service()
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('applied_discount_id', d.data!.id)
      .eq('user_id', buyer.id);
    record('coupon_per_user_invariant', { succeeded: r.ok.length, orders_with_coupon: used.count });
    expect(r.ok.length).toBe(1);
    expect(used.count).toBe(1);
  }, 60_000);

  it('last stock: 15 parallel orders of 2 against stock 3 sell exactly once', async () => {
    const variant = await cat.variant(3);
    const r = await race(15, () => order(a.id, [{ variant_id: variant, quantity: 2 }]));
    const left = await stockOf(variant);
    record('oversell_histogram', r.histogram);
    record('oversell_invariant', { succeeded: r.ok.length, stock_after: left });
    expect(r.ok.length).toBe(1);
    expect(left).toBe(1);
  }, 60_000);

  it('admin stock adjustments never lose an update or go negative', async () => {
    // adjust_stock is for piece goods; metre stock lives on rolls (USE_ROLLS).
    const variant = await cat.pcsVariant(10);
    const r = await race(N, (i) => service().rpc('adjust_stock', { p_variant_id: variant, p_delta: i % 2 === 0 ? -1 : 2 }));
    const left = await stockOf(variant);
    record('adjust_stock_invariant', { succeeded: r.ok.length, stock_after: left, expected: 10 - 10 + 20 });
    expect(r.ok.length).toBe(N);
    expect(left).toBe(20); // 10 - 10*1 + 10*2: every delta applied exactly once
  }, 60_000);

  it('partial cancel: 20 parallel cancels of one line restock it once', async () => {
    const v1 = await cat.variant(50);
    const v2 = await cat.variant(50);
    const o = await order(a.id, [{ variant_id: v1, quantity: 4 }, { variant_id: v2, quantity: 1 }]);
    expect(o.error).toBeNull();
    const item = await service().from('order_items').select('id').eq('order_id', o.data).eq('variant_id', v1).single();
    expect(await stockOf(v1)).toBe(46);

    const r = await race(N, () =>
      service().rpc('partial_cancel_order_item', { p_order_id: o.data, p_order_item_id: item.data!.id, p_restock: true, p_actor: admin.id }),
    );
    const left = await stockOf(v1);
    record('partial_cancel_histogram', r.histogram);
    record('partial_cancel_invariant', { succeeded: r.ok.length, stock_after: left });
    expect(r.ok.length).toBe(1);
    expect(left).toBe(50);
  }, 60_000);

  it('full cancel: 20 parallel cancels of one order restock it once', async () => {
    const v = await cat.variant(30);
    // Fresh customer: the earlier bursts used up a's pending-order allowance
    // (TOO_MANY_PENDING_ORDERS, the anti-abuse cap from 0043).
    const buyer = await persona('race-cancel');
    const o = await order(buyer.id, [{ variant_id: v, quantity: 5 }]);
    expect(o.error).toBeNull();
    const r = await race(N, () => service().rpc('cancel_order_restock', { p_order_id: o.data, p_restock: true, p_actor: admin.id }));
    const left = await stockOf(v);
    const st = await service().from('orders').select('status').eq('id', o.data).single();
    record('full_cancel_histogram', r.histogram);
    record('full_cancel_invariant', { stock_after: left, status: st.data?.status });
    expect(left).toBe(30);
    expect(st.data?.status).toBe('cancelled');
  }, 60_000);

  it('payment capture: 20 parallel record_payment calls for one payment write one row', async () => {
    const v = await cat.variant(30);
    const buyer = await persona('race-pay');
    const o = await order(buyer.id, [{ variant_id: v, quantity: 1 }]);
    expect(o.error).toBeNull();
    const tot = await service().from('orders').select('total_amount').eq('id', o.data).single();
    const pay = `pay_rt_${crypto.randomUUID().slice(0, 12)}`;
    const r = await race(N, () =>
      service().rpc('record_payment', {
        p_order_id: o.data, p_provider: 'razorpay', p_provider_payment_id: pay,
        p_amount: Number(tot.data!.total_amount), p_status: 'captured', p_method: 'upi',
      }),
    );
    const rows = await service().from('payments').select('id', { count: 'exact', head: true }).eq('provider_payment_id', pay);
    const paid = await service().from('orders').select('is_paid, status').eq('id', o.data).single();
    record('record_payment_histogram', r.histogram);
    record('record_payment_invariant', { payment_rows: rows.count, is_paid: paid.data?.is_paid, status: paid.data?.status });
    expect(rows.count).toBe(1);
    expect(paid.data?.is_paid).toBe(true);
  }, 60_000);

  it('webhook inbox: 20 parallel deliveries of one event claim it once', async () => {
    const id = `evt_rt_${crypto.randomUUID().slice(0, 12)}`;
    const r = await race(N, () =>
      service()
        .from('webhook_events')
        .upsert({ provider: 'razorpay', event_id: id, event_type: 'payment.captured', payload: {} }, { onConflict: 'provider,event_id', ignoreDuplicates: true })
        .select('event_id'),
    );
    const claimed = r.ok.reduce((n, x) => n + ((x.data as unknown[] | null)?.length ?? 0), 0);
    const rows = await service().from('webhook_events').select('event_id', { count: 'exact', head: true }).eq('event_id', id);
    record('webhook_inbox_invariant', { deliveries: N, claimed_for_processing: claimed, rows: rows.count });
    expect(claimed).toBe(1);
    expect(rows.count).toBe(1);
  }, 60_000);
});
