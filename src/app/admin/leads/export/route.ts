import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/dal/session';
import { SOURCE_LABEL, listLeads, parseLeadFilters } from '@/lib/dal/leads';
import { toCsv } from '@/lib/csv';

// Lead export for the owner. Admin only (role + recent second factor, checked
// in listLeads and again by RLS). Every text cell goes through csvCell, so a
// lead named "=HYPERLINK(...)" opens as text, not a formula. Ad click ids and
// browser identifiers are not exported.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  let leads;
  try {
    leads = await listLeads(parseLeadFilters(sp), 5000);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    throw e;
  }
  const csv = toCsv(
    ['Lead', 'Created (IST)', 'Last activity (IST)', 'Source', 'Status', 'Name', 'Company', 'E-mail', 'Phone', 'City', 'Value (INR)', 'utm_source', 'utm_medium', 'utm_campaign', 'Message'],
    leads.map((l) => [
      l.lead_ref,
      ist(l.created_at),
      ist(l.last_activity_at),
      SOURCE_LABEL[l.first_source] ?? l.first_source,
      l.status,
      l.full_name,
      l.company,
      l.email,
      l.phone_e164,
      l.city,
      l.value_paise != null ? l.value_paise / 100 : null,
      l.utm_source,
      l.utm_medium,
      l.utm_campaign,
      l.message,
    ]),
  );
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse('﻿' + csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="leads-${day}.csv"`,
      'cache-control': 'no-store, private',
      'x-content-type-options': 'nosniff',
    },
  });
}

function ist(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
}
