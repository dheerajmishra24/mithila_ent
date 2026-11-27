// Owner-portal two-step sign-in, end to end (local stack only).
//
// The WhatsApp and SMS paths talk to a fake provider this file runs on
// 127.0.0.1:3199. Start the app with (test values only, never real ones):
//   WHATSAPP_TOKEN=rt_wa_local WHATSAPP_PHONE_ID=rt-phone WHATSAPP_AUTH_TEMPLATE=admin_code
//   WHATSAPP_API_BASE=http://127.0.0.1:3199/wa MSG91_AUTH_KEY=rt_msg91_local
//   MSG91_OTP_TEMPLATE_ID=rt-dlt-otp SMS_API_BASE=http://127.0.0.1:3199/sms
//   OTP_PEPPER=<any 32+ chars> META_APP_SECRET=rt_meta_local
// The app honours *_API_BASE overrides only for localhost and never on Vercel.
// Message ids are unique, as real providers' are (the database treats a
// repeated provider id as the same message).
import crypto from 'node:crypto';
import http from 'node:http';
import { expect, test } from '@playwright/test';
import { appEnabled, persona, service, totp, type Persona } from '../security-redteam/harness';
import { audit, expectClean, signIn, visit, watch } from './helpers';

type Captured = { path: string; body: Record<string, unknown> };

function fakeProvider(mode: { whatsapp: 'ok' | 'fail' }) {
  const seen: Captured[] = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      seen.push({ path: req.url ?? '', body });
      res.setHeader('content-type', 'application/json');
      if (req.url?.startsWith('/wa/')) {
        if (mode.whatsapp === 'fail') {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: { code: 131000, message: 'test failure' } }));
        } else {
          res.end(JSON.stringify({ messages: [{ id: `wamid.E2E${crypto.randomUUID()}` }] }));
        }
      } else {
        res.end(JSON.stringify({ type: 'success', request_id: `sms-${crypto.randomUUID()}` }));
      }
    });
  });
  return {
    seen,
    mode,
    start: () => new Promise<void>((r) => server.listen(3199, '127.0.0.1', () => r())),
    stop: () => new Promise<void>((r) => server.close(() => r())),
  };
}

const waCode = (c: Captured) =>
  ((c.body.template as { components: { parameters: { text: string }[] }[] }).components[0].parameters[0].text);
const smsCode = (c: Captured) => (c.body.recipients as { otp: string }[])[0].otp;

