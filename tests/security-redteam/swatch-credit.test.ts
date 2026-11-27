import crypto from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { catalogue, dbEnabled, persona, race, record, service, SHIPPING, type Fixture, type Persona } from './harness';

// Swatch credit (migration 0052) under attack: customers calling the credit
// RPCs or writing the ledger directly, reading someone else's balance, and a
// burst of parallel redemptions trying to spend one balance twice.

describe.skipIf(!dbEnabled)('red-team: swatch credit (local stack)', () => {
  let cat: Fixture;
  let a: Persona;
  let b: Persona;
  let fabric: string;

  const earnKit = async (who: Persona) => {
    const kit = await service().rpc('create_swatch_order', {
      p_user_id: who.id, p_variant_ids: [fabric], p_shipping: SHIPPING, p_idempotency_key: crypto.randomUUID(),
    });
    if (kit.error) throw new Error(kit.error.message);
    const pay = await service().rpc('record_payment', {
      p_order_id: kit.data, p_provider: 'razorpay', p_provider_payment_id: `pay_sw_${crypto.randomUUID().slice(0, 12)}`,
      p_amount: 99, p_status: 'captured', p_method: 'upi',
    });
    if (pay.error) throw new Error(pay.error.message);
    return kit.data as string;
  };

  const balanceOf = async (userId: string) => {
    const r = await service().from('swatch_credit_accounts').select('balance').eq('user_id', userId).maybeSingle();
    return Number(r.data?.balance ?? 0);
  };

  beforeAll(async () => {
    cat = await catalogue('swatch');
    fabric = await cat.variant(200, 400);
    a = await persona('swatch-a');
    b = await persona('swatch-b');
    await earnKit(a);
  }, 60_000);

  it('a paid kit credits its price', async () => {
    expect(await balanceOf(a.id)).toBe(99);
  });

  it('customers cannot call the credit RPCs or write balances and the ledger', async () => {
    const calls = await Promise.all([
      a.client.rpc('swatch_credit_post', { p_user_id: a.id, p_order_id: null, p_entry: 'adjust', p_amount: 10000, p_key: crypto.randomUUID() }),
      a.client.rpc('admin_adjust_swatch_credit', { p_user_id: a.id, p_amount: 10000, p_note: 'free money', p_actor: a.id, p_key: crypto.randomUUID() }),
      a.client.rpc('apply_swatch_credit', { p_order_id: crypto.randomUUID(), p_user_id: a.id }),
      a.client.rpc('create_swatch_order', { p_user_id: a.id, p_variant_ids: [fabric], p_shipping: SHIPPING }),
    ]);
    for (const c of calls) expect(c.error, 'RPC must be refused').not.toBeNull();

    const ins = await a.client.from('swatch_credit_ledger').insert({
      user_id: a.id, entry: 'adjust', amount: 5000, balance_after: 5099, idempotency_key: crypto.randomUUID(),
    });
    expect(ins.error).not.toBeNull();
    const upd = await a.client.from('swatch_credit_accounts').update({ balance: 100000 }).eq('user_id', a.id).select('balance');
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
    const settings = await a.client.from('swatch_settings').update({ kit_price: 1 }).eq('id', 1).select('kit_price');
    expect(settings.error !== null || (settings.data ?? []).length === 0).toBe(true);
    expect(await balanceOf(a.id)).toBe(99);
    record('swatch.customer_writes', calls.map((c) => c.error?.message?.slice(0, 40)));
  });

  it('customer B cannot see customer A balance or ledger', async () => {
    const acct = await b.client.from('swatch_credit_accounts').select('*').eq('user_id', a.id);
    const ledger = await b.client.from('swatch_credit_ledger').select('*').eq('user_id', a.id);
    expect(acct.data ?? []).toHaveLength(0);
    expect(ledger.data ?? []).toHaveLength(0);
    const own = await a.client.from('swatch_credit_ledger').select('entry, amount');
    expect((own.data ?? []).some((r) => r.entry === 'earn' && Number(r.amount) === 99)).toBe(true);
  });

  it('three parallel orders cannot spend one balance twice', async () => {
    const orders: string[] = [];
    for (let i = 0; i < 3; i++) {
      const o = await service().rpc('create_order_atomic', {
        p_user_id: a.id, p_items: [{ variant_id: fabric, quantity: 1 }], p_shipping: SHIPPING,
        p_shipping_amount: 60, p_discount_code: null, p_idempotency_key: crypto.randomUUID(),
      });
      if (o.error) throw new Error(o.error.message);
      orders.push(o.data as string);
    }
    const burst = await race(orders.length * 4, (i) =>
      service().rpc('apply_swatch_credit', { p_order_id: orders[i % orders.length], p_user_id: a.id }));
    const applied = await service().from('orders').select('credit_applied').in('id', orders);
    const total = (applied.data ?? []).reduce((t, r) => t + Number(r.credit_applied), 0);
    record('swatch.redeem_race', { histogram: burst.histogram, total });
    expect(total).toBe(99);
    expect(await balanceOf(a.id)).toBe(0);
    const redeems = await service().from('swatch_credit_ledger').select('amount').eq('user_id', a.id).eq('entry', 'redeem');
    expect((redeems.data ?? []).reduce((t, r) => t + Number(r.amount), 0)).toBe(-99);

    // Clean up: cancel the three orders; the credit comes back once.
    for (const id of orders) await service().from('orders').update({ status: 'cancelled' }).eq('id', id);
    expect(await balanceOf(a.id)).toBe(99);
  });

  it('the payment check uses the amount due after credit', async () => {
    const o = await service().rpc('create_order_atomic', {
      p_user_id: a.id, p_items: [{ variant_id: fabric, quantity: 1 }], p_shipping: SHIPPING,
      p_shipping_amount: 60, p_discount_code: null, p_idempotency_key: crypto.randomUUID(),
    });
    if (o.error) throw new Error(o.error.message);
    await service().rpc('apply_swatch_credit', { p_order_id: o.data, p_user_id: a.id });
    const row = await service().from('orders').select('total_amount, credit_applied, amount_due').eq('id', o.data).single();
    const due = Number(row.data!.amount_due);
    expect(due).toBe(Number(row.data!.total_amount) - 99);
    const short = await service().rpc('record_payment', {
      p_order_id: o.data, p_provider: 'razorpay', p_provider_payment_id: `pay_short_${crypto.randomUUID().slice(0, 8)}`,
      p_amount: due - 1, p_status: 'captured', p_method: 'upi',
    });
    expect(short.error?.message).toMatch(/PARTIAL_PAYMENT_REJECTED/);
    const full = await service().rpc('record_payment', {
      p_order_id: o.data, p_provider: 'razorpay', p_provider_payment_id: `pay_due_${crypto.randomUUID().slice(0, 8)}`,
      p_amount: due, p_status: 'captured', p_method: 'upi',
    });
    expect(full.error).toBeNull();
  });
});
