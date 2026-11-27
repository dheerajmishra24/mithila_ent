import crypto from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { APP_URL, appEnabled, dbEnabled, persona, race, record, service, sessionCookie, type Persona } from './harness';

// Phase 7 (migration 0055) under attack: forged and replayed courier and
// e-mail webhooks, a customer reading or erasing someone else's data, and
// the data download leaking across accounts.

const SHIP_TOKEN = process.env.REDTEAM_SHIPROCKET_TOKEN ?? 'rt_ship_token_local';
const RESEND_KEY = Buffer.from(process.env.REDTEAM_RESEND_KEY ?? 'rt-resend-signing-key-local-0001');
const tag = () => crypto.randomUUID().slice(0, 8);

describe.skipIf(!dbEnabled)('red-team: privacy and messaging (local stack)', () => {
  let alice: Persona;
  let bob: Persona;
  let owner: Persona;

  beforeAll(async () => {
    alice = await persona('pm-alice');
    bob = await persona('pm-bob');
    owner = await persona('pm-owner', { admin: true });
  }, 60_000);

  it('a customer cannot erase, close or read anyone else\'s request', async () => {
    const { data: req, error } = await alice.client.rpc('privacy_request_create', { p_kind: 'grievance', p_details: `rt ${tag()}` });
    expect(error).toBeNull();
    expect((await bob.client.from('privacy_requests').select('id').eq('id', req.id)).data ?? []).toHaveLength(0);
    expect((await bob.client.rpc('privacy_request_withdraw', { p_id: req.id })).error).not.toBeNull();
    expect((await bob.client.rpc('privacy_request_update', { p_id: req.id, p_status: 'rejected', p_resolution: 'nope nope' })).error).not.toBeNull();
    expect((await bob.client.rpc('privacy_erase', { p_request: req.id })).error).not.toBeNull();
    expect((await bob.client.from('privacy_requests').update({ status: 'completed' }).eq('id', req.id).select('id')).data ?? []).toHaveLength(0);
    expect((await owner.client.from('privacy_requests').select('id').eq('id', req.id)).data).toHaveLength(1);
  });

  it('consent can only be written for yourself, through the function', async () => {
    expect((await alice.client.from('consent_events').insert({ user_id: bob.id, purpose: 'marketing_email', granted: true, notice_version: 'x', source: 'privacy_centre' })).error).not.toBeNull();
    const burst = await race(10, () => alice.client.rpc('consent_set', { p_purpose: 'marketing_whatsapp', p_granted: true, p_notice_version: '2026-11' }));
    const { data } = await service().from('consent_events').select('id').eq('user_id', alice.id).eq('purpose', 'marketing_whatsapp');
    record('privacy.consent_race', { histogram: burst.histogram, rows: data?.length });
    expect(data).toHaveLength(1); // ten identical clicks, one ledger row
  });

  describe.skipIf(!appEnabled)('over HTTP (local app)', () => {
    it('courier webhook: token required, forged bodies ignored, customers only see their own scans', async () => {
      const awb = `RT${tag().toUpperCase()}`;
      const { data: order } = await service().from('orders').insert({
        user_id: alice.id, status: 'paid', is_paid: true, subtotal: 100, total_amount: 105,
        shipping_address: { firstName: 'Alice', address1: '1 Road', city: 'Pune', state: 'Maharashtra', pinCode: '411001' },
      }).select('id').single();
      const body = JSON.stringify({ awb, courier_name: 'Delhivery', current_status: 'IN TRANSIT', current_timestamp: '27 11 2026 10:00:00', order_id: order!.id, scans: [{ date: '2026-11-27 09:00:00', 'sr-status-label': 'PICKED UP', activity: 'Picked up' }], is_return: 0 });
      const post = (b: string, key?: string) => fetch(APP_URL + '/api/webhooks/courier', { method: 'POST', body: b, headers: { 'content-type': 'application/json', ...(key ? { 'x-api-key': key } : {}) } });

      expect((await post(body)).status).toBe(401);
      expect((await post(body, 'guess')).status).toBe(401);
      const ignored = await post(JSON.stringify({ awb: "1' OR '1'='1", current_status: 'DELIVERED' }), SHIP_TOKEN);
      expect(ignored.status).toBe(200);
      expect(await ignored.json()).toEqual({ ok: true, ignored: true });

      const burst = await Promise.all(Array.from({ length: 10 }, () => post(body, SHIP_TOKEN)));
      expect(burst.every((r) => r.status === 200)).toBe(true);
      const { data: o } = await service().from('orders').select('status, awb_code, shipment_status').eq('id', order!.id).single();
      expect(o).toMatchObject({ status: 'shipped', awb_code: awb, shipment_status: 'IN TRANSIT' });
      const { data: scans } = await service().from('shipment_events').select('id').eq('awb_code', awb);
      expect(scans).toHaveLength(2); // ten deliveries, stored once

      expect((await alice.client.from('shipment_events').select('id').eq('awb_code', awb)).data).toHaveLength(2);
      expect((await bob.client.from('shipment_events').select('id').eq('awb_code', awb)).data ?? []).toHaveLength(0);
    });

    it('e-mail webhook: signature over the raw body, replays harmless, bounce stops the queue', async () => {
      const victim = `bounce-${tag()}@example.test`;
      const id = `msg_rt_${tag()}`;
      const body = JSON.stringify({ type: 'email.bounced', created_at: new Date().toISOString(), data: { email_id: 'em_rt', to: [victim], bounce: { type: 'Permanent', subType: 'General', message: '550' } } });
      const ts = Math.floor(Date.now() / 1000);
      const sig = (b: string, k = RESEND_KEY, t = ts, i = id) => `v1,${crypto.createHmac('sha256', k).update(`${i}.${t}.${b}`).digest('base64')}`;
      const post = (b: string, h: Record<string, string>) => fetch(APP_URL + '/api/webhooks/email', { method: 'POST', body: b, headers: { 'content-type': 'application/json', ...h } });

      expect((await post(body, {})).status).toBe(401);
      expect((await post(body, { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': sig(body, Buffer.from('guessed-key-xxxxxxxxxxxxxxxxxxxx')) })).status).toBe(401);
      expect((await post(body.replace(victim, 'someone@example.test'), { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': sig(body) })).status).toBe(401);
      expect((await post(body, { 'svix-id': id, 'svix-timestamp': String(ts - 900), 'svix-signature': sig(body, RESEND_KEY, ts - 900) })).status).toBe(401);
      for (let i = 0; i < 3; i++) {
        expect((await post(body, { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': sig(body) })).status).toBe(200);
      }
      expect((await service().from('email_webhook_events').select('message_id').eq('message_id', id)).data).toHaveLength(1);
      expect((await service().from('email_suppressions').select('reason').eq('email', victim).single()).data).toEqual({ reason: 'bounce' });
    });

    it('data download: signed-in only, never another person\'s data, never cached', async () => {
      const anon = await fetch(APP_URL + '/account/privacy/export', { redirect: 'manual' });
      // The routing proxy redirects first (307); the route itself would 303.
      expect([303, 307]).toContain(anon.status);
      expect(anon.headers.get('location')).toMatch(/\/login(\?|$)/);
      expect(await anon.text()).not.toContain('"account"');

      const res = await fetch(APP_URL + '/account/privacy/export', { headers: { cookie: sessionCookie(alice) } });
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toContain('no-store');
      expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="mithila-my-data-\d{4}-\d{2}-\d{2}\.json"$/);
      const text = await res.text();
      const json = JSON.parse(text);
      expect(json.account.email).toBe(alice.email);
      expect(text).not.toContain(bob.email);
      expect(text).not.toContain(owner.email);
    });

    it('owner privacy page is closed to customers', async () => {
      const res = await fetch(APP_URL + '/admin/privacy', { redirect: 'manual', headers: { cookie: sessionCookie(alice) } });
      expect(res.status).toBeGreaterThanOrEqual(300);
      expect(res.status).toBeLessThan(400);
      expect(await res.text()).not.toContain('E-mail addresses on hold');
    });
  });
});
