import { NextRequest, NextResponse } from 'next/server';
import { secretMatches } from '@/lib/secure-compare';
import { backfillMetaForms, metaLeadsBlockedByToken, retryMetaInbox } from '@/lib/leads/meta';
import { sendPendingConversions } from '@/lib/leads/conversions';
import { sendOwnerAlertEmail } from '@/lib/email';

// Daily lead housekeeping (vercel.json):
//   1. re-run Meta leads whose Graph fetch failed (lead_inbox),
//   2. list the last 48 h of each known Meta lead form and capture any lead
//      the webhook missed,
//   3. send queued conversions to Meta / Google,
//   4. e-mail the owner if the Meta Page token has stopped working.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  const auth = request.headers.get('authorization') || '';
  if (!secretMatches(secret, auth.startsWith('Bearer ') ? auth.slice(7) : '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const inbox = await retryMetaInbox(50);
    const backfill = await backfillMetaForms(48);
    const conversions = await sendPendingConversions(50);
    const blocked = await metaLeadsBlockedByToken();
    if (blocked > 0 || backfill.tokenProblem) {
      await sendOwnerAlertEmail('Meta lead ads: access token stopped working', [
        `New Facebook/Instagram leads cannot be read. ${blocked} lead(s) are waiting and will be fetched automatically once the token is replaced.`,
        'Create a new Page access token with the leads_retrieval permission and update META_PAGE_ACCESS_TOKEN in Vercel. See docs/LEAD_CRM.md.',
      ]);
    }
    return NextResponse.json({ ok: true, inbox, backfill, conversions, blocked });
  } catch (err) {
    console.error('leads cron failed:', (err as Error).message);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return run(request);
}
export async function POST(request: NextRequest) {
  return run(request);
}
