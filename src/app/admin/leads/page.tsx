import Link from 'next/link';
import { requireAdminPage } from '@/lib/dal/session';
import { LEAD_SOURCES, LEAD_STATUSES, SOURCE_LABEL, listLeads, parseLeadFilters, pipelineSummary } from '@/lib/dal/leads';
import RetryInboxButton from './RetryInboxButton';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-[var(--turmeric)]/30',
  contacted: 'bg-[var(--indigo-dye)]/10',
  qualified: 'bg-[var(--indigo-dye)]/25',
  won: 'bg-green-100',
  lost: 'bg-zinc-100',
  spam: 'bg-red-50',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export default async function AdminLeads({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage();
  const filters = parseLeadFilters(await searchParams);
  const [leads, summary] = await Promise.all([listLeads(filters), pipelineSummary()]);

  const qs = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { status: filters.status, source: filters.source, q: filters.q, test: filters.test ? '1' : null, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[var(--charcoal-ink)]/20 pb-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)]">Leads</h1>
          <p className="font-sans text-sm opacity-70 mt-1 uppercase tracking-widest">Contact, wholesale, Meta and Google enquiries in one pipeline</p>
        </div>
        <a
          href={`/admin/leads/export${qs({})}`}
          className="border-2 border-[var(--charcoal-ink)] bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest shadow-[3px_3px_0_var(--charcoal-ink)] hover:bg-[var(--charcoal-ink)] hover:text-white"
        >
          Export CSV
        </a>
      </div>

      {/* Pipeline */}
      <nav aria-label="Pipeline stages" className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {LEAD_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/leads${qs({ status: filters.status === s ? null : s })}`}
            aria-current={filters.status === s ? 'true' : undefined}
            className={`border-2 border-[var(--charcoal-ink)] p-3 shadow-[3px_3px_0_var(--charcoal-ink)] ${filters.status === s ? 'bg-[var(--charcoal-ink)] text-white' : 'bg-white'}`}
          >
            <div className="text-[10px] font-bold uppercase tracking-widest">{s}</div>
            <div className="font-serif text-2xl font-bold tabular-nums">{summary.byStatus[s]}</div>
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="border border-[var(--charcoal-ink)]/30 bg-white px-3 py-2">
          Ad conversions: {summary.conversions.sent} sent · {summary.conversions.pending} queued · {summary.conversions.failed} failed
        </span>
        {summary.inboxWaiting > 0 && (
          <span role="status" className="flex items-center gap-3 border-2 border-[var(--madder-red)] bg-white px-3 py-2">
            {summary.inboxWaiting} Meta lead{summary.inboxWaiting > 1 ? 's' : ''} waiting to be fetched
            {summary.inboxTokenProblem > 0 ? ' (the Meta Page token needs replacing)' : ''}
            <RetryInboxButton />
          </span>
        )}
      </div>

      {/* Filters */}
      <form method="get" className="flex flex-wrap items-end gap-3 border-2 border-[var(--charcoal-ink)] bg-white p-4">
        {filters.status && <input type="hidden" name="status" value={filters.status} />}
        <div className="flex flex-col gap-1">
          <label htmlFor="lead-q" className="text-[10px] font-bold uppercase tracking-widest">Search</label>
          <input id="lead-q" name="q" defaultValue={filters.q ?? ''} placeholder="Name, e-mail, phone, company, L-000123" className="sonic-input min-w-[16rem]" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="lead-source" className="text-[10px] font-bold uppercase tracking-widest">Source</label>
          <select id="lead-source" name="source" defaultValue={filters.source ?? ''} className="sonic-input">
            <option value="">All sources</option>
            {LEAD_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <input id="lead-test" type="checkbox" name="test" value="1" defaultChecked={filters.test} className="h-4 w-4" />
          <label htmlFor="lead-test" className="text-xs">Show test leads only</label>
        </div>
        <button type="submit" className="border-2 border-[var(--charcoal-ink)] px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-[var(--charcoal-ink)] hover:text-white">Filter</button>
        {(filters.q || filters.source || filters.status || filters.test) && (
          <Link href="/admin/leads" className="pb-2 text-xs underline">Clear</Link>
        )}
      </form>

      {leads.length === 0 ? (
        <div className="border-2 border-[var(--charcoal-ink)] bg-white p-8 text-center opacity-70">No leads match.</div>
      ) : (
        <div className="overflow-x-auto border-2 border-[var(--charcoal-ink)] bg-white shadow-[4px_4px_0_var(--charcoal-ink)]">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Leads, most recent activity first</caption>
            <thead>
              <tr className="border-b-2 border-[var(--charcoal-ink)] text-[10px] uppercase tracking-widest">
                <th scope="col" className="p-3">Lead</th>
                <th scope="col" className="p-3">Contact</th>
                <th scope="col" className="p-3">Source</th>
                <th scope="col" className="p-3">Status</th>
                <th scope="col" className="p-3">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-[var(--charcoal-ink)]/10 align-top hover:bg-[var(--unbleached-cotton)]">
                  <td className="p-3">
                    <Link href={`/admin/leads/${l.id}`} className="font-bold underline-offset-2 hover:underline">
                      {l.full_name || l.company || 'Unnamed'}
                    </Link>
                    <div className="font-mono text-xs opacity-80">{l.lead_ref}{l.company && l.full_name ? ` · ${l.company}` : ''}</div>
                  </td>
                  <td className="p-3 text-xs">
                    <div className="break-all">{l.email ?? '—'}</div>
                    <div className="opacity-80">{l.phone_e164 ?? ''}</div>
                  </td>
                  <td className="p-3 text-xs">
                    {SOURCE_LABEL[l.first_source] ?? l.first_source}
                    {l.utm_campaign && <div className="opacity-80">{l.utm_campaign}</div>}
                  </td>
                  <td className="p-3">
                    <span className={`border border-[var(--charcoal-ink)]/30 px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${STATUS_STYLE[l.status]}`}>{l.status}</span>
                  </td>
                  <td className="p-3 text-xs tabular-nums">{when(l.last_activity_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
