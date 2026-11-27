import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import {
  cleanAttribution, cleanFbCookie, extractLeadgenChanges, fbcFromFbclid, metaFieldsToLead,
  normaliseEmail, normalisePhone, parseGoogleLead, splitName,
} from '@/lib/leads/parse';
import { googleEmail, googleIngestBody, metaCapiBody, sha256 } from '@/lib/leads/conversion-payloads';
import { toCsv } from '@/lib/csv';

const h = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

describe('contact normalising', () => {
  it.each([
    ['98765 43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['+91 98765-43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['+44 20 7946 0958', '+442079460958'],
  ])('phone %s -> %s', (i, o) => expect(normalisePhone(i)).toBe(o));

  it.each(['12345', '5876543210', '+91 5876543210', '44 20 7946 0958', 'call me', ''])('rejects phone %s', (i) => {
    expect(normalisePhone(i)).toBeNull();
  });

  it('e-mails are lower-cased and must look like e-mails', () => {
    expect(normaliseEmail('  Asha@Example.IN ')).toBe('asha@example.in');
    expect(normaliseEmail('asha@localhost')).toBeNull();
    expect(normaliseEmail('no at sign')).toBeNull();
  });

  it('splits names', () => {
    expect(splitName('Asha  Devi Kumari')).toEqual({ first: 'Asha', last: 'Kumari' });
    expect(splitName('Asha')).toEqual({ first: 'Asha', last: null });
    expect(splitName('')).toEqual({ first: null, last: null });
  });
});

describe('website attribution', () => {
  const raw = { utm_source: 'google', utm_campaign: 'silk-diwali', gclid: 'Cj0KCQ-abc_123', fbclid: 'IwAR2x', evil: 'x', gbraid: 'bad value with spaces' };

  it('campaign tags always; click ids only with consent', () => {
    expect(cleanAttribution(raw, false)).toEqual({ utm_source: 'google', utm_campaign: 'silk-diwali' });
    expect(cleanAttribution(raw, true)).toEqual({ utm_source: 'google', utm_campaign: 'silk-diwali', gclid: 'Cj0KCQ-abc_123', fbclid: 'IwAR2x' });
    expect(cleanAttribution('nope', true)).toEqual({});
  });

  it('Meta cookies must have the documented shape', () => {
    expect(cleanFbCookie('fb.1.1700000000000.IwAR2x')).toBe('fb.1.1700000000000.IwAR2x');
    expect(cleanFbCookie('fb.1.abc.<script>')).toBeNull();
    expect(fbcFromFbclid('IwAR2x', 1700000000000)).toBe('fb.1.1700000000000.IwAR2x');
    expect(fbcFromFbclid('bad id', 1)).toBeNull();
  });
});

describe('Meta Lead Ads', () => {
  it('keeps leadgen changes with numeric ids only', () => {
    const body = { object: 'page', entry: [{ changes: [
      { field: 'leadgen', value: { leadgen_id: '1234567890', form_id: '55', page_id: '66', ad_id: 'x', created_time: 1700000000 } },
      { field: 'leadgen', value: { leadgen_id: '12;drop' } },
      { field: 'feed', value: { leadgen_id: '999' } },
    ] }] };
    expect(extractLeadgenChanges(body)).toEqual([{ leadgen_id: '1234567890', form_id: '55', page_id: '66', ad_id: null, created_time: 1700000000 }]);
    expect(extractLeadgenChanges(null)).toEqual([]);
  });

  it('maps field_data; other questions become answers; test leads detected', () => {
    const r = metaFieldsToLead([
      { name: 'first_name', values: ['Asha'] },
      { name: 'last_name', values: ['Devi'] },
      { name: 'email', values: ['ASHA@Example.in'] },
      { name: 'phone_number', values: ['+919876543210'] },
      { name: 'which_fabric?', values: ['Tussar silk'] },
    ]);
    expect(r.fields).toEqual({ full_name: 'Asha Devi', email: 'asha@example.in', phone: '+919876543210' });
    expect(r.answers).toEqual([{ q: 'which_fabric?', a: 'Tussar silk' }]);
    expect(r.isTest).toBe(false);
    expect(metaFieldsToLead([{ name: 'full_name', values: ['<test lead: dummy data for full_name>'] }]).isTest).toBe(true);
  });
});

describe('Google lead form webhook body', () => {
  const body = {
    lead_id: 'TeSter-123-ABCDEFGHIJKLMNOPQRSTUVWXYZ', api_version: '1.0', form_id: 40000000, campaign_id: 50000000,
    google_key: 'k', is_test: true, gcl_id: 'TeSter-123',
    user_column_data: [
      { column_id: 'FULL_NAME', string_value: 'Asha Devi', column_name: 'Full Name' },
      { column_id: 'EMAIL', string_value: 'Asha@example.in', column_name: 'User Email' },
      { column_id: 'PHONE_NUMBER', string_value: '+919876543210', column_name: 'User Phone' },
      { column_id: 'POSTAL_CODE', string_value: '110001', column_name: 'Postal Code' },
      { column_id: 'WHAT_ARE_YOU_LOOKING_FOR?', string_value: 'Linen', column_name: 'What are you looking for?' },
    ],
  };

  it('parses by column_id and keeps custom questions as answers', () => {
    const g = parseGoogleLead(body)!;
    expect(g.leadId).toBe(body.lead_id);
    expect(g.isTest).toBe(true);
    expect(g.gclid).toBe('TeSter-123');
    expect(g.formId).toBe('40000000');
    expect(g.fields).toEqual({ full_name: 'Asha Devi', email: 'asha@example.in', phone: '+919876543210' });
    expect(g.answers).toEqual([{ q: 'What are you looking for?', a: 'Linen' }]);
  });

  it('rejects bodies that are not leads', () => {
    expect(parseGoogleLead({})).toBeNull();
    expect(parseGoogleLead({ lead_id: 'a b' })).toBeNull();
    expect(parseGoogleLead('x')).toBeNull();
  });
});

describe('conversion payloads', () => {
  const lead = {
    email: 'Asha.Devi@Gmail.com', phone_e164: '+919876543210', full_name: 'Asha Devi', city: 'New Delhi',
    fbc: null, fbp: 'fb.1.1700000000000.111', fbclid: 'IwAR2x', meta_lead_id: '1234567890',
    gclid: 'Cj0K', gbraid: null, wbraid: null, created_at: '2026-11-01T10:00:00.000Z',
  };
  const conv = { event_id: '6f1c2a53-6f2e-4b5d-9f53-8d7e1b0c9a11', stage: 'won' as const, event_time: '2026-11-20T10:00:00.000Z', value_paise: 1250050 };

  it('Meta: hashes contact fields only; ids, fbc, fbp unhashed; value in rupees', () => {
    const b = metaCapiBody(lead, conv, { testEventCode: 'TEST1' }) as { data: Record<string, any>[]; test_event_code: string };
    const e = b.data[0];
    expect(e).toMatchObject({ event_name: 'Purchase', event_id: conv.event_id, action_source: 'system_generated', event_time: 1795168800 });
    expect(e.user_data.em).toEqual([h('asha.devi@gmail.com')]);
    expect(e.user_data.ph).toEqual([h('919876543210')]);
    expect(e.user_data.fn).toEqual([h('asha')]);
    expect(e.user_data.ln).toEqual([h('devi')]);
    expect(e.user_data.ct).toEqual([h('newdelhi')]);
    expect(e.user_data.country).toEqual([h('in')]);
    expect(e.user_data.lead_id).toBe('1234567890');
    expect(e.user_data.fbp).toBe('fb.1.1700000000000.111');
    expect(e.user_data.fbc).toBe(`fb.1.${Date.parse(lead.created_at)}.IwAR2x`);
    expect(e.custom_data).toEqual({ event_source: 'crm', lead_event_source: 'Mithila CRM', value: 12500.5, currency: 'INR' });
    expect(b.test_event_code).toBe('TEST1');
    expect(JSON.stringify(b)).not.toContain('Asha');
    expect('test_event_code' in metaCapiBody(lead, conv)).toBe(false);
  });

  it('Google: Data Manager body, E.164 phone hash, gmail dots removed, HEX', () => {
    expect(googleEmail(' Asha.Devi@Gmail.com ')).toBe('ashadevi@gmail.com');
    expect(googleEmail('a.b@example.in')).toBe('a.b@example.in');
    const b = googleIngestBody(lead, { ...conv, stage: 'qualified', value_paise: null }, { customerId: '1234567890', loginCustomerId: '999', conversionActionId: '111' });
    expect(b).toEqual({
      destinations: [{ operatingAccount: { accountType: 'GOOGLE_ADS', accountId: '1234567890' }, productDestinationId: '111', loginAccount: { accountType: 'GOOGLE_ADS', accountId: '999' } }],
      events: [{
        transactionId: conv.event_id,
        eventTimestamp: '2026-11-20T10:00:00.000Z',
        eventSource: 'OTHER',
        adIdentifiers: { gclid: 'Cj0K' },
        consent: { adUserData: 'CONSENT_GRANTED', adPersonalization: 'CONSENT_DENIED' },
        userData: { userIdentifiers: [{ emailAddress: sha256('ashadevi@gmail.com') }, { phoneNumber: sha256('+919876543210') }] },
      }],
      encoding: 'HEX',
    });
  });
});

describe('lead export', () => {
  it('formula-looking lead text is neutralised', () => {
    const csv = toCsv(['Name'], [['=HYPERLINK("http://evil","x")'], ['+91 98765 43210'], ['@SUM(A1)']]);
    expect(csv).toBe('"Name"\r\n"\t=HYPERLINK(""http://evil"",""x"")"\r\n"\t+91 98765 43210"\r\n"\t@SUM(A1)"\r\n');
  });
});
