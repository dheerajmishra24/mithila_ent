import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normaliseShiprocketPayload, parseShiprocketTime } from '@/lib/courier/shiprocket';

// Phase 7: courier webhook parsing and auth, Resend webhook signature and
// bounce handling. Database calls are mocked; the SQL side is covered by
// supabase/tests/18_privacy_messaging_test.sql.

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  result: { data: { matched: true, order_id: '0b6f8d3e-1c2a-4f5b-9a7e-2d4c6b8a0f11', status_to: 'shipped', problem: false } as unknown, error: null as null | { message: string } },
  notify: vi.fn(),
  alert: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => fn() }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async (name: string, args: unknown) => {
      state.rpc(name, args);
      return state.result;
    },
  }),
}));
vi.mock('@/lib/orders/notify', () => ({ notifyOrderStatus: state.notify }));
vi.mock('@/lib/email', () => ({ sendOwnerAlertEmail: state.alert }));

// Documented Shiprocket sample (apidocs.shiprocket.in, "Webhooks"), trimmed.
const SAMPLE = {
  awb: '19041424751540',
  courier_name: 'Delhivery Surface',
  current_status: 'IN TRANSIT',
  current_status_id: 20,
  shipment_status: 'IN TRANSIT',
  shipment_status_id: 18,
  current_timestamp: '23 05 2023 11:43:52',
  order_id: '1373900_150876814',
  sr_order_id: 348456385,
  etd: '2023-05-23 15:40:19',
  scans: [
    { date: '2023-05-19 11:59:16', status: 'X-UCI', activity: 'Manifested - Manifest uploaded', location: 'Chomu_SamodRd_D (Rajasthan)', 'sr-status': '5', 'sr-status-label': 'MANIFEST GENERATED' },
    { date: '2023-05-19 15:32:17', status: 'X-PPOM', activity: 'In Transit - Shipment picked up', location: 'Chomu_SamodRd_D (Rajasthan)', 'sr-status': '42', 'sr-status-label': 'PICKED UP' },
  ],
  is_return: 0,
};

describe('Shiprocket payload', () => {
  it('reads both documented time formats as Indian time', () => {
    expect(parseShiprocketTime('23 05 2023 11:43:52')).toBe('2023-05-23T11:43:52+05:30');
    expect(parseShiprocketTime('2023-05-19 11:59:16')).toBe('2023-05-19T11:59:16+05:30');
    expect(Date.parse(parseShiprocketTime('2023-05-19 11:59:16')!)).toBe(Date.parse('2023-05-19T06:29:16Z'));
  });
  it('rejects impossible or malformed times', () => {
    for (const bad of ['31 02 2026 10:00:00', '2026-13-01 10:00:00', '2026-01-01 25:00:00', 'yesterday', '', null, 42]) {
      expect(parseShiprocketTime(bad)).toBeNull();
    }
  });
  it('normalises the documented sample', () => {
    const n = normaliseShiprocketPayload(SAMPLE)!;
    expect(n).toMatchObject({
      awb: '19041424751540',
      courier_name: 'Delhivery Surface',
      status_label: 'IN TRANSIT',
      status_at: '2023-05-23T11:43:52+05:30',
      etd: '2023-05-23T15:40:19+05:30',
      is_return: false,
      order_ref: '1373900_150876814',
    });
    expect(n.scans).toEqual([
      { at: '2023-05-19T11:59:16+05:30', label: 'MANIFEST GENERATED', activity: 'Manifested - Manifest uploaded', location: 'Chomu_SamodRd_D (Rajasthan)' },
      { at: '2023-05-19T15:32:17+05:30', label: 'PICKED UP', activity: 'In Transit - Shipment picked up', location: 'Chomu_SamodRd_D (Rajasthan)' },
    ]);
  });
  it('strips markup and refuses bodies without a usable AWB', () => {
    const n = normaliseShiprocketPayload({ ...SAMPLE, courier_name: '<img src=x onerror=alert(1)>Blue Dart', scans: [{ date: '2023-05-19 11:59:16', 'sr-status-label': '<b>SHIPPED</b>', activity: '<script>x</script>ok' }] })!;
    expect(n.courier_name).toBe('Blue Dart');
    expect(n.scans[0]).toMatchObject({ label: 'SHIPPED', activity: 'x ok' });
    for (const bad of [null, [], 'x', {}, { awb: 'AB' }, { awb: "1' OR '1'='1" }, { awb: 'x'.repeat(41) }]) {
      expect(normaliseShiprocketPayload(bad)).toBeNull();
    }
  });
  it('keeps returns apart and caps the scan list', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ date: `2023-05-19 10:${String(i % 60).padStart(2, '0')}:00`, 'sr-status-label': 'IN TRANSIT' }));
    const n = normaliseShiprocketPayload({ ...SAMPLE, is_return: 1, scans: many })!;
    expect(n.is_return).toBe(true);
    expect(n.scans.length).toBe(200);
  });
});

