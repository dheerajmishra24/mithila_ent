// Phase 1 roll inventory, end to end through the real admin UI (local stack
// only): receive a roll, a paid metre order is allocated to it, the cut sheet
// marks it cut, and the customer can no longer cancel. Pages are axe-audited.
import { expect, test } from '@playwright/test';
import crypto from 'crypto';
import { appEnabled, catalogue, persona, record, service, SHIPPING, type Persona } from '../security-redteam/harness';
import { audit, expectClean, signIn, visit, watch } from './helpers';

test.describe('roll inventory (local stack)', () => {
  test.skip(!appEnabled, 'needs the local stack (npm run test:e2e:local)');

  let admin: Persona;
  let customer: Persona;
  let variantId: string;
  let pcsVariantId: string;

  test.beforeAll(async () => {
    admin = await persona('rolls-admin', { admin: true });
    customer = await persona('rolls-customer');
    const cat = await catalogue('rolls');
    variantId = await cat.variant(0, 400); // no opening roll: the admin receives one below
    pcsVariantId = await cat.pcsVariant(5, 2600);
  });

  test('admin pages render cleanly', async ({ page, context }) => {
    await signIn(context, admin);
    const issues = watch(page);
    for (const path of [`/admin/inventory/${variantId}`, '/admin/inventory', '/admin/cut-sheet']) {
      await visit(page, path, issues);
      const r = await audit(page, `admin ${path.replace(variantId, '[variantId]')}`, issues);
      expectClean(path, r, issues);
    }
    await visit(page, '/remnants', issues);
    const r = await audit(page, 'anon /remnants', issues);
    expectClean('/remnants', r, issues);
  });

  test('receive a roll, cut a paid order from it, then cancellation is refused', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'stateful flow runs once');
    await signIn(context, admin);

    // 1. Receive a 12.5 m roll through the form.
    await page.goto(`/admin/inventory/${variantId}`);
    await page.getByLabel('Length (m)').fill('12.5');
    await page.getByLabel('Dye lot').fill('lot-77');
    await page.getByRole('button', { name: 'Add roll' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Received 12.5 m' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'LOT-77' })).toBeVisible();

    const roll = await service().from('fabric_rolls').select('id, roll_code, remaining_m').eq('variant_id', variantId).single();
    expect(Number(roll.data!.remaining_m)).toBe(12.5);
    const v = await service().from('product_variants').select('stock_quantity, max_cut_m').eq('id', variantId).single();
    expect(Number(v.data!.stock_quantity)).toBe(12.5);

    // 2. A customer pays for 2.5 m (allocated to that roll, dye lot snapshotted).
    const o = await service().rpc('create_order_atomic', {
      p_user_id: customer.id, p_items: [{ variant_id: variantId, quantity: 2.5 }], p_shipping: SHIPPING,
      p_shipping_amount: 60, p_discount_code: null, p_idempotency_key: crypto.randomUUID(),
    });
    if (o.error) throw new Error(o.error.message);
    const orderId = o.data as string;
    const tot = await service().from('orders').select('total_amount').eq('id', orderId).single();
    const pay = await service().rpc('record_payment', {
      p_order_id: orderId, p_provider: 'razorpay', p_provider_payment_id: `pay_rolls_${crypto.randomUUID().slice(0, 12)}`,
      p_amount: Number(tot.data!.total_amount), p_status: 'captured', p_method: 'upi',
    });
    if (pay.error) throw new Error(pay.error.message);
    const item = await service().from('order_items').select('quantity, uqc, dye_lot').eq('order_id', orderId).single();
    record('rolls.order_item', item.data);
    expect(item.data).toMatchObject({ uqc: 'MTR', dye_lot: 'LOT-77' });
    expect(Number(item.data!.quantity)).toBe(2.5);

    // 3. The cut sheet lists it under the roll; mark it cut.
    await page.goto('/admin/cut-sheet');
    const code = roll.data!.roll_code as string;
    await expect(page.getByRole('heading', { name: new RegExp(code) })).toBeVisible();
    await page.getByRole('button', { name: `Mark cut: 2.50 m from ${code}` }).click();
    await expect(page.getByRole('button', { name: `Mark cut: 2.50 m from ${code}` })).toHaveCount(0);
    await expect(page.getByRole('row', { name: new RegExp(orderId.slice(0, 8), 'i') })).toContainText(/Cut \d/);
    const cut = await service().from('order_item_cuts').select('status, cut_by').eq('order_id', orderId).single();
    expect(cut.data).toMatchObject({ status: 'cut', cut_by: admin.id });

    // 4. Past the cut boundary the customer cannot cancel.
    const cancel = await customer.client.rpc('request_order_cancellation', { p_order_id: orderId });
    record('rolls.cancel_after_cut', cancel.data ?? cancel.error?.message);
    expect(cancel.data).toMatchObject({ ok: false, error: 'ALREADY_CUT' });

    // 5. Roll page: 10 m left, 2.5 m shown as cut.
    await page.goto(`/admin/inventory/${variantId}`);
    const row = page.getByRole('row', { name: new RegExp(code) });
    await expect(row).toContainText('10.00 m');
    await expect(row).toContainText('2.50 m');
  });

  test('metre stock cannot be edited directly; piece stock can', async () => {
    // Direct writes to a metre variant's stock are ignored by the guard trigger.
    await service().from('product_variants').update({ stock_quantity: 999 }).eq('id', variantId);
    const after = await service().from('product_variants').select('stock_quantity').eq('id', variantId).single();
    expect(Number(after.data!.stock_quantity)).not.toBe(999);
    const adj = await service().rpc('adjust_stock', { p_variant_id: variantId, p_delta: 5 });
    expect(adj.error?.message).toMatch(/USE_ROLLS/);
    const pcs = await service().rpc('adjust_stock', { p_variant_id: pcsVariantId, p_delta: 2 });
    expect(pcs.error).toBeNull();
    expect(Number(pcs.data)).toBe(7);
  });

  test('half-metre quantities are refused on piece goods', async () => {
    const o = await service().rpc('create_order_atomic', {
      p_user_id: customer.id, p_items: [{ variant_id: pcsVariantId, quantity: 1.5 }], p_shipping: SHIPPING,
      p_shipping_amount: 60, p_discount_code: null, p_idempotency_key: crypto.randomUUID(),
    });
    expect(o.error?.message).toMatch(/INVALID_QUANTITY/);
  });
});
