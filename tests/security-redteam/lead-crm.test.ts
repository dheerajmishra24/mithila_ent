import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { ANON_KEY, APP_URL, appEnabled, dbEnabled, persona, race, record, service, sessionCookie, SUPABASE_URL, type Persona } from './harness';

// Lead CRM (migration 0054) under attack: forged webhooks, replays, races on
// the dedupe path, readers without admin rights, consent bypass through the
// public form, and the CSV export.

const META_SECRET = process.env.REDTEAM_META_APP_SECRET ?? 'rt_meta_local';
const GOOGLE_KEY = process.env.REDTEAM_GOOGLE_LEADS_KEY ?? 'rt_google_key_local';
const LEADS_VERIFY = process.env.REDTEAM_META_LEADS_VERIFY_TOKEN ?? 'rt_leads_verify_local';
const tag = () => crypto.randomUUID().slice(0, 8);

describe.skipIf(!dbEnabled)('red-team: lead CRM (local stack)', () => {
  let customer: Persona;
  let owner: Persona;
  let ownerNo2fa: Persona;

  beforeAll(async () => {
    customer = await persona('crm-cust');
    owner = await persona('crm-owner', { admin: true });
    ownerNo2fa = await persona('crm-owner-pw', { admin: true, secondFactor: false });
  }, 60_000);

  it('twenty parallel captures for one e-mail make one lead', async () => {
    const email = `race-${tag()}@example.test`;
    const burst = await race(20, (i) => service().rpc('lead_capture', { p: { source: 'contact', email, message: `try ${i}` } }));
    const leads = await service().from('leads').select('id').eq('email', email);
    const events = await service().from('lead_events').select('id').in('lead_id', (leads.data ?? []).map((l) => l.id));
    record('crm.capture_race', { histogram: burst.histogram, leads: leads.data?.length, events: events.data?.length });
    expect(leads.data).toHaveLength(1);
    expect(events.data).toHaveLength(20);
  });

  it('twenty parallel deliveries of one webhook lead make one history row', async () => {
    const ext = `g-race-${tag()}`;
    await race(20, () => service().rpc('lead_capture', { p: { source: 'google', external_id: ext, email: `${ext}@example.test` } }));
    const ev = await service().from('lead_events').select('id').eq('source', 'google').eq('external_id', ext);
    expect(ev.data).toHaveLength(1);
  });

  it('only a two-step-verified owner can read or change leads', async () => {
    const { data: l } = await service().rpc('lead_capture', { p: { source: 'contact', email: `rd-${tag()}@example.test` } });
    for (const p of [customer, ownerNo2fa]) {
      expect((await p.client.from('leads').select('id').eq('id', l.lead_id)).data ?? []).toHaveLength(0);
      expect((await p.client.rpc('lead_update', { p_lead: l.lead_id, p_status: 'spam', p_value_paise: null, p_notes: null })).error).not.toBeNull();
      expect((await p.client.from('leads').update({ status: 'spam' }).eq('id', l.lead_id).select('id')).data ?? []).toHaveLength(0);
      expect((await p.client.from('lead_conversions').insert({ lead_id: l.lead_id, platform: 'meta', stage: 'won' })).error).not.toBeNull();
    }
    expect((await owner.client.from('leads').select('id').eq('id', l.lead_id)).data).toHaveLength(1);
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    expect((await anon.rpc('lead_capture', { p: { source: 'contact', email: 'x@example.test' } })).error).not.toBeNull();
    expect((await customer.client.rpc('lead_capture', { p: { source: 'contact', email: 'x@example.test' } })).error).not.toBeNull();
  });

  describe.skipIf(!appEnabled)('over HTTP (local app)', () => {
    const sign = (b: string | Buffer, k = META_SECRET) => 'sha256=' + crypto.createHmac('sha256', k).update(b).digest('hex');

    it('Meta leads webhook: raw-body signature, handshake token, replay-safe', async () => {
      const id = String(9_000_000_000 + Math.floor(Math.random() * 1e9));
      const body = JSON.stringify({ object: 'page', entry: [{ changes: [{ field: 'leadgen', value: { leadgen_id: id, form_id: '777', page_id: '1' } }] }] });
      const post = (sig: string | null, b = body) =>
        fetch(APP_URL + '/api/webhooks/meta-leads', { method: 'POST', body: b, headers: { 'content-type': 'application/json', ...(sig ? { 'x-hub-signature-256': sig } : {}) } });
      expect((await post(null)).status).toBe(401);
      expect((await post(sign(body, 'wrong'))).status).toBe(401);
      expect((await post(sign(body), body.replace('777', '778'))).status).toBe(401);
      expect((await post(sign(body))).status).toBe(200);
      expect((await post(sign(body))).status).toBe(200); // Meta redelivers
      const inbox = await service().from('lead_inbox').select('id').eq('external_id', id);
      expect(inbox.data).toHaveLength(1);
      expect((await fetch(APP_URL + '/api/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=abc')).status).toBe(403);
      const ok = await fetch(APP_URL + `/api/webhooks/meta-leads?hub.mode=subscribe&hub.verify_token=${LEADS_VERIFY}&hub.challenge=c123`);
      expect(await ok.text()).toBe('c123');
    });

    it('Google leads webhook: key checked, test leads kept apart, replay-safe', async () => {
      const leadId = `RT-${tag()}`;
      const lead = (key: string | undefined, extra: Record<string, unknown> = {}) => JSON.stringify({
        lead_id: leadId, api_version: '1.0', form_id: 1, campaign_id: 2, google_key: key, is_test: true, gcl_id: 'RT-gclid',
        user_column_data: [{ column_id: 'EMAIL', string_value: `${leadId}@example.test`, column_name: 'Email' }], ...extra,
      });
      const post = (b: string) => fetch(APP_URL + '/api/webhooks/google-leads', { method: 'POST', body: b, headers: { 'content-type': 'application/json' } });
      expect((await post(lead(undefined))).status).toBe(401);
      expect((await post(lead('wrong'))).status).toBe(401);
      expect((await post(JSON.stringify({ hello: 'world' }))).status).toBe(400);
      expect((await post('not json')).status).toBe(400);
      const good = await post(lead(GOOGLE_KEY));
      expect(good.status).toBe(200);
      expect(await good.json()).toEqual({});
      expect((await post(lead(GOOGLE_KEY))).status).toBe(200);
      const rows = await service().from('leads').select('id, is_test, gclid, ad_consent').eq('google_lead_id', leadId);
      expect(rows.data).toHaveLength(1);
      expect(rows.data?.[0]).toMatchObject({ is_test: true, gclid: 'RT-gclid', ad_consent: true });
    });

    it('contact form: click ids need the separate consent box; text stays text', async () => {
      const send = (email: string, adConsent: unknown) =>
        fetch(APP_URL + '/api/contact', {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: '_fbp=fb.1.1700000000000.42' },
          body: JSON.stringify({
            firstName: '=HYPERLINK("http://evil")', lastName: 'Test', email, location: 'Delhi', message: 'need silk',
            adConsent, submissionId: crypto.randomUUID(),
            attribution: { utm_source: 'google', utm_campaign: 'rt', gclid: 'RT-click-1', fbclid: 'IwRT' },
          }),
        });
      const a = `nc-${tag()}@example.test`;
      const b = `yc-${tag()}@example.test`;
      expect((await send(a, 'true')).status).toBe(200); // a string is not consent
      expect((await send(b, true)).status).toBe(200);
      const { data } = await service().from('leads').select('email, full_name, utm_campaign, gclid, fbclid, fbp, fbc, ad_consent').in('email', [a, b]);
      const byEmail = Object.fromEntries((data ?? []).map((r) => [r.email, r]));
      expect(byEmail[a]).toMatchObject({ utm_campaign: 'rt', gclid: null, fbclid: null, fbp: null, fbc: null, ad_consent: false });
      expect(byEmail[b]).toMatchObject({ utm_campaign: 'rt', gclid: 'RT-click-1', fbclid: 'IwRT', fbp: 'fb.1.1700000000000.42', ad_consent: true });
      expect(byEmail[b].fbc).toMatch(/^fb\.1\.\d{13}\.IwRT$/);
      expect(byEmail[a].full_name).toBe('=HYPERLINK("http://evil") Test');
    });

    it('CSV export: owner only, formulas neutralised, no click ids', async () => {
      const nameTag = tag();
      await service().rpc('lead_capture', { p: { source: 'contact', email: `csv-${nameTag}@example.test`, full_name: `=cmd|' /C calc'!A0 ${nameTag}`, ad_consent: true, gclid: `SECRET-CLICK-${nameTag}` } });
      const get = (cookie?: string) => fetch(APP_URL + `/admin/leads/export?q=${nameTag}`, { redirect: 'manual', headers: cookie ? { cookie } : {} });
      expect((await get()).status).toBeGreaterThanOrEqual(300);
      expect((await get(sessionCookie(customer))).status).toBeGreaterThanOrEqual(300);
      expect((await get(sessionCookie(ownerNo2fa))).status).toBeGreaterThanOrEqual(300);
      const res = await get(sessionCookie(owner));
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      expect(res.headers.get('cache-control')).toContain('no-store');
      const text = await res.text();
      expect(text).toContain(`"\t=cmd|' /C calc'!A0 ${nameTag}"`);
      expect(text).not.toContain('SECRET-CLICK');
    });

    it('leads cron needs the cron secret', async () => {
      expect((await fetch(APP_URL + '/api/cron/leads')).status).toBe(401);
      expect((await fetch(APP_URL + '/api/cron/leads', { headers: { authorization: 'Bearer nope' } })).status).toBe(401);
    });
  });
});
