import { expect, test } from '@playwright/test';
import crypto from 'crypto';
import { appEnabled, catalogue, persona, record, service, SHIPPING, type Persona } from '../security-redteam/harness';
import { audit, expectClean, signIn, visit, watch } from './helpers';

// Playbook Step 6: customer A, customer B and the owner admin walk the real
// app (production build, local stack) on desktop 1440x900 and mobile 375x812.
// Every page visited is scanned with axe for WCAG 2.0/2.1/2.2 A and AA, and
// watched for console errors, hydration errors, uncaught exceptions and 5xx.

test.describe('fabric platform: multi-role E2E + WCAG 2.2 AA (local stack)', () => {
  test.skip(!appEnabled, 'Needs REDTEAM_* env from tests/e2e/run.mjs');

  let a: Persona;
  let b: Persona;
  let admin: Persona;
  let productSlug: string;
  let orderId: string;

  test.beforeAll(async () => {
    a = await persona('e2e-a');
    b = await persona('e2e-b');
    admin = await persona('e2e-admin', { admin: true });
    const cat = await catalogue('e2e');
    const v = await cat.variant(40, 850);
    const p = await service().from('products').select('slug').eq('id', cat.productId).single();
    productSlug = p.data!.slug as string;
    const o = await service().rpc('create_order_atomic', {
      p_user_id: a.id, p_items: [{ variant_id: v, quantity: 2 }], p_shipping: SHIPPING,
      p_shipping_amount: 60, p_discount_code: null, p_idempotency_key: crypto.randomUUID(),
    });
    if (o.error) throw new Error(o.error.message);
    orderId = o.data as string;
    const tot = await service().from('orders').select('total_amount').eq('id', orderId).single();
    const pay = await service().rpc('record_payment', {
      p_order_id: orderId, p_provider: 'razorpay', p_provider_payment_id: `pay_e2e_${crypto.randomUUID().slice(0, 12)}`,
      p_amount: Number(tot.data!.total_amount), p_status: 'captured', p_method: 'upi',
    });
    if (pay.error) throw new Error(pay.error.message);
  });

  const shortId = () => orderId.split('-')[0].toUpperCase();

  for (const path of ['/', '/shop', '/product/{slug}', '/cart', '/login', '/signup', '/contact', '/wholesale', '/blog']) {
    test(`anonymous storefront ${path}`, async ({ page }) => {
      const issues = watch(page);
      const url = path.replace('{slug}', productSlug);
      await visit(page, url, issues);
      const r = await audit(page, `anon ${path}`, issues);
      expectClean(path, r, issues);
    });
  }

  test('customer A: sees own paid order and downloads the GST invoice', async ({ page, context }) => {
    await signIn(context, a);
    const issues = watch(page);
    await visit(page, '/account/orders', issues);
    await expect(page.getByRole('heading', { name: 'Your Orders' })).toBeVisible();
    await expect(page.getByText(`ORDER #${shortId()}`)).toBeVisible();
    const link = page.getByRole('link', { name: /download gst invoice/i });
    await expect(link).toHaveAttribute('href', `/api/invoice/${orderId}`);
    const pdf = await page.request.get(`/api/invoice/${orderId}`);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
    const r = await audit(page, 'customerA /account/orders', issues);
    expectClean('/account/orders (A)', r, issues);

    await visit(page, '/account/profile', issues);
    const r2 = await audit(page, 'customerA /account/profile', issues);
    expectClean('/account/profile (A)', r2, issues);
  });

  test('customer B: never sees customer A order or invoice, and is refused the CRM', async ({ page, context }) => {
    await signIn(context, b);
    const issues = watch(page);
    await visit(page, '/account/orders', issues);
    await expect(page.getByRole('heading', { name: 'Your Orders' })).toBeVisible();
    await expect(page.getByText(`ORDER #${shortId()}`)).toHaveCount(0);
    const inv = await page.request.get(`/api/invoice/${orderId}`);
    expect(inv.status()).toBe(404);
    await page.goto('/admin/dashboard');
    expect(new URL(page.url()).pathname.startsWith('/admin/dashboard')).toBe(false);
    await page.goto(`/admin/orders/${orderId}`);
    expect(new URL(page.url()).pathname.startsWith('/admin/orders')).toBe(false);
    record(`e2e ${test.info().project.name} customerB isolation`, { invoice: inv.status(), landed_on: new URL(page.url()).pathname });
  });

  test('owner admin: CRM dashboard and order detail show customer A order', async ({ page, context }) => {
    await signIn(context, admin);
    const issues = watch(page);
    await visit(page, '/admin/dashboard', issues);
    await expect(page.getByRole('heading', { name: 'Executive Ledger' })).toBeVisible();
    const r = await audit(page, 'admin /admin/dashboard', issues);
    expectClean('/admin/dashboard', r, issues);

    await visit(page, '/admin/orders', issues);
    await expect(page.getByRole('heading', { name: /orders/i }).first()).toBeVisible();
    const r2 = await audit(page, 'admin /admin/orders', issues);
    expectClean('/admin/orders', r2, issues);

    await visit(page, `/admin/orders/${orderId}`, issues);
    await expect(page.getByText(new RegExp(shortId(), 'i')).first()).toBeVisible();
    const r3 = await audit(page, 'admin /admin/orders/[id]', issues);
    expectClean('/admin/orders/[id]', r3, issues);
  });

  test('home page layout stability and LCP (local, unthrottled)', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number; __lcp: number };
      w.__cls = 0; w.__lcp = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value; })
        .observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((l) => { const es = l.getEntries(); w.__lcp = es[es.length - 1].startTime; })
        .observe({ type: 'largest-contentful-paint', buffered: true });
    });
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForTimeout(2500); // let late shifts and the final LCP candidate land
    const m = await page.evaluate(() => {
      const w = window as unknown as { __cls: number; __lcp: number };
      return { cls: Number(w.__cls.toFixed(4)), lcp_ms: Math.round(w.__lcp) };
    });
    record(`e2e ${test.info().project.name} web_vitals_home`, m);
    expect(m.cls).toBeLessThan(0.1);
  });
});
