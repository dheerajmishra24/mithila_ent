import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAdminPage } from '@/lib/dal/session';
import { SOURCE_LABEL, getLead } from '@/lib/dal/leads';
import { LeadStatusForm, MergeForm } from './LeadForms';

export const dynamic = 'force-dynamic';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

function describeEvent(e: { kind: string; source: string; detail: Record<string, unknown> }): string {
  const d = e.detail ?? {};
  switch (e.kind) {
    case 'submission': return `Enquiry via ${SOURCE_LABEL[e.source] ?? e.source}`;
    case 'status': return `Status ${String(d.from)} → ${String(d.to)}`;
    case 'merge': return `Merged ${String(d.merged_ref ?? 'a duplicate')} into this lead`;
    case 'conversion': return `${d.platform === 'google' ? 'Google' : 'Meta'} conversion (${String(d.stage)}) ${d.ok ? 'sent' : 'failed'}`;
    default: return e.kind;
  }
}

function answersOf(detail: Record<string, unknown>): { q: string; a: string }[] {
  const a = detail?.answers;
  return Array.isArray(a) ? (a as { q: string; a: string }[]).filter((x) => x && typeof x.q === 'string' && typeof x.a === 'string') : [];
}

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage();
  const { id } = await params;
  const mergedParam = (await searchParams).merged;
  const mergedRef = typeof mergedParam === 'string' && /^L-\d{6}$/.test(mergedParam) ? mergedParam : null;
  const found = await getLead(id);
  if (!found) notFound();
  const { lead, events, conversions, duplicates } = found;
  if (lead.merged_into) redirect(`/admin/leads/${lead.merged_into}`);

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="border-b-2 border-[var(--charcoal-ink)]/20 pb-4">
        <Link href="/admin/leads" className="text-xs underline">← All leads</Link>
        <h1 className="mt-2 font-serif text-3xl font-bold text-[var(--charcoal-ink)]">{lead.full_name || lead.company || 'Unnamed lead'}</h1>
        <p className="mt-1 font-mono text-sm opacity-80">
          {lead.lead_ref} · {SOURCE_LABEL[lead.first_source] ?? lead.first_source}{lead.is_test ? ' · TEST LEAD' : ''}
        </p>
      </div>

      {mergedRef && (
        <p role="status" className="border-2 border-[var(--indigo-dye)] bg-white p-3 text-sm font-bold">
          Merged {mergedRef} into this lead.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="lead-contact" className="border-2 border-[var(--charcoal-ink)] bg-white p-5 shadow-[4px_4px_0_var(--charcoal-ink)] lg:col-span-2">
          <h2 id="lead-contact" className="font-serif text-xl font-bold">Contact</h2>
          <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="opacity-70">E-mail</dt><dd className="break-all">{lead.email ? <a className="underline" href={`mailto:${lead.email}`}>{lead.email}</a> : '—'}</dd>
            <dt className="opacity-70">Phone</dt><dd>{lead.phone_e164 ? <a className="underline" href={`tel:${lead.phone_e164}`}>{lead.phone_e164}</a> : '—'}</dd>
            <dt className="opacity-70">Company</dt><dd>{lead.company ?? '—'}</dd>
            <dt className="opacity-70">City</dt><dd>{lead.city ?? '—'}</dd>
            <dt className="opacity-70">First seen</dt><dd>{when(lead.created_at)}</dd>
            <dt className="opacity-70">Campaign</dt>
            <dd>{[lead.utm_source, lead.utm_medium, lead.utm_campaign, lead.utm_term, lead.utm_content].filter(Boolean).join(' / ') || '—'}</dd>
            <dt className="opacity-70">Ad reporting</dt>
            <dd>
              {lead.ad_consent ? 'Allowed' : 'Not allowed (no consent)'}
              {lead.ad_consent && ` · ${[lead.has_google_click && 'Google click', lead.has_meta_signal && 'Meta'].filter(Boolean).join(', ') || 'no ad click recorded'}`}
            </dd>
          </dl>
          {lead.message && (
            <>
              <h3 className="mt-5 text-[10px] font-bold uppercase tracking-widest">Latest message</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm">{lead.message}</p>
            </>
          )}
        </section>

        <section aria-labelledby="lead-stage" className="border-2 border-[var(--charcoal-ink)] bg-white p-5 shadow-[4px_4px_0_var(--charcoal-ink)]">
          <h2 id="lead-stage" className="font-serif text-xl font-bold">Stage</h2>
          <LeadStatusForm
            leadId={lead.id}
            status={lead.status}
            valueRupees={lead.value_paise != null ? (lead.value_paise / 100).toFixed(2) : ''}
            notes={lead.notes ?? ''}
          />
          {conversions.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs">
              {conversions.map((c) => (
                <li key={`${c.platform}-${c.stage}`}>
                  {c.platform === 'google' ? 'Google' : 'Meta'} · {c.stage}: <strong>{c.status === 'pending' ? 'queued' : c.status}</strong>
                  {c.status !== 'sent' && c.last_error ? <span className="block opacity-70">{c.last_error}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {duplicates.length > 0 && (
        <section aria-labelledby="lead-dupes" className="border-2 border-[var(--madder-red)] bg-white p-5">
          <h2 id="lead-dupes" className="font-serif text-xl font-bold">Possible duplicates</h2>
          <p className="mt-1 text-xs opacity-80">Same e-mail, phone or name. Merging moves the other lead&apos;s history here; nothing is deleted.</p>
          <ul className="mt-3 divide-y divide-[var(--charcoal-ink)]/10">
            {duplicates.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <Link href={`/admin/leads/${d.id}`} className="font-bold underline">{d.full_name || d.company || 'Unnamed'}</Link>
                  <span className="ml-2 font-mono text-xs">{d.lead_ref}</span>
                  <div className="text-xs opacity-80">{[d.email, d.phone_e164, SOURCE_LABEL[d.first_source]].filter(Boolean).join(' · ')}</div>
                </div>
                <MergeForm keep={lead.id} drop={d.id} dropRef={d.lead_ref} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="lead-history" className="border-2 border-[var(--charcoal-ink)] bg-white p-5">
        <h2 id="lead-history" className="font-serif text-xl font-bold">History</h2>
        <ol className="mt-3 space-y-4">
          {events.map((e) => (
            <li key={e.id} className="border-l-2 border-[var(--turmeric)] pl-3 text-sm">
              <div className="font-bold">{describeEvent(e)}</div>
              <div className="text-xs opacity-70">{when(e.created_at)}</div>
              {answersOf(e.detail).length > 0 && (
                <dl className="mt-1 grid grid-cols-[minmax(6rem,12rem)_1fr] gap-x-3 text-xs">
                  {answersOf(e.detail).map((a, i) => (
                    <div key={i} className="contents"><dt className="opacity-70">{a.q}</dt><dd>{a.a}</dd></div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
