// Phase 2 GST detail, end to end (local stack only): a paid inter-state B2B
// order gets a tax invoice number and an IGST split; the owner's GST report
// lists it; the CSV export is admin-only; the PDF is a TAX INVOICE.
import { expect, test } from '@playwright/test';
import crypto from 'crypto';
import { appEnabled, catalogue, persona, service, SHIPPING, type Persona } from '../security-redteam/harness';
import { audit, expectClean, signIn, visit, watch } from './helpers';

const BUYER_GSTIN = '27AAPFU0939F1ZV'; // Maharashtra: inter-state from Delhi

function istMonth(d: Date) {
  return new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 7);
}

test.describe('GST detail (local stack)', () => {
  test.skip(!appEnabled, 'needs the local stack (npm run test:e2e:local)');

  let admin: Persona;
  let customer: Persona;
  let orderId: string;
  let invoiceNumber: string;
  let month: string;

  test.beforeAll(async () => {
    admin = await persona('gst-admin', { admin: true });
    customer = await persona('gst-customer');
    const cat = await catalogue('gst');
    const variantId = await cat.variant(50, 400);

    const o = await service().rpc('create_order_atomic', {
      p_user_id: customer.id,
      p_items: [{ variant_id: variantId, quantity: 2.5 }],
      p_shipping: { ...SHIPPING, city: 'Mumbai', state: 'Maharashtra', pinCode: '400001', gstin: BUYER_GSTIN },
      p_shipping_amount: 60, p_discount_code: null, p_idempotency_key: crypto.randomUUID(),
    });
    if (o.error) throw new Error(o.error.message);
    orderId = o.data as string;
    const tot = await service().from('orders').select('total_amount').eq('id', orderId).single();
    const pay = await service().rpc('record_payment', {
      p_order_id: orderId, p_provider: 'razorpay', p_provider_payment_id: `pay_gst_${crypto.randomUUID().slice(0, 12)}`,
      p_amount: Number(tot.data!.total_amount), p_status: 'captured', p_method: 'upi',
    });
    if (pay.error) throw new Error(pay.error.message);

    const row = await service()
      .from('orders')
      .select('invoice_number, invoice_date, place_of_supply, buyer_gstin, taxable_value, cgst_total, sgst_total, igst_total, tax_amount')
      .eq('id', orderId)
      .single();
    const d = row.data!;
    expect(d.invoice_number).toMatch(/^MITH\/\d{4}\/\d{6}$/);
    expect(d).toMatchObject({ place_of_supply: '27', buyer_gstin: BUYER_GSTIN });
    // 2.5 m x Rs 400 = 1000 taxable at 5% -> IGST 50, no CGST/SGST.
    expect(Number(d.taxable_value)).toBe(1000);
    expect(Number(d.igst_total)).toBe(50);
    expect(Number(d.cgst_total) + Number(d.sgst_total)).toBe(0);
    expect(Number(d.tax_amount)).toBe(50);
    invoiceNumber = d.invoice_number as string;
    month = istMonth(new Date(d.invoice_date as string));
  });

  test('GST report page renders cleanly and lists the B2B invoice', async ({ page, context }) => {
    await signIn(context, admin);
    const issues = watch(page);
    await visit(page, `/admin/reports/gst?month=${month}`, issues);
    await expect(page.getByRole('heading', { name: 'GST Liability' })).toBeVisible();
    const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: invoiceNumber, exact: true }) });
    await expect(row).toBeVisible();
    await expect(row).toContainText(BUYER_GSTIN);
    await expect(row).toContainText('27');
    const r = await audit(page, 'admin /admin/reports/gst', issues);
    expectClean('/admin/reports/gst', r, issues);
  });

  test('CSV export is admin-only and validates its inputs', async ({ context, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'runs once');
    // Signed out.
    const anon = await request.get(`/admin/reports/gst/export?month=${month}&part=b2b`, { maxRedirects: 0 });
    expect([401, 302, 307]).toContain(anon.status());

    // Signed-in customer.
    await signIn(context, customer);
    const asCustomer = await context.request.get(`/admin/reports/gst/export?month=${month}&part=b2b`, { maxRedirects: 0 });
    expect([403, 302, 307]).toContain(asCustomer.status());

    // Admin.
    await context.clearCookies();
    await signIn(context, admin);
    const bad = await context.request.get(`/admin/reports/gst/export?month=2026-13&part=b2b`);
    expect(bad.status()).toBe(400);
    const ok = await context.request.get(`/admin/reports/gst/export?month=${month}&part=b2b`);
    expect(ok.status()).toBe(200);
    expect(ok.headers()['content-type']).toContain('text/csv');
    const body = await ok.text();
    expect(body.split('\r\n')[0]).toContain('"Invoice number"');
    expect(body).toContain(`"${invoiceNumber}"`);
  });

  test('customer downloads a TAX INVOICE PDF for the paid order', async ({ context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'runs once');
    await signIn(context, customer);
    const res = await context.request.get(`/api/invoice/${orderId}`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('application/pdf');
    expect(res.headers()['content-disposition']).toContain(invoiceNumber.replace(/\//g, '-'));
    const pdf = (await res.body()).toString('latin1');
    expect(pdf.startsWith('%PDF')).toBe(true);
    // The document title (Info dictionary) carries the heading and number.
    expect(pdf).toContain(`Tax invoice ${invoiceNumber}`);

    // Another customer cannot fetch it.
    const other = await persona('gst-other');
    await context.clearCookies();
    await signIn(context, other);
    const denied = await context.request.get(`/api/invoice/${orderId}`);
    expect(denied.status()).toBe(404);
  });
});
