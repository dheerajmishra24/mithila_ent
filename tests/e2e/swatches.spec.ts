// Phase 4 swatches, end to end (local stack only): pick a swatch on a product
// page, place the kit through /swatches, pay it, see the credit on the
// customer dashboard, and see it offered at checkout. Pages are axe-audited.
import { expect, test } from '@playwright/test';
import crypto from 'crypto';
import { appEnabled, catalogue, persona, service, type Persona } from '../security-redteam/harness';
import { audit, expectClean, signIn, visit, watch } from './helpers';

test.describe('swatch kits and credit (local stack)', () => {
  test.skip(!appEnabled, 'needs the local stack (npm run test:e2e:local)');

  let customer: Persona;
  let admin: Persona;
  let slug: string;
  let variantId: string;

  test.beforeAll(async () => {
    customer = await persona('swatch-e2e');
    admin = await persona('swatch-e2e-admin', { admin: true });
    const cat = await catalogue('swe2e');
    variantId = await cat.variant(40, 450);
    const p = await service().from('products').select('slug').eq('id', cat.productId).single();
    slug = p.data!.slug as string;
  });

  test('anonymous shopper builds a kit; pages render cleanly', async ({ page }) => {
    const issues = watch(page);
    await visit(page, `/product/${slug}`, issues);
    // Regression: the page used to 404 for every product (ambiguous categories embed).
    await expect(page.getByRole('heading', { level: 1, name: /RT swe2e/i })).toBeVisible();
    await page.getByRole('button', { name: 'Add Indigo swatch to kit' }).click();
    await expect(page.getByRole('button', { name: 'Remove Indigo swatch' })).toHaveAttribute('aria-pressed', 'true');
    const r1 = await audit(page, 'anon /product (swatch)', issues);
    expectClean('/product swatch', r1, issues);

    await page.getByRole('link', { name: /View swatch kit \(1\/5\)/ }).click();
    await expect(page.getByRole('heading', { name: 'Your Swatch Kit' })).toBeVisible();
    await expect(page.getByText('1 of 5 swatches')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    const r2 = await audit(page, 'anon /swatches', issues);
    expectClean('/swatches', r2, issues);
  });

  test('signed-in customer orders a kit, earns credit and sees it at checkout', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'stateful flow runs once');
    await signIn(context, customer);
    const issues = watch(page);

    await page.goto(`/product/${slug}`);
    await page.getByRole('button', { name: 'Add Indigo swatch to kit' }).click();
    await page.goto('/swatches');
    await page.getByLabel('First name').fill('Swatch');
    await page.getByLabel('Last name').fill('Tester');
    await page.getByLabel('Address', { exact: true }).fill('1 Test Road');
    await page.getByLabel('City').fill('Pune');
    await page.getByLabel('PIN code').fill('411001');
    await page.getByLabel('State').selectOption('Maharashtra');
    const r = await audit(page, 'customer /swatches form', issues);
    expectClean('/swatches form', r, issues);
    await page.getByRole('button', { name: /Pay ₹99\.00 for the kit/ }).click();
    await page.waitForURL(/\/checkout\/success\?orderId=/);
    const orderId = new URL(page.url()).searchParams.get('orderId')!;

    const kit = await service().from('orders').select('order_kind, total_amount, igst_total, user_id').eq('id', orderId).single();
    expect(kit.data).toMatchObject({ order_kind: 'swatch', user_id: customer.id });
    expect(Number(kit.data!.total_amount)).toBe(99);
    expect(Number(kit.data!.igst_total)).toBe(4.71);

    // Payment arrives (as the verify route / webhook would record it).
    const pay = await service().rpc('record_payment', {
      p_order_id: orderId, p_provider: 'razorpay', p_provider_payment_id: `pay_e2e_${crypto.randomUUID().slice(0, 10)}`,
      p_amount: 99, p_status: 'captured', p_method: 'upi',
    });
    if (pay.error) throw new Error(pay.error.message);

    await visit(page, '/account/credit', issues);
    await expect(page.getByText('₹99.00').first()).toBeVisible();
    await expect(page.getByRole('cell', { name: /Swatch kit paid/ })).toBeVisible();
    const r3 = await audit(page, 'customer /account/credit', issues);
    expectClean('/account/credit', r3, issues);

    // A metre-fabric cart offers the credit at checkout.
    await page.evaluate((id) => {
      localStorage.setItem('mithila-cart-storage', JSON.stringify({
        state: { items: [{ id, product_id: 'x', title: 'Fabric', color: 'Indigo', price: 450, quantity: 2, min_order_quantity: 0.5, image: '', unit: 'MTR', max_cut_m: 40 }], isOpen: false },
        version: 0,
      }));
    }, variantId);
    await page.goto('/checkout');
    await expect(page.getByLabel(/Use my swatch credit \(₹99\.00 available\)/)).toBeChecked();
    await expect(page.getByText('To pay now')).toBeVisible();
  });

  test('owner sees balances and can adjust credit', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'runs once');
    await signIn(context, admin);
    const issues = watch(page);
    await visit(page, '/admin/customers', issues);
    await expect(page.getByRole('heading', { name: 'Adjust swatch credit' })).toBeVisible();
    const r = await audit(page, 'admin /admin/customers', issues);
    expectClean('/admin/customers', r, issues);
    await visit(page, '/admin/settings', issues);
    await expect(page.getByLabel('Kit price (₹)')).toHaveValue('99');
    const r2 = await audit(page, 'admin /admin/settings', issues);
    expectClean('/admin/settings', r2, issues);
  });
});
