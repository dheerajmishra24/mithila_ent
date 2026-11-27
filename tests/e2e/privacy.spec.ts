// Privacy Centre, owner privacy queue, courier timeline and e-mail holds,
// end to end on the local stack. Test values only:
//   SHIPROCKET_WEBHOOK_TOKEN=rt_ship_token_local
//   RESEND_WEBHOOK_SECRET=whsec_ + base64('rt-resend-signing-key-local-0001')
import crypto from 'node:crypto';
import { expect, test } from '@playwright/test';
import { appEnabled, persona, service, type Persona } from '../security-redteam/harness';
import { audit, expectClean, signIn, visit, watch } from './helpers';

const RESEND_KEY = Buffer.from('rt-resend-signing-key-local-0001');

test.describe('privacy and messaging (local stack)', () => {
  test.skip(!appEnabled, 'needs the local stack (npm run test:e2e:local)');

  let owner: Persona;
  test.beforeAll(async () => {
    owner = await persona('privacy-e2e-owner', { admin: true });
  });

  test('customer: choices, data download and a deletion request; owner erases the account', async ({ page, context, browser }, testInfo) => {
    test.setTimeout(90_000);
    const customer = await persona(`privacy-e2e-${testInfo.project.name}-${crypto.randomUUID().slice(0, 6)}`);
    await signIn(context, customer);
    const issues = watch(page);
    await visit(page, '/account/privacy', issues);
    await expect(page.getByRole('heading', { name: 'Privacy Centre' })).toBeVisible();
    expectClean('/account/privacy', await audit(page, 'account /account/privacy', issues), issues);

    // Every purpose starts off; each is saved on its own.
    const email = page.getByRole('switch', { name: 'Offers and new arrivals by e-mail' });
    const ads = page.getByRole('switch', { name: 'Ad measurement with Google and Meta' });
    await expect(email).toHaveAttribute('aria-checked', 'false');
    await expect(ads).toHaveAttribute('aria-checked', 'false');
    await email.click();
    await expect(page.getByRole('switch', { name: 'Offers and new arrivals by e-mail' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('switch', { name: 'Ad measurement with Google and Meta' })).toHaveAttribute('aria-checked', 'false');
    const { data: ledger } = await service().from('consent_events').select('purpose, granted, notice_version').eq('user_id', customer.id);
    expect(ledger).toEqual([{ purpose: 'marketing_email', granted: true, notice_version: '2026-11' }]);

    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download (JSON)' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^mithila-my-data-\d{4}-\d{2}-\d{2}\.json$/);
    const exported = JSON.parse(await (await import('node:fs/promises')).readFile((await file.path())!, 'utf8'));
    expect(exported.account.email).toBe(customer.email);
    expect(exported.consent_history).toHaveLength(1);

    // Deletion needs the explicit confirmation box.
    await page.getByLabel('Delete my account and personal data').check();
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByText('Please tick the box to confirm you want your account deleted.')).toBeVisible();
    // A refused request keeps the customer's choice.
    await expect(page.getByLabel('Delete my account and personal data')).toBeChecked();
    await page.getByLabel('I understand and want my account deleted').check();
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByText(/^Request PR-\d{6} received\./)).toBeVisible();
    const { data: req } = await service().from('privacy_requests').select('id, ref').eq('user_id', customer.id).eq('kind', 'erasure').single();

    if (testInfo.project.name !== 'desktop-1440') return; // owner flow once
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await signIn(ownerContext, owner);
    const ownerIssues = watch(ownerPage);
    await visit(ownerPage, '/admin/privacy', ownerIssues);
    await expect(ownerPage.getByRole('heading', { name: 'Privacy', exact: true })).toBeVisible();
    expectClean('/admin/privacy', await audit(ownerPage, 'admin /admin/privacy', ownerIssues), ownerIssues);
    const item = ownerPage.getByRole('listitem').filter({ hasText: req!.ref });
    await item.getByLabel('Type ERASE to confirm').fill('ERASE');
    await item.getByRole('button', { name: `Erase now for ${req!.ref}` }).click();
    await expect(ownerPage.getByRole('status').filter({ hasText: /^Erased\. The account is deleted/ })).toBeVisible();
    await expect(ownerPage.getByRole('listitem').filter({ hasText: req!.ref })).toHaveCount(0);
    const { data: gone } = await service().auth.admin.getUserById(customer.id);
    expect(gone.user).toBeNull();
    const { data: closed } = await service().from('privacy_requests').select('status, user_id, contact_email').eq('id', req!.id).single();
    expect(closed).toEqual({ status: 'completed', user_id: null, contact_email: null });
    await ownerContext.close();
  });

  test('courier updates reach the customer\'s order page; a bounce shows on the owner\'s hold list', async ({ page, context, browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'posts fixed test data; runs once');
    const customer = await persona('privacy-e2e-ship');
    const awb = `E2E${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { data: order } = await service().from('orders').insert({
      user_id: customer.id, status: 'paid', is_paid: true, subtotal: 1000, total_amount: 1050,
      shipping_address: { firstName: 'Ship', email: customer.email, address1: '1 Road', city: 'Pune', state: 'Maharashtra', pinCode: '411001' },
    }).select('id').single();
    const res = await fetch('http://localhost:3100/api/webhooks/courier', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': 'rt_ship_token_local' },
      body: JSON.stringify({
        awb, courier_name: 'Delhivery Surface', current_status: 'OUT FOR DELIVERY', current_timestamp: '27 11 2026 09:30:00',
        order_id: order!.id.split('-')[0].toUpperCase(), etd: '2026-11-28 18:00:00', is_return: 0,
        scans: [
          { date: '2026-11-26 17:00:00', 'sr-status-label': 'PICKED UP', activity: 'Shipment picked up', location: 'Delhi' },
          { date: '2026-11-27 09:30:00', 'sr-status-label': 'OUT FOR DELIVERY', activity: 'Out for delivery', location: 'Pune' },
        ],
      }),
    });
    expect(res.status).toBe(200);

    await signIn(context, customer);
    const issues = watch(page);
    await visit(page, '/account/orders', issues);
    const card = page.getByRole('region', { name: `Courier updates for order ${order!.id.split('-')[0].toUpperCase()}` });
    await expect(card.getByText('OUT FOR DELIVERY', { exact: true }).first()).toBeVisible();
    await expect(card.getByText(/Shipment picked up/)).toBeVisible();
    await expect(card.getByText(/Expected by/)).toBeVisible();
    await expect(page.getByText(`Delhivery Surface · AWB ${awb}`)).toBeVisible();
    expectClean('/account/orders', await audit(page, 'account /account/orders', issues), issues);
    const { data: o } = await service().from('orders').select('status').eq('id', order!.id).single();
    expect(o!.status).toBe('shipped');

    const victim = `hold-${crypto.randomUUID().slice(0, 6)}@example.test`;
    const id = `msg_e2e_${crypto.randomUUID().slice(0, 8)}`;
    const ts = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ type: 'email.complained', created_at: new Date().toISOString(), data: { email_id: 'em_e2e', to: [victim] } });
    const sig = `v1,${crypto.createHmac('sha256', RESEND_KEY).update(`${id}.${ts}.${body}`).digest('base64')}`;
    expect((await fetch('http://localhost:3100/api/webhooks/email', { method: 'POST', body, headers: { 'content-type': 'application/json', 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': sig } })).status).toBe(200);

    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await signIn(ownerContext, owner);
    await ownerPage.goto('/admin/privacy');
    const row = ownerPage.getByRole('row').filter({ hasText: victim });
    await expect(row.getByText('Marked as spam')).toBeVisible();
    await row.getByRole('button', { name: `Allow again for ${victim}` }).click();
    await expect(ownerPage.getByRole('status').filter({ hasText: `${victim} can receive e-mail again.` })).toBeVisible();
    await expect(ownerPage.getByRole('row').filter({ hasText: victim })).toHaveCount(0);
    expect((await service().from('email_suppressions').select('email').eq('email', victim)).data).toHaveLength(0);
    await ownerContext.close();
  });
});
