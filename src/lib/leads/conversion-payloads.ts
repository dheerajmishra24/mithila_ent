// Request bodies for reporting a lead's outcome back to the ad platforms.
// Pure (hashing only), so the exact bytes sent can be unit tested.
//
// Only normalised contact fields are hashed (SHA-256, hex). Click and browser
// identifiers (fbc, fbp, gclid, gbraid, wbraid) and Meta's lead_id are sent as
// they are, as both platforms require.
import crypto from 'crypto';
import { splitName } from './parse';

export interface ConversionLead {
  email: string | null;
  phone_e164: string | null;
  full_name: string | null;
  city: string | null;
  fbc: string | null;
  fbp: string | null;
  fbclid: string | null;
  meta_lead_id: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  created_at: string;
}

export interface ConversionRow {
  event_id: string;
  stage: 'qualified' | 'won';
  event_time: string;
  value_paise: number | null;
}

export const sha256 = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

/** Meta: lower-case, trimmed e-mail. */
export const metaEmail = (e: string) => e.trim().toLowerCase();
/** Meta: digits only, with country code, no + or leading zeros. */
export const metaPhone = (p: string) => p.replace(/\D/g, '').replace(/^0+/, '');
/** Names / city: lower-case, letters only (Meta normalisation). */
const metaText = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[^\p{L}]/gu, '');

/** Google: lower-case, trimmed; gmail/googlemail lose the dots in the user part. */
export function googleEmail(e: string): string {
  const s = e.trim().toLowerCase();
  const at = s.lastIndexOf('@');
  if (at < 1) return s;
  const user = s.slice(0, at);
  const domain = s.slice(at + 1);
  return domain === 'gmail.com' || domain === 'googlemail.com' ? `${user.replace(/\./g, '')}@${domain}` : s;
}

export const META_EVENT_NAME: Record<ConversionRow['stage'], string> = {
  qualified: 'QualifiedLead',
  won: 'Purchase',
};

/** One Conversions API event (CRM / system_generated). */
export function metaCapiBody(lead: ConversionLead, conv: ConversionRow, opts: { testEventCode?: string | null } = {}) {
  const user_data: Record<string, unknown> = {};
  if (lead.email) user_data.em = [sha256(metaEmail(lead.email))];
  if (lead.phone_e164) user_data.ph = [sha256(metaPhone(lead.phone_e164))];
  const { first, last } = splitName(lead.full_name);
  if (first && metaText(first)) user_data.fn = [sha256(metaText(first))];
  if (last && metaText(last)) user_data.ln = [sha256(metaText(last))];
  if (lead.city && metaText(lead.city)) user_data.ct = [sha256(metaText(lead.city))];
  if (lead.phone_e164?.startsWith('+91')) user_data.country = [sha256('in')];
  const fbc = lead.fbc ?? (lead.fbclid ? `fb.1.${Date.parse(lead.created_at)}.${lead.fbclid}` : null);
  if (fbc) user_data.fbc = fbc;
  if (lead.fbp) user_data.fbp = lead.fbp;
  if (lead.meta_lead_id) user_data.lead_id = lead.meta_lead_id;

  const custom_data: Record<string, unknown> = { event_source: 'crm', lead_event_source: 'Mithila CRM' };
  if (conv.stage === 'won' && conv.value_paise != null) {
    custom_data.value = conv.value_paise / 100;
    custom_data.currency = 'INR';
  }
  const body: Record<string, unknown> = {
    data: [{
      event_name: META_EVENT_NAME[conv.stage],
      event_time: Math.floor(Date.parse(conv.event_time) / 1000),
      event_id: conv.event_id,
      action_source: 'system_generated',
      user_data,
      custom_data,
    }],
  };
  if (opts.testEventCode) body.test_event_code = opts.testEventCode;
  return body;
}

export interface GoogleDestination {
  customerId: string;
  loginCustomerId?: string | null;
  conversionActionId: string;
}

/** One Data Manager API events:ingest request (offline conversion). */
export function googleIngestBody(lead: ConversionLead, conv: ConversionRow, dest: GoogleDestination, opts: { validateOnly?: boolean } = {}) {
  const userIdentifiers: Record<string, string>[] = [];
  if (lead.email) userIdentifiers.push({ emailAddress: sha256(googleEmail(lead.email)) });
  if (lead.phone_e164) userIdentifiers.push({ phoneNumber: sha256(lead.phone_e164) });
  const adIdentifiers: Record<string, string> = {};
  if (lead.gclid) adIdentifiers.gclid = lead.gclid;
  if (lead.gbraid) adIdentifiers.gbraid = lead.gbraid;
  if (lead.wbraid) adIdentifiers.wbraid = lead.wbraid;

  const event: Record<string, unknown> = {
    transactionId: conv.event_id,
    eventTimestamp: new Date(conv.event_time).toISOString(),
    eventSource: 'OTHER',
    adIdentifiers,
    // Sent only for leads who agreed to ad measurement; no personalisation.
    consent: { adUserData: 'CONSENT_GRANTED', adPersonalization: 'CONSENT_DENIED' },
  };
  if (userIdentifiers.length) event.userData = { userIdentifiers };
  if (conv.stage === 'won' && conv.value_paise != null) {
    event.conversionValue = conv.value_paise / 100;
    event.currency = 'INR';
  }
  const destination: Record<string, unknown> = {
    operatingAccount: { accountType: 'GOOGLE_ADS', accountId: dest.customerId },
    productDestinationId: dest.conversionActionId,
  };
  if (dest.loginCustomerId) destination.loginAccount = { accountType: 'GOOGLE_ADS', accountId: dest.loginCustomerId };
  return {
    destinations: [destination],
    events: [event],
    encoding: 'HEX',
    ...(opts.validateOnly ? { validateOnly: true } : {}),
  };
}
