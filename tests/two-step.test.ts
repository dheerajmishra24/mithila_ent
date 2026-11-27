import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateOtp, hashOtp, maskPhone, normaliseIndianMobile, phoneOtpAvailable, providerBase } from '@/lib/otp';
import { metaVerifyHandshake, verifyMetaSignature } from '@/lib/webhooks/meta-signature';
import { extractStatuses } from '@/lib/webhooks/whatsapp-status';
import { whatsappAuthPayload } from '@/lib/messaging/whatsapp-auth';
import { dltSmsPayload } from '@/lib/messaging/dlt-sms';

afterEach(() => vi.unstubAllEnvs());

describe('Indian mobile numbers', () => {
  it.each([
    ['98765 43210', '+919876543210'],
    ['+91 98765-43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['6000000000', '+916000000000'],
  ])('%s -> %s', (input, out) => expect(normaliseIndianMobile(input)).toBe(out));

  it.each(['5876543210', '98765432', '+1 415 555 0100', '98765432101', 'abc', ''])('rejects %s', (input) => {
    expect(normaliseIndianMobile(input)).toBeNull();
  });

  it('masks all but the last four digits', () => {
    expect(maskPhone('3210')).toBe('+91 ••••••3210');
    expect(maskPhone(null)).toBe('');
  });
});

describe('one-time codes', () => {
  it('are six digits, zero-padded, and vary', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateOtp()));
    for (const c of codes) expect(c).toMatch(/^[0-9]{6}$/);
    expect(codes.size).toBeGreaterThan(190);
  });

  it('hash is bound to session, purpose and pepper', () => {
    vi.stubEnv('OTP_PEPPER', 'p'.repeat(40));
    const a = hashOtp('s1', 'admin_sign_in', '123456');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOtp('s1', 'admin_sign_in', '123456')).toBe(a);
    expect(hashOtp('s2', 'admin_sign_in', '123456')).not.toBe(a);
    expect(hashOtp('s1', 'phone_enrol', '123456')).not.toBe(a);
    expect(hashOtp('s1', 'admin_sign_in', '123457')).not.toBe(a);
    vi.stubEnv('OTP_PEPPER', 'q'.repeat(40));
    expect(hashOtp('s1', 'admin_sign_in', '123456')).not.toBe(a);
  });

  it('refuses to hash without a long enough pepper', () => {
    vi.stubEnv('OTP_PEPPER', 'short');
    expect(() => hashOtp('s', 'admin_sign_in', '123456')).toThrow();
  });

  it('phone codes are offered only with a pepper and a channel', () => {
    vi.stubEnv('OTP_PEPPER', 'p'.repeat(40));
    vi.stubEnv('WHATSAPP_TOKEN', '');
    vi.stubEnv('MSG91_AUTH_KEY', '');
    expect(phoneOtpAvailable()).toBe(false);
    vi.stubEnv('MSG91_AUTH_KEY', 'k');
    vi.stubEnv('MSG91_OTP_TEMPLATE_ID', 't');
    expect(phoneOtpAvailable()).toBe(true);
    vi.stubEnv('OTP_PEPPER', '');
    expect(phoneOtpAvailable()).toBe(false);
  });
});

describe('provider address override', () => {
  const real = 'https://graph.facebook.com/v21.0';
  it('honours localhost only, never on Vercel', () => {
    vi.stubEnv('VERCEL', '');
    expect(providerBase('http://127.0.0.1:3199/wa/', real)).toBe('http://127.0.0.1:3199/wa');
    expect(providerBase('https://evil.example/wa', real)).toBe(real);
    expect(providerBase('not a url', real)).toBe(real);
    expect(providerBase(undefined, real)).toBe(real);
    vi.stubEnv('VERCEL', '1');
    expect(providerBase('http://127.0.0.1:3199/wa', real)).toBe(real);
  });
});

describe('Meta webhook signature', () => {
  const secret = 'app-secret';
  const body = '{"entry":[]}';
  const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

  it('accepts the exact raw body', () => expect(verifyMetaSignature(body, sig, secret)).toBe(true));
  it('rejects a changed body, wrong secret, bad format or missing secret', () => {
    expect(verifyMetaSignature(body + ' ', sig, secret)).toBe(false);
    expect(verifyMetaSignature(body, sig, 'other')).toBe(false);
    expect(verifyMetaSignature(body, sig.replace('sha256=', 'sha1='), secret)).toBe(false);
    expect(verifyMetaSignature(body, 'sha256=abc', secret)).toBe(false);
    expect(verifyMetaSignature(body, null, secret)).toBe(false);
    expect(verifyMetaSignature(body, sig, undefined)).toBe(false);
  });

  it('handshake echoes the challenge only for the right token', () => {
    const u = (t: string, c = 'abc123') => new URL(`https://x/api?hub.mode=subscribe&hub.verify_token=${t}&hub.challenge=${c}`);
    expect(metaVerifyHandshake(u('tok'), 'tok')).toBe('abc123');
    expect(metaVerifyHandshake(u('nope'), 'tok')).toBeNull();
    expect(metaVerifyHandshake(u('tok', '<script>'), 'tok')).toBeNull();
    expect(metaVerifyHandshake(u('tok'), undefined)).toBeNull();
  });
});

describe('WhatsApp statuses', () => {
  it('keeps message statuses only', () => {
    const body = { entry: [{ changes: [
      { field: 'messages', value: { statuses: [{ id: 'wamid.1', status: 'delivered' }, { id: 'wamid.2', status: 'deleted' }, { id: 3, status: 'read' }] } },
      { field: 'account_update', value: { statuses: [{ id: 'wamid.9', status: 'read' }] } },
    ] }] };
    expect(extractStatuses(body)).toEqual([{ id: 'wamid.1', status: 'delivered' }]);
    expect(extractStatuses(null)).toEqual([]);
    expect(extractStatuses({ entry: 'x' })).toEqual([]);
  });
});

describe('message payloads', () => {
  it('WhatsApp uses the authentication template with the code in body and copy button', () => {
    vi.stubEnv('WHATSAPP_AUTH_TEMPLATE', 'admin_code');
    const p = whatsappAuthPayload('+919876543210', '123456');
    expect(p.to).toBe('919876543210');
    expect(p.type).toBe('template');
    expect(p.template.name).toBe('admin_code');
    expect(p.template.components).toEqual([
      { type: 'body', parameters: [{ type: 'text', text: '123456' }] },
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: '123456' }] },
    ]);
    expect(JSON.stringify(p)).not.toMatch(/https?:\/\//);
  });

  it('DLT SMS sends only the template id and the numeric variable', () => {
    vi.stubEnv('MSG91_OTP_TEMPLATE_ID', 'tpl-1');
    expect(dltSmsPayload('+919876543210', '123456')).toEqual({
      template_id: 'tpl-1', short_url: '0', recipients: [{ mobiles: '919876543210', otp: '123456' }],
    });
  });
});
