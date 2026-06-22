import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { haveTestDb, serviceClient, makeUser, deleteUser, seedVariant, seedDiscount } from './helpers';

const U = 'rpc-user@test.mithila.local';

describe.skipIf(!haveTestDb)('create_order_atomic', () => {
  let user: any;
  beforeAll(async () => { user = await makeUser(U); });
  afterAll(async () => { await deleteUser(U); });

  it('computes subtotal + 18% tax + ₹50 shipping', async () => {
    const v = await seedVariant(500, 10);
    const { data: orderId } = await user.client.rpc('create_order_atomic', {
      p_items: [{ variant_id: v.variantId, quantity: 2 }],
      p_shipping: { city: 'Delhi' },
    });
    const { data: o } = await serviceClient()
      .from('orders').select('subtotal, tax_amount, shipping_amount, total_amount').eq('id', orderId).single();
    expect(Number(o!.subtotal)).toBe(1000);
    expect(Number(o!.tax_amount)).toBe(180);
    expect(Number(o!.shipping_amount)).toBe(50);
    expect(Number(o!.total_amount)).toBe(1230);
  });

  it('decrements stock and rejects oversell', async () => {
    const v = await seedVariant(100, 1);
    const ok = await user.client.rpc('create_order_atomic', {
      p_items: [{ variant_id: v.variantId, quantity: 1 }], p_shipping: {},
    });
    expect(ok.error).toBeNull();
    const fail = await user.client.rpc('create_order_atomic', {
      p_items: [{ variant_id: v.variantId, quantity: 1 }], p_shipping: {},
    });
    expect(fail.error?.message || '').toMatch(/INSUFFICIENT_STOCK/);
    const after = await serviceClient().from('product_variants').select('stock_quantity').eq('id', v.variantId).single();
    expect(Number(after.data?.stock_quantity)).toBe(0);
  });

  it('applies a percentage discount and records it', async () => {
    const v = await seedVariant(1000, 5);
    await seedDiscount('RPC10', 'percentage', 10);
    const { data: orderId } = await user.client.rpc('create_order_atomic', {
      p_items: [{ variant_id: v.variantId, quantity: 1 }], p_shipping: {}, p_discount_code: 'RPC10',
    });
    const { data: o } = await serviceClient()
      .from('orders').select('discount_applied, total_amount, applied_discount_id').eq('id', orderId).single();
    expect(Number(o!.discount_applied)).toBe(100);          // 10% of 1000
    expect(Number(o!.total_amount)).toBe(1130);             // 1000 + 180 + 50 - 100
    expect(o!.applied_discount_id).not.toBeNull();
  });
});
