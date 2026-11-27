import crypto from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { APP_URL, appEnabled, catalogue, persona, record, service, sessionCookie, SHIPPING, type Persona } from './harness';

// Playbook Step 5, HTTP layer: middleware-bypass headers (CVE-2025-29927),
// invoice IDOR, webhook replay over the real route, and secret-guarded
// endpoints. Needs the app running locally against the LOCAL Supabase stack
// (REDTEAM_APP_URL) with RAZORPAY_WEBHOOK_SECRET=REDTEAM_WEBHOOK_SECRET.

const WEBHOOK_SECRET = process.env.REDTEAM_WEBHOOK_SECRET ?? 'rt_whsec_local';
const BYPASS = [
  'middleware:middleware:middleware:middleware:middleware',
  'src/middleware:src/middleware:src/middleware:src/middleware:src/middleware',
  'proxy:proxy:proxy:proxy:proxy',
  'src/proxy:src/proxy:src/proxy:src/proxy:src/proxy',
];

const get = (path: string, headers: Record<string, string> = {}) =>
  fetch(APP_URL + path, { redirect: 'manual', headers });

describe.skipIf(!appEnabled)('red-team: HTTP layer (local app + local stack)', () => {
  let a: Persona;
  let b: Persona;
  let orderId: string;

  beforeAll(async () => {
    a = await persona('http-a');
    b = await persona('http-b');
    const cat = await catalogue('http');
    const v = await cat.variant(100, 400);
    const o = await service().rpc('create_order_atomic', {
      p_user_id: a.id, p_items: [{ variant_id: v, quantity: 1 }], p_shipping: SHIPPING,
      p_shipping_amount: 60, p_discount_code: null, p_idempotency_key: crypto.randomUUID(),
    });
    if (o.error) throw new Error(o.error.message);
    orderId = o.data as string;
  }, 60_000);

  it('middleware-bypass headers do not open admin or account pages', async () => {
    const out: Record<string, number> = {};
    for (const path of ['/admin/dashboard', '/admin/orders', '/account']) {
      for (const h of BYPASS) {
        const r = await get(path, { 'x-middleware-subrequest': h });
        out[`${path} ${h.split(':')[0]}`] = r.status;
        expect([301, 302, 303, 307, 308, 401, 403, 404]).toContain(r.status);
        if (r.status >= 300 && r.status < 400) expect(r.headers.get('location') ?? '').toMatch(/\/login/);
      }
    }
    record('middleware_bypass_statuses', out);
  });

  it('a signed-in customer is refused the admin pages', async () => {
    const r = await get('/admin/dashboard', { cookie: sessionCookie(b) });
    record('customer_admin_page', { status: r.status, location: r.headers.get('location') });
    expect([301, 302, 303, 307, 308, 401, 403, 404]).toContain(r.status);
    expect(r.headers.get('location') ?? '').not.toMatch(/\/admin/);
  });

  it('invoice download: owner gets the PDF, customer B and anon get 404 and no bytes of it', async () => {
    const own = await get(`/api/invoice/${orderId}`, { cookie: sessionCookie(a) });
    const ownBody = Buffer.from(await own.arrayBuffer());
    const other = await get(`/api/invoice/${orderId}`, { cookie: sessionCookie(b) });
    const otherBody = await other.text();
    const anonR = await get(`/api/invoice/${orderId}`);
    const bad = await get(`/api/invoice/not-a-uuid`, { cookie: sessionCookie(a) });
    record('invoice_idor', {
      owner: [own.status, own.headers.get('content-type'), ownBody.subarray(0, 5).toString()],
      customer_b: other.status, anon: anonR.status, bad_id: bad.status,
    });
    expect(own.status).toBe(200);
    expect(ownBody.subarray(0, 5).toString()).toBe('%PDF-');
    expect(own.headers.get('cache-control')).toContain('no-store');
    expect(other.status).toBe(404);
    expect(otherBody).not.toContain('%PDF');
    expect(anonR.status).toBe(404);
    expect(bad.status).toBe(404);
  }, 30_000); // first PDF render is cold

  it('admin-only API refuses anon and customers', async () => {
    const body = JSON.stringify({ image: 'data:image/png;base64,AAAA' });
    const anonR = await fetch(APP_URL + '/api/extract-fabric', { method: 'POST', body, headers: { 'content-type': 'application/json' } });
    const custR = await fetch(APP_URL + '/api/extract-fabric', { method: 'POST', body, headers: { 'content-type': 'application/json', cookie: sessionCookie(b) } });
    record('extract_fabric', { anon: anonR.status, customer: custR.status });
    expect([401, 403]).toContain(anonR.status);
    expect([401, 403]).toContain(custR.status);
  }, 30_000);

  it('secret-guarded endpoints refuse unauthenticated calls', async () => {
    const out: Record<string, number> = {};
    for (const p of ['/api/cron/timeouts', '/api/cron/process-emails', '/api/cron/webhook-retry']) {
      out[p] = (await get(p)).status;
      out[`${p} wrong-bearer`] = (await get(p, { authorization: 'Bearer wrong' })).status;
      expect([401, 503]).toContain(out[p]);
      expect([401, 503]).toContain(out[`${p} wrong-bearer`]);
    }
    const logi = await fetch(APP_URL + '/api/webhooks/logistics', { method: 'POST', body: '{}', headers: { 'x-webhook-secret': 'wrong' } });
    out['/api/webhooks/logistics'] = logi.status;
    expect(logi.status).toBe(401);
    out['/api/dev/login'] = (await get('/api/dev/login')).status;
    expect(out['/api/dev/login']).toBe(404);
    out['/api/webhooks/payment (removed)'] = (await fetch(APP_URL + '/api/webhooks/payment', { method: 'POST', body: '{}' })).status;
    expect(out['/api/webhooks/payment (removed)']).toBe(404);
    record('guarded_endpoints', out);
  });

  it('Razorpay webhook: forged signature rejected; 20 parallel replays of one event pay once', async () => {
    const rzpOrder = `order_rt${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    await service().from('orders').update({ razorpay_order_id: rzpOrder }).eq('id', orderId);
    const tot = await service().from('orders').select('total_amount').eq('id', orderId).single();
    const pay = `pay_rt${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const raw = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: {
        id: pay, order_id: rzpOrder, amount: Math.round(Number(tot.data!.total_amount) * 100), currency: 'INR',
        status: 'captured', method: 'upi', notes: { order_id: orderId },
      } } },
    });
    const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');
    const eventId = `evt_rt_${crypto.randomUUID().slice(0, 12)}`;
    const send = (signature: string) =>
      fetch(APP_URL + '/api/webhooks/razorpay', {
        method: 'POST', body: raw,
        headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature, 'x-razorpay-event-id': eventId },
      });

    const forged = await send('0'.repeat(64));
    expect(forged.status).toBe(401);
    const tampered = await fetch(APP_URL + '/api/webhooks/razorpay', {
      method: 'POST', body: raw.replace('"upi"', '"card"'),
      headers: { 'x-razorpay-signature': sig, 'x-razorpay-event-id': eventId },
    });
    expect(tampered.status).toBe(401);

    const statuses = await Promise.all(Array.from({ length: 20 }, () => send(sig).then((r) => r.status)));
    const hist: Record<number, number> = {};
    for (const s of statuses) hist[s] = (hist[s] ?? 0) + 1;

    let rows = 0;
    let paid = false;
    for (let i = 0; i < 20 && !paid; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const p = await service().from('payments').select('id', { count: 'exact', head: true }).eq('provider_payment_id', pay);
      const o = await service().from('orders').select('is_paid').eq('id', orderId).single();
      rows = p.count ?? 0;
      paid = Boolean(o.data?.is_paid);
    }
    const ev = await service().from('webhook_events').select('outcome, attempts').eq('event_id', eventId).single();
    record('webhook_replay', { forged: forged.status, tampered: tampered.status, replay_statuses: hist, payment_rows: rows, is_paid: paid, event: ev.data });
    expect(hist[200]).toBe(20);
    expect(rows).toBe(1);
    expect(paid).toBe(true);
    expect(ev.data?.outcome).toBe('recorded_capture');
  }, 60_000);
});
