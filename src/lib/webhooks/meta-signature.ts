import crypto from 'crypto';

// Meta (WhatsApp Cloud API, Lead Ads) signs each webhook POST with
// X-Hub-Signature-256: "sha256=" + hex HMAC-SHA256(app secret, raw body).
// Verify over the exact bytes received, before any JSON parsing, in constant
// time. Fails closed when the secret is unset.
export function verifyMetaSignature(rawBody: string | Buffer, header: string | null, appSecret: string | undefined): boolean {
  if (!appSecret || !header) return false;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
  if (!m) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest();
  const given = Buffer.from(m[1], 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/** GET handshake: echo hub.challenge only when the verify token matches. */
export function metaVerifyHandshake(url: URL, verifyToken: string | undefined): string | null {
  if (!verifyToken) return null;
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token') ?? '';
  const challenge = url.searchParams.get('hub.challenge');
  if (mode !== 'subscribe' || !challenge || !/^[A-Za-z0-9_-]{1,128}$/.test(challenge)) return null;
  const a = crypto.createHash('sha256').update(verifyToken).digest();
  const b = crypto.createHash('sha256').update(token).digest();
  return crypto.timingSafeEqual(a, b) ? challenge : null;
}
