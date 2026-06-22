import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { haveTestDb, anonClient, serviceClient, makeUser, setAdmin, deleteUser, seedVariant, seedDiscount } from './helpers';

const A = 'rls-a@test.mithila.local';
const B = 'rls-b@test.mithila.local';
const ADM = 'rls-admin@test.mithila.local';

describe.skipIf(!haveTestDb)('RLS boundaries', () => {
  let userA: any, userB: any, admin: any, orderId: string;

  beforeAll(async () => {
    userA = await makeUser(A);
    userB = await makeUser(B);
    admin = await makeUser(ADM);
    await setAdmin(admin.userId);
    const v = await seedVariant(500, 10);
    const { data } = await userA.client.rpc('create_order_atomic', {
      p_items: [{ variant_id: v.variantId, quantity: 1 }],
      p_shipping: { firstName: 'A', city: 'Delhi' },
    });
    orderId = String(data);
  });

  afterAll(async () => {
    await Promise.all([deleteUser(A), deleteUser(B), deleteUser(ADM)]);
  });

  it('owner can read own order', async () => {
    const { data } = await userA.client.from('orders').select('id').eq('id', orderId).maybeSingle();
    expect(data?.id).toBe(orderId);
  });

  it('another user CANNOT read it', async () => {
    const { data } = await userB.client.from('orders').select('id').eq('id', orderId).maybeSingle();
    expect(data).toBeNull();
  });

  it('admin can read all orders', async () => {
    const { data } = await admin.client.from('orders').select('id').eq('id', orderId).maybeSingle();
    expect(data?.id).toBe(orderId);
  });

  it('anonymous cannot read orders', async () => {
    const { data } = await anonClient().from('orders').select('id').eq('id', orderId).maybeSingle();
    expect(data).toBeNull();
  });

  it('discounts are NOT enumerable by anon/retail', async () => {
    await seedDiscount('RLSANON10', 'percentage', 10);
    const anonRows = await anonClient().from('discounts').select('code');
    const retailRows = await userB.client.from('discounts').select('code');
    expect((anonRows.data || []).length).toBe(0);
    expect((retailRows.data || []).length).toBe(0);
  });

  it('a valid code is still checkable via validate_discount', async () => {
    const { data } = await userB.client.rpc('validate_discount', { p_code: 'RLSANON10', p_subtotal: 1000 });
    expect((data as any)?.valid).toBe(true);
  });

  it('retail user cannot write product_variants', async () => {
    const v = await seedVariant(700, 3);
    const { error } = await userB.client.from('product_variants').update({ price: 1 }).eq('id', v.variantId);
    const after = await serviceClient().from('product_variants').select('price').eq('id', v.variantId).single();
    expect(Number(after.data?.price)).toBe(700); // unchanged
    expect(error === null || error !== null).toBe(true); // RLS may error or no-op; either way no change
  });

  it('record_payment is NOT callable by an authenticated user', async () => {
    const { error } = await userB.client.rpc('record_payment', {
      p_order_id: orderId, p_provider: 'x', p_provider_payment_id: 'p', p_amount: 1,
    });
    expect(error).not.toBeNull(); // permission denied
  });
});
