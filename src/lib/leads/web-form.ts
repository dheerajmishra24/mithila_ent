import 'server-only';
import { cleanAttribution, cleanFbCookie, fbcFromFbclid, type LeadInput } from './parse';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/**
 * Lead fields every website form shares: the optional ad-measurement consent
 * (must be literally true), campaign tags, and, only with that consent, ad
 * click ids plus Meta's _fbp/_fbc browser cookies. The client's submission id
 * makes a double-submit idempotent.
 */
export function webFormLeadFields(req: Request, body: Record<string, unknown> | null): Pick<
  LeadInput,
  'external_id' | 'ad_consent' | 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_term' | 'utm_content' | 'gclid' | 'gbraid' | 'wbraid' | 'fbclid' | 'fbp' | 'fbc'
> {
  const adConsent = body?.adConsent === true;
  const attr = cleanAttribution(body?.attribution, adConsent);
  const id = typeof body?.submissionId === 'string' && UUID_RE.test(body.submissionId) ? `web:${body.submissionId.toLowerCase()}` : null;
  const cookies = req.headers.get('cookie');
  const fbp = adConsent ? cleanFbCookie(cookieValue(cookies, '_fbp')) : null;
  const fbc = adConsent ? cleanFbCookie(cookieValue(cookies, '_fbc')) ?? fbcFromFbclid(attr.fbclid, Date.now()) : null;
  return { external_id: id, ad_consent: adConsent, ...attr, fbp, fbc };
}