test.describe('owner portal two-step sign-in (local stack)', () => {
  test.skip(!appEnabled, 'needs the local stack (npm run test:e2e:local)');

  test('password-only admin is sent to the two-step page; it renders cleanly', async ({ page, context }) => {
    const admin = await persona('2step-e2e-view', { admin: true, secondFactor: false });
    await signIn(context, admin);
    const issues = watch(page);
    await visit(page, '/admin/dashboard', issues);
    await expect(page).toHaveURL(/\/admin-verify$/);
    await expect(page.getByRole('heading', { name: 'Two-step sign-in' })).toBeVisible();
    await page.getByRole('button', { name: 'Set up an authenticator app' }).click();
    await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
    const r = await audit(page, 'admin /admin-verify setup', issues);
    expectClean('/admin-verify', r, issues);
  });

  test('first sign-in: set up an authenticator app and reach the dashboard', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'stateful flow runs once');
    const admin = await persona('2step-e2e-totp', { admin: true, secondFactor: false });
    await signIn(context, admin);
    await page.goto('/admin-verify');
    await page.getByRole('button', { name: 'Set up an authenticator app' }).click();
    const secret = (await page.locator('span.font-mono').innerText()).trim();
    await page.getByLabel('Then enter the 6-digit code it shows').fill(totp(secret));
    await page.getByRole('button', { name: 'Finish set-up' }).click();
    await page.waitForURL(/\/admin\/dashboard$/);

    // Settings shows the method; an attacker with the password alone cannot
    // set up another app (the page refuses to start a second set-up).
    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { name: 'Two-step sign-in' })).toBeVisible();
    await expect(page.getByText('Set up', { exact: true })).toBeVisible();
  });

  test.describe('codes by WhatsApp with SMS fallback', () => {
    let provider: ReturnType<typeof fakeProvider>;
    let admin: Persona;
    let phone: string; // unique per test, so a late fallback from one test cannot land in another

    test.beforeEach(async ({}, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop-1440', 'uses a fixed local port; runs once');
      provider = fakeProvider({ whatsapp: 'ok' });
      await provider.start();
      admin = await persona(`2step-e2e-otp-${testInfo.title.length}`, { admin: true, secondFactor: false });
      phone = `+9198${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
      const r = await service().from('admin_otp_phones').upsert({ user_id: admin.id, phone_e164: phone });
      if (r.error) throw new Error(r.error.message);
    });
    test.afterEach(async () => {
      await provider?.stop();
    });

    test('WhatsApp code signs in; template carries only the code', async ({ page, context }) => {
      await signIn(context, admin);
      const issues = watch(page);
      await visit(page, '/admin-verify', issues);
      await page.getByRole('button', { name: `Send a code to +91 ••••••${phone.slice(-4)}` }).click();
      await expect(page.getByLabel('Code sent by WhatsApp')).toBeVisible();
      const wa = provider.seen.find((c) => c.path === '/wa/rt-phone/messages')!;
      expect(wa.body).toMatchObject({ messaging_product: 'whatsapp', to: phone.slice(1), type: 'template', template: { name: 'admin_code' } });
      const code = waCode(wa);
      expect(code).toMatch(/^[0-9]{6}$/);
      const r = await audit(page, 'admin /admin-verify code', issues);
      expectClean('/admin-verify code', r, issues);

      await page.getByLabel('Code sent by WhatsApp').fill(code === '000000' ? '111111' : '000000');
      await page.getByRole('button', { name: 'Verify' }).click();
      await expect(page.getByText('That code is not right. 4 tries left.')).toBeVisible();
      await page.getByLabel('Code sent by WhatsApp').fill(code);
      await page.getByRole('button', { name: 'Verify' }).click();
      await page.waitForURL(/\/admin\/dashboard$/);
    });

    test('WhatsApp not delivered within 15 s: the same code arrives by SMS', async ({ page, context }) => {
      test.setTimeout(60_000);
      await signIn(context, admin);
      await page.goto('/admin-verify');
      await page.getByRole('button', { name: /Send a code to/ }).click();
      await expect(page.getByLabel('Code sent by WhatsApp')).toBeVisible();
      const code = waCode(provider.seen.find((c) => c.path.startsWith('/wa/'))!);
      await expect.poll(() => provider.seen.find((c) => c.path === '/sms/flow'), { timeout: 25_000, intervals: [1000] }).toBeTruthy();
      const sms = provider.seen.find((c) => c.path === '/sms/flow')!;
      expect(sms.body).toMatchObject({ template_id: 'rt-dlt-otp', recipients: [{ mobiles: phone.slice(1) }] });
      expect(smsCode(sms)).toBe(code);
      // The app records the SMS just after the provider answers; wait for it.
      const ch = await service().from('otp_challenges').select('id').eq('user_id', admin.id).single();
      await expect.poll(async () => {
        const d = await service().from('otp_deliveries').select('channel').eq('challenge_id', ch.data!.id).eq('channel', 'sms');
        return (d.data ?? []).length;
      }, { timeout: 5_000 }).toBe(1);
      await page.getByLabel('Code sent by WhatsApp').fill(code);
      await page.getByRole('button', { name: 'Verify' }).click();
      await page.waitForURL(/\/admin\/dashboard$/);
      const steps = await service().from('admin_step_up').select('method').eq('user_id', admin.id);
      expect(steps.data?.[0]?.method).toBe('sms');
    });

    test('WhatsApp send fails: SMS goes out straight away', async ({ page, context }) => {
      provider.mode.whatsapp = 'fail';
      await signIn(context, admin);
      await page.goto('/admin-verify');
      await page.getByRole('button', { name: /Send a code to/ }).click();
      await expect(page.getByLabel('Code sent by SMS')).toBeVisible();
      const sms = provider.seen.find((c) => c.path === '/sms/flow')!;
      await page.getByLabel('Code sent by SMS').fill(smsCode(sms));
      await page.getByRole('button', { name: 'Verify' }).click();
      await page.waitForURL(/\/admin\/dashboard$/);
    });
  });
});
