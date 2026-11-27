import Link from 'next/link';
import { requireAdminPage } from '@/lib/dal/session';
import { REQUEST_KIND_LABEL, REQUEST_STATUS_LABEL, listEmailSuppressions, listPrivacyRequests } from '@/lib/dal/privacy';
import { EraseForm, PrivacyAnnouncer, RequestUpdateForm, UnsuppressForm } from './PrivacyAdminForms';

export const dynamic = 'force-dynamic';

const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

export default async function AdminPrivacyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage();
  const show = (await searchParams).show === 'all' ? 'all' : 'open';
  const [requests, suppressions] = await Promise.all([listPrivacyRequests(show), listEmailSuppressions()]);
  const overdue = requests.filter((r) => r.overdue).length;

  return (
    <div className="space-y-8 p-4 md:p-8">
      <PrivacyAnnouncer>
      <div className="border-b-2 border-[var(--charcoal-ink)]/20 pb-4">
        <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)]">Privacy</h1>
        <p className="mt-1 text-sm opacity-80">Requests from customers about their data, and e-mail addresses we have stopped writing to.</p>
      </div>

      <section aria-labelledby="privacy-queue" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="privacy-queue" className="font-serif text-xl font-bold">
            Requests {show === 'open' ? 'to handle' : '(all)'}
            {overdue > 0 && <span className="ml-2 text-sm text-[var(--madder-red)]">{overdue} overdue</span>}
          </h2>
          <Link href={show === 'open' ? '/admin/privacy?show=all' : '/admin/privacy'} className="text-xs underline underline-offset-4">
            {show === 'open' ? 'Show closed too' : 'Show open only'}
          </Link>
        </div>
        {requests.length === 0 ? (
          <p className="text-sm opacity-80">Nothing waiting.</p>
        ) : (
          <ul className="space-y-4">
            {requests.map((r) => (
              <li key={r.id} className={`border-2 bg-white p-4 ${r.overdue ? 'border-[var(--madder-red)]' : 'border-[var(--charcoal-ink)]'}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="font-bold">{REQUEST_KIND_LABEL[r.kind] ?? r.kind}</span>
                    <span className="ml-2 font-mono text-xs">{r.ref}</span>
                  </div>
                  <div className="text-xs">
                    <strong className="uppercase tracking-widest">{REQUEST_STATUS_LABEL[r.status] ?? r.status}</strong>
                    {' · '}received {day(r.createdAt)}
                    {['open', 'in_progress'].includes(r.status) && <> · reply by <span className={r.overdue ? 'font-bold text-[var(--madder-red)]' : ''}>{day(r.dueAt)}</span></>}
                  </div>
                </div>
                <div className="mt-1 text-sm">
                  {r.contactEmail ? <a href={`mailto:${r.contactEmail}`} className="underline">{r.contactEmail}</a> : <span className="opacity-70">Contact details removed</span>}
                  {!r.hasAccount && <span className="ml-2 text-xs opacity-70">(account deleted)</span>}
                </div>
                {r.details && <p className="mt-2 whitespace-pre-wrap text-sm">{r.details}</p>}
                {r.resolution && <p className="mt-2 text-xs opacity-80">{r.resolution}</p>}
                {['open', 'in_progress'].includes(r.status) && (
                  <div className="mt-3 space-y-3">
                    <RequestUpdateForm id={r.id} refCode={r.ref} kind={r.kind} />
                    {r.kind === 'erasure' && r.hasAccount && <EraseForm id={r.id} refCode={r.ref} />}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="email-suppressed" className="space-y-3">
        <h2 id="email-suppressed" className="font-serif text-xl font-bold">E-mail addresses on hold</h2>
        <p className="text-xs opacity-80">
          Order e-mails to these addresses are not sent: the mailbox rejected our mail (bounce) or the person marked it as spam
          (complaint). Allow an address again only after the customer confirms it works.
        </p>
        {suppressions.length === 0 ? (
          <p className="text-sm opacity-80">None.</p>
        ) : (
          <div role="region" aria-label="E-mail addresses on hold" tabIndex={0} className="overflow-x-auto border-2 border-[var(--charcoal-ink)] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)]">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-[11px] uppercase tracking-widest">Address</th>
                  <th scope="col" className="px-3 py-2 text-left text-[11px] uppercase tracking-widest">Why</th>
                  <th scope="col" className="px-3 py-2 text-left text-[11px] uppercase tracking-widest">Since</th>
                  <th scope="col" className="px-3 py-2 text-left text-[11px] uppercase tracking-widest"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {suppressions.map((s) => (
                  <tr key={s.email} className="border-t border-[var(--charcoal-ink)]/10">
                    <td className="break-all px-3 py-2">{s.email}</td>
                    <td className="px-3 py-2">{s.reason === 'complaint' ? 'Marked as spam' : 'Bounced'}{s.detail ? <span className="block text-xs opacity-70">{s.detail}</span> : null}</td>
                    <td className="px-3 py-2 tabular-nums">{day(s.createdAt)}</td>
                    <td className="px-3 py-2"><UnsuppressForm email={s.email} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </PrivacyAnnouncer>
    </div>
  );
}
