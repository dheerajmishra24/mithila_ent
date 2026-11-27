import { NextResponse } from 'next/server';
import { secretMatches } from '@/lib/secure-compare';
import { captureLead } from '@/lib/leads/capture';
import { parseGoogleLead } from '@/lib/leads/parse';

// Google Ads lead form webhook (lead form asset > "Webhook integration"):
//   Webhook URL  https://<domain>/api/webhooks/google-leads
//   Key          GOOGLE_LEADS_KEY
//
// Google sends the key inside the JSON body (google_key); it is compared in
// constant time. Answers: 200 {} once stored (repeats of a lead_id are no-ops
// in the database), 400 for a body that is not a lead, 401 for a wrong key,
// 500 when storing failed so Google retries. Test leads (is_test) are kept
// apart from real ones: never in the default list, exports or conversions.

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const lead = parseGoogleLead(body);
  if (!lead) return NextResponse.json({ error: 'Not a lead' }, { status: 400 });
  if (!secretMatches(process.env.GOOGLE_LEADS_KEY, lead.googleKey)) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 401 });
  }

  const r = await captureLead({
    source: 'google',
    external_id: lead.leadId,
    ...lead.fields,
    is_test: lead.isTest,
    ad_consent: true, // collected by Google on the advertiser's behalf, under the lead form's privacy notice
    gclid: lead.gclid,
    google_lead_id: lead.leadId,
    detail: {
      channel: 'google_lead_form',
      form_id: lead.formId,
      campaign_id: lead.campaignId,
      adgroup_id: lead.adgroupId,
      creative_id: lead.creativeId,
      answers: lead.answers,
    },
  });
  if (!r.ok) {
    console.error('google-leads webhook: capture failed', r.error);
    return NextResponse.json({ error: 'Temporarily unavailable' }, { status: 500 });
  }
  return NextResponse.json({}, { status: 200 });
}
