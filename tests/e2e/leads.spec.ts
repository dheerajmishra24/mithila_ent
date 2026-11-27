// Lead CRM end to end (local stack only).
//
// Meta's Graph API, the Conversions API, Google's OAuth token endpoint and the
// Data Manager API are faked on 127.0.0.1:3198 (the app honours *_API_BASE
// overrides only for localhost and never on Vercel). Test values only:
//   META_GRAPH_API_BASE=http://127.0.0.1:3198/graph META_PAGE_ACCESS_TOKEN=rt_page_local
//   META_PIXEL_ID=rt-pixel META_CAPI_TOKEN=rt_capi_local META_CAPI_TEST_CODE=TEST123
//   GOOGLE_OAUTH_TOKEN_URL=http://127.0.0.1:3198/oauth/token GOOGLE_DM_API_BASE=http://127.0.0.1:3198/dm
//   GOOGLE_DM_CLIENT_ID / _SECRET / _REFRESH_TOKEN, GOOGLE_ADS_CUSTOMER_ID=123-456-7890,
//   GOOGLE_ADS_QUALIFIED_ACTION_ID=111, GOOGLE_ADS_WON_ACTION_ID=222, META_APP_SECRET=rt_meta_local
import crypto from 'node:crypto';
import http from 'node:http';
import { expect, test } from '@playwright/test';
import { appEnabled, persona, service, type Persona } from '../security-redteam/harness';
import { audit, expectClean, signIn, visit, watch } from './helpers';

type Captured = { method: string; path: string; headers: http.IncomingHttpHeaders; body: string };
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

function fakeProviders(graphLeads: Record<string, unknown>) {
  const seen: Captured[] = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const path = (req.url ?? '').split('?')[0];
      seen.push({ method: req.method ?? '', path, headers: req.headers, body: raw });
      res.setHeader('content-type', 'application/json');
      const leadId = /^\/graph\/(\d+)$/.exec(path)?.[1];
      if (req.method === 'GET' && leadId && graphLeads[leadId]) return res.end(JSON.stringify(graphLeads[leadId]));
      if (path === '/graph/rt-pixel/events') return res.end(JSON.stringify({ events_received: 1, fbtrace_id: 'x' }));
      if (path === '/oauth/token') return res.end(JSON.stringify({ access_token: 'rt-access', expires_in: 3600 }));
      if (path === '/dm/events:ingest') return res.end(JSON.stringify({ requestId: crypto.randomUUID() }));
      res.statusCode = 404;
      res.end(JSON.stringify({ error: { code: 100, message: 'not found' } }));
    });
  });
  return {
    seen,
    start: () => new Promise<void>((r) => server.listen(3198, '127.0.0.1', () => r())),
    stop: () => new Promise<void>((r) => server.close(() => r())),
  };
}