describe('courier webhook route', () => {
  const post = async (body: unknown, token: string | null = 'ship_token') => {
    const { POST } = await import('@/app/api/webhooks/courier/route');
    return POST(new Request('http://localhost/api/webhooks/courier', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { 'x-api-key': token } : {}) },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }));
  };
  beforeEach(() => {
    process.env.SHIPROCKET_WEBHOOK_TOKEN = 'ship_token';
    state.rpc.mockReset();
    state.notify.mockReset();
    state.alert.mockReset();
    state.result = { data: { matched: true, order_id: '0b6f8d3e-1c2a-4f5b-9a7e-2d4c6b8a0f11', status_to: 'shipped', problem: false }, error: null };
  });

  it('rejects a missing or wrong token, and everything when no token is configured', async () => {
    expect((await post(SAMPLE, null)).status).toBe(401);
    expect((await post(SAMPLE, 'wrong')).status).toBe(401);
    delete process.env.SHIPROCKET_WEBHOOK_TOKEN;
    expect((await post(SAMPLE, 'ship_token')).status).toBe(401);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('answers 200 to an authenticated body it cannot use, without touching the database', async () => {
    const res = await post('{"test":true}');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ignored: true });
    expect((await post('not json')).status).toBe(200);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('records the update and e-mails the customer when the order moves', async () => {
    const res = await post(SAMPLE);
    expect(res.status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith('shipment_apply', { p: expect.objectContaining({ awb: '19041424751540', status_label: 'IN TRANSIT' }) });
    expect(state.notify).toHaveBeenCalledWith(expect.anything(), '0b6f8d3e-1c2a-4f5b-9a7e-2d4c6b8a0f11', 'shipped');
    expect(state.alert).not.toHaveBeenCalled();
  });
  it('alerts the owner on a delivery problem and reports database failures as 500 without detail', async () => {
    state.result = { data: { matched: true, order_id: '0b6f8d3e-1c2a-4f5b-9a7e-2d4c6b8a0f11', status_to: null, problem: true, status_label: 'RTO INITIATED' }, error: null };
    await post({ ...SAMPLE, current_status: 'RTO INITIATED' });
    expect(state.alert).toHaveBeenCalledWith(expect.stringContaining('#0B6F8D3E'), expect.arrayContaining([expect.stringContaining('RTO INITIATED')]));
    expect(state.notify).not.toHaveBeenCalled();
    state.result = { data: null, error: { message: 'relation secret detail' } };
    const res = await post(SAMPLE);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('secret detail');
  });
});

describe('Resend webhook route', () => {
  const key = Buffer.from('unit-test-signing-key-000000001');
  const secret = `whsec_${key.toString('base64')}`;
  const sign = (id: string, ts: number, body: string, k = key) =>
    `v1,${crypto.createHmac('sha256', k).update(`${id}.${ts}.${body}`).digest('base64')}`;
  const send = async (body: string, h: Record<string, string>) => {
    const { POST } = await import('@/app/api/webhooks/email/route');
    return POST(new Request('http://localhost/api/webhooks/email', { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body }));
  };
  const bounced = JSON.stringify({
    type: 'email.bounced',
    created_at: '2026-11-27T10:00:00.000Z',
    data: { email_id: 'em_1', to: ['Gone@Example.test'], subject: 'Your order', bounce: { type: 'Permanent', subType: 'Suppressed', message: '550 <mailbox> unknown' } },
  });
  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = secret;
    state.rpc.mockReset();
    state.result = { data: { new: true, suppressed: 1 }, error: null };
  });

  it('accepts a correctly signed event and passes the recipients and bounce type on', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const res = await send(bounced, { 'svix-id': 'msg_1', 'svix-timestamp': String(ts), 'svix-signature': sign('msg_1', ts, bounced) });
    expect(res.status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith('email_event_record', {
      p_message_id: 'msg_1', p_type: 'email.bounced', p_email_id: 'em_1', p_recipients: ['Gone@Example.test'],
      p_bounce_type: 'Permanent', p_detail: 'Permanent · Suppressed · 550 mailbox unknown',
    });
  });
  it('rejects a wrong key, an edited body, a stale timestamp, missing headers and an unset secret', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const good = { 'svix-id': 'msg_2', 'svix-timestamp': String(ts), 'svix-signature': sign('msg_2', ts, bounced) };
    expect((await send(bounced, { ...good, 'svix-signature': sign('msg_2', ts, bounced, Buffer.from('another-key-xxxxxxxxxxxxxxxxxxxx')) })).status).toBe(401);
    expect((await send(bounced.replace('Gone@', 'Other@'), good)).status).toBe(401);
    const old = ts - 3600;
    expect((await send(bounced, { 'svix-id': 'msg_2', 'svix-timestamp': String(old), 'svix-signature': sign('msg_2', old, bounced) })).status).toBe(401);
    expect((await send(bounced, { 'svix-id': 'msg_2', 'svix-timestamp': String(ts) })).status).toBe(401);
    delete process.env.RESEND_WEBHOOK_SECRET;
    expect((await send(bounced, good)).status).toBe(401);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('reports database failures as 500 so Resend retries', async () => {
    state.result = { data: null, error: { message: 'down' } };
    const ts = Math.floor(Date.now() / 1000);
    expect((await send(bounced, { 'svix-id': 'msg_3', 'svix-timestamp': String(ts), 'svix-signature': sign('msg_3', ts, bounced) })).status).toBe(500);
  });
});
