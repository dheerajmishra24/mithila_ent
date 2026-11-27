import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { ANON_KEY, APP_URL, appEnabled, dbEnabled, persona, race, record, service, sessionCookie, SUPABASE_URL, totp, type Persona } from './harness';

// Owner-portal two-step sign-in (migration 0053) under attack: an attacker
// who has the owner's PASSWORD only. They must get no admin rights anywhere
// (RLS, RPCs, pages), must not be able to add their own second factor, must
// not reuse another session's step-up, and cannot brute-force a code.

const META_SECRET = process.env.REDTEAM_META_APP_SECRET ?? 'rt_meta_local';
const h = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

async function passwordOnly(p: Persona) {
  const c = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email: p.email, password: p.password });
  if (s.error || !s.data.session) throw new Error(s.error?.message);
  return { client: c, session: s.data.session };
}

function sessionIdOf(accessToken: string): string {
  return JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString()).session_id;
}

describe.skipIf(!dbEnabled)('red-team: admin two-step sign-in (local stack)', () => {
  let owner: Persona; // admin with an authenticator app
  let fresh: Persona; // admin who has not set up a second factor yet

  beforeAll(async () => {
    owner = await persona('2step-owner', { admin: true });
    fresh = await persona('2step-fresh', { admin: true, secondFactor: false });
  }, 60_000);

  it('the owner with a fresh TOTP check is admin', async () => {
    expect((await owner.client.rpc('is_admin')).data).toBe(true);
  });

  it('the same owner with only a password has no admin rights', async () => {
    const { client } = await passwordOnly(owner);
    expect((await client.rpc('is_admin')).data).toBe(false);
    const status = (await client.rpc('admin_two_step_status')).data as { admin_role: boolean; second_factor: boolean };
    expect(status).toMatchObject({ admin_role: true, second_factor: false });
    // Admin-only data and writes through RLS
    const leads = await client.from('contact_inquiries').select('id').limit(1);
    expect(leads.data ?? []).toHaveLength(0);
    const ins = await client.from('categories').insert({ name: 'pwned', slug: `pwned-${crypto.randomUUID().slice(0, 6)}` }).select('id');
    expect(ins.error !== null || (ins.data ?? []).length === 0).toBe(true);
  });

  it('a password-only session cannot add or remove authenticators', async () => {
    const { client } = await passwordOnly(owner);
    const add = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'attacker' });
    const factors = await owner.client.auth.mfa.listFactors();
    const verified = factors.data?.totp?.[0];
    const del = verified ? await client.auth.mfa.unenroll({ factorId: verified.id }) : { error: new Error('none') };
    record('2step.aal1_factor_changes', { enroll: add.error?.message?.slice(0, 60), unenroll: del.error?.message?.slice(0, 60) });
    // GoTrue lets an aal1 session start an *unverified* enrolment only when the
    // user has no verified factor; with one, both must be refused.
    expect(add.error).not.toBeNull();
    expect(del.error).not.toBeNull();
  });

  it('customers and password-only admins cannot touch codes, phones or step-ups', async () => {
    const { client, session } = await passwordOnly(owner);
    const sid = sessionIdOf(session.access_token);
    const calls = await Promise.all([
      client.rpc('otp_issue', { p_user_id: owner.id, p_session_id: sid, p_purpose: 'phone_enrol', p_phone: '+919876543210', p_code_hash: h('1') }),
      client.rpc('otp_verify', { p_challenge_id: crypto.randomUUID(), p_user_id: owner.id, p_session_id: sid, p_code_hash: h('1') }),
      client.rpc('otp_delivery_status', { p_message_id: 'x', p_status: 'read' }),
      client.rpc('admin_remove_otp_phone', { p_user_id: owner.id }),
    ]);
    for (const c of calls) expect(c.error, 'RPC must be refused').not.toBeNull();
    const step = await client.from('admin_step_up').insert({ session_id: sid, user_id: owner.id, method: 'sms', expires_at: new Date(Date.now() + 3_600_000).toISOString() });
    expect(step.error).not.toBeNull();
    const phones = await client.from('admin_otp_phones').upsert({ user_id: owner.id, phone_e164: '+919999999999' });
    expect(phones.error).not.toBeNull();
    const codes = await client.from('otp_challenges').select('code_hash');
    expect(codes.data ?? []).toHaveLength(0);
    expect((await client.rpc('is_admin')).data).toBe(false);
  });

  it('a step-up is bound to its session: a second sign-in is not admin', async () => {
    const svc = service();
    const a = await passwordOnly(fresh);
    const sidA = sessionIdOf(a.session.access_token);
    await svc.from('admin_otp_phones').upsert({ user_id: fresh.id, phone_e164: '+919812345678' });
    const issued = await svc.rpc('otp_issue', { p_user_id: fresh.id, p_session_id: sidA, p_purpose: 'admin_sign_in', p_phone: null, p_code_hash: h('a:123456') });
    if (issued.error) throw new Error(issued.error.message);
    const ok = await svc.rpc('otp_verify', { p_challenge_id: issued.data.challenge_id, p_user_id: fresh.id, p_session_id: sidA, p_code_hash: h('a:123456') });
    expect(ok.data.ok).toBe(true);
    expect((await a.client.rpc('is_admin')).data).toBe(true);

    const b = await passwordOnly(fresh);
    expect((await b.client.rpc('is_admin')).data).toBe(false);
    // Using A's challenge from session B fails, even with the right code.
    const replay = await svc.rpc('otp_verify', { p_challenge_id: issued.data.challenge_id, p_user_id: fresh.id, p_session_id: sessionIdOf(b.session.access_token), p_code_hash: h('a:123456') });
    expect(replay.data.ok).toBe(false);
  });

  it('twenty parallel guesses count as five, then the right code is refused', async () => {
    const svc = service();
    const p = await passwordOnly(fresh);
    const sid = sessionIdOf(p.session.access_token);
    const issued = await svc.rpc('otp_issue', { p_user_id: fresh.id, p_session_id: sid, p_purpose: 'admin_sign_in', p_phone: null, p_code_hash: h('b:654321') });
    if (issued.error) throw new Error(issued.error.message);
    const id = issued.data.challenge_id as string;
    const burst = await race(20, (i) => svc.rpc('otp_verify', { p_challenge_id: id, p_user_id: fresh.id, p_session_id: sid, p_code_hash: h(`wrong:${i}`) }));
    const row = await svc.from('otp_challenges').select('attempts, locked_at').eq('id', id).single();
    record('2step.bruteforce_race', { histogram: burst.histogram, attempts: row.data?.attempts });
    expect(row.data?.attempts).toBe(5);
    expect(row.data?.locked_at).not.toBeNull();
    const right = await svc.rpc('otp_verify', { p_challenge_id: id, p_user_id: fresh.id, p_session_id: sid, p_code_hash: h('b:654321') });
    expect(right.data).toMatchObject({ ok: false, reason: 'LOCKED' });
    expect((await p.client.rpc('is_admin')).data).toBe(false);
  });

  it('TOTP codes are checked by Supabase: a wrong code does not upgrade the session', async () => {
    const { client } = await passwordOnly(owner);
    const f = (await client.auth.mfa.listFactors()).data?.totp?.[0];
    expect(f).toBeTruthy();
    const wrong = String((Number(totp(owner.totpSecret!)) + 1) % 1_000_000).padStart(6, '0');
    const r = await client.auth.mfa.challengeAndVerify({ factorId: f!.id, code: wrong });
    expect(r.error).not.toBeNull();
    expect((await client.rpc('is_admin')).data).toBe(false);
  });

  describe.skipIf(!appEnabled)('over HTTP (local app)', () => {
    it('owner pages send a password-only admin to the two-step page', async () => {
      const { session } = await passwordOnly(owner);
      const cookie = sessionCookie({ ...owner, session: session as unknown as Persona['session'] });
      const dash = await fetch(APP_URL + '/admin/dashboard', { redirect: 'manual', headers: { cookie } });
      expect(dash.status).toBeGreaterThanOrEqual(300);
      expect(dash.status).toBeLessThan(400);
      expect(new URL(dash.headers.get('location')!, APP_URL).pathname).toBe('/admin-verify');
      const verify = await fetch(APP_URL + '/admin-verify', { redirect: 'manual', headers: { cookie } });
      expect(verify.status).toBe(200);
      const full = await fetch(APP_URL + '/admin/dashboard', { redirect: 'manual', headers: { cookie: sessionCookie(owner) } });
      expect(full.status).toBe(200);
    });

    it('WhatsApp webhook: signature over the raw body, handshake token checked', async () => {
      const body = JSON.stringify({ entry: [{ changes: [{ field: 'messages', value: { statuses: [{ id: 'wamid.RT', status: 'read' }] } }] }] });
      const sign = (b: string, k: string) => 'sha256=' + crypto.createHmac('sha256', k).update(b).digest('hex');
      const post = (sig: string | null, b = body) =>
        fetch(APP_URL + '/api/webhooks/whatsapp', { method: 'POST', body: b, headers: { 'content-type': 'application/json', ...(sig ? { 'x-hub-signature-256': sig } : {}) } });
      expect((await post(null)).status).toBe(401);
      expect((await post(sign(body, 'wrong-secret'))).status).toBe(401);
      expect((await post(sign(body, META_SECRET), body.replace('read', 'sent'))).status).toBe(401); // body changed after signing
      expect((await post(sign(body, META_SECRET))).status).toBe(200);
      const hs = await fetch(APP_URL + '/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=abc');
      expect(hs.status).toBe(403);
    });
  });
});