test.describe('lead CRM (local stack)', () => {
  test.skip(!appEnabled, 'needs the local stack (npm run test:e2e:local)');

  let owner: Persona;
  test.beforeAll(async () => {
    owner = await persona('crm-e2e-owner', { admin: true });
  });

  test('owner lead pages render cleanly', async ({ page, context }) => {
    const { data } = await service().rpc('lead_capture', {
      p: { source: 'contact', email: `view-${crypto.randomUUID().slice(0, 8)}@example.test`, full_name: 'Render Check', message: 'Looking for 40 m of linen', utm_source: 'google', utm_campaign: 'e2e' },
    });
    await signIn(context, owner);
    const issues = watch(page);
    await visit(page, '/admin/leads', issues);
    await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible();
    expectClean('/admin/leads', await audit(page, 'admin /admin/leads', issues), issues);
    await visit(page, `/admin/leads/${data.lead_id}`, issues);
    await expect(page.getByRole('heading', { name: 'Render Check' })).toBeVisible();
    expectClean('/admin/leads/[id]', await audit(page, 'admin /admin/leads/[id]', issues), issues);
  });

  test.describe('with fake Meta and Google endpoints', () => {
    let fake: ReturnType<typeof fakeProviders>;
    const metaLeadId = String(7_000_000_000 + Math.floor(Math.random() * 1e9));

    test.beforeEach(async ({}, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop-1440', 'uses a fixed local port; runs once');
      fake = fakeProviders({
        [metaLeadId]: {
          id: metaLeadId, created_time: '2026-11-27T05:00:00+0000', form_id: '4242', ad_id: '99', campaign_id: '77',
          field_data: [
            { name: 'full_name', values: [`Kavya Rao ${metaLeadId}`] },
            { name: 'email', values: [`kavya-${metaLeadId}@example.test`] },
            { name: 'phone_number', values: [`+91 9${metaLeadId.slice(-9)}`] },
            { name: 'preferred_fabric', values: ['Chanderi'] },
          ],
        },
      });
      await fake.start();
    });
    test.afterEach(async () => {
      await fake?.stop();
    });

    test('visitor from an ad enquires with consent; owner wins it; both platforms get the conversion', async ({ page, context }) => {
      test.setTimeout(90_000);
      const email = `Visitor.${crypto.randomUUID().slice(0, 6)}@Gmail.com`;
      await page.goto('/contact?utm_source=google&utm_campaign=e2e-silk&gclid=E2E-gclid-1&fbclid=E2Efb1');
      await page.getByLabel('First Name').fill('Nisha');
      await page.getByLabel('Last Name').fill('Verma');
      await page.getByLabel('Email Address').fill(email);
      await page.getByLabel('Location / City').fill('Pune');
      await page.getByLabel('Inquiry Details').fill('60 m of mulberry silk for a boutique');
      await expect(page.getByLabel(/let Mithila tell Google and Meta/)).not.toBeChecked();
      await page.getByLabel(/let Mithila tell Google and Meta/).check();
      await page.getByRole('button', { name: 'Submit Request' }).click();
      await expect(page.getByText(/Thank you, Nisha/)).toBeVisible();

      const { data: lead } = await service().from('leads').select('id, lead_ref, gclid, fbc, utm_campaign, ad_consent').eq('email', email.toLowerCase()).single();
      expect(lead).toMatchObject({ gclid: 'E2E-gclid-1', utm_campaign: 'e2e-silk', ad_consent: true });
      expect(lead!.fbc).toMatch(/^fb\.1\.\d{13}\.E2Efb1$/);

      await signIn(context, owner);
      await page.goto(`/admin/leads?q=${lead!.lead_ref}`);
      await page.getByRole('link', { name: 'Nisha Verma' }).click();
      await page.getByLabel('Status').selectOption('won');
      await page.getByLabel('Order value (₹, when won)').fill('18,750.50');
      await page.getByLabel('Notes').fill('Paid by bank transfer');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Saved. 2 ad-platform conversions queued.')).toBeVisible();

      await expect.poll(async () => {
        const c = await service().from('lead_conversions').select('platform, status').eq('lead_id', lead!.id);
        return (c.data ?? []).map((r) => `${r.platform}:${r.status}`).sort();
      }, { timeout: 15_000 }).toEqual(['google:sent', 'meta:sent']);

      const meta = fake.seen.find((s) => s.path === '/graph/rt-pixel/events')!;
      expect(meta.headers.authorization).toBe('Bearer rt_capi_local');
      const mb = JSON.parse(meta.body);
      expect(mb.test_event_code).toBe('TEST123');
      expect(mb.data[0]).toMatchObject({ event_name: 'Purchase', action_source: 'system_generated', custom_data: { value: 18750.5, currency: 'INR' } });
      expect(mb.data[0].user_data.em).toEqual([sha(email.toLowerCase())]);
      expect(mb.data[0].user_data.fbc).toBe(lead!.fbc);
      expect(meta.body).not.toContain('Nisha');

      const dm = fake.seen.find((s) => s.path === '/dm/events:ingest')!;
      expect(dm.headers.authorization).toBe('Bearer rt-access');
      const gb = JSON.parse(dm.body);
      expect(gb.destinations[0]).toMatchObject({ operatingAccount: { accountType: 'GOOGLE_ADS', accountId: '1234567890' }, productDestinationId: '222' });
      expect(gb.events[0]).toMatchObject({ adIdentifiers: { gclid: 'E2E-gclid-1' }, conversionValue: 18750.5, currency: 'INR' });
      // Google normalisation: gmail dots removed before hashing.
      const [user, domain] = email.toLowerCase().split('@');
      expect(gb.events[0].userData.userIdentifiers[0]).toEqual({ emailAddress: sha(`${user.replace(/\./g, '')}@${domain}`) });
      expect(gb.encoding).toBe('HEX');

      await page.reload();
      await expect(page.getByText(/Meta · won: sent/)).toBeVisible();
      await expect(page.getByText(/Google · won: sent/)).toBeVisible();
    });

    test('Meta lead ad: webhook, Graph fetch, lead with answers; duplicate merged by the owner', async ({ page, context }) => {
      const body = JSON.stringify({ object: 'page', entry: [{ id: '1', time: 1, changes: [{ field: 'leadgen', value: { leadgen_id: metaLeadId, form_id: '4242', page_id: '1' } }] }] });
      const sig = 'sha256=' + crypto.createHmac('sha256', 'rt_meta_local').update(body).digest('hex');
      const res = await fetch('http://localhost:3100/api/webhooks/meta-leads', { method: 'POST', body, headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig } });
      expect(res.status).toBe(200);
      await expect.poll(async () => (await service().from('leads').select('id').eq('meta_lead_id', metaLeadId)).data?.length ?? 0, { timeout: 10_000 }).toBe(1);
      const { data: lead } = await service().from('leads').select('id, full_name, phone_e164, ad_consent').eq('meta_lead_id', metaLeadId).single();
      expect(lead).toMatchObject({ full_name: `Kavya Rao ${metaLeadId}`, phone_e164: `+919${metaLeadId.slice(-9)}`, ad_consent: true });
      expect(fake.seen.find((s) => s.path === `/graph/${metaLeadId}`)?.headers.authorization).toBe('Bearer rt_page_local');

      // Same person wrote in earlier from another address: a possible duplicate by name.
      const { data: older } = await service().rpc('lead_capture', { p: { source: 'contact', email: `kavya.other-${metaLeadId}@example.test`, full_name: `Kavya Rao ${metaLeadId}`, city: 'Mysuru' } });

      await signIn(context, owner);
      await page.goto(`/admin/leads/${lead!.id}`);
      await expect(page.getByText('Chanderi')).toBeVisible();
      page.once('dialog', (d) => d.accept());
      await page.getByRole('button', { name: /^Merge here ?: L-\d{6} into this lead$/ }).click();
      await expect(page.getByText(/^Merged L-\d{6} into this lead\.$/)).toBeVisible();
      const { data: merged } = await service().from('leads').select('merged_into').eq('id', older.lead_id).single();
      expect(merged!.merged_into).toBe(lead!.id);
      const { data: kept } = await service().from('leads').select('city').eq('id', lead!.id).single();
      expect(kept!.city).toBe('Mysuru');
    });
  });
});
