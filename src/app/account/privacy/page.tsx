import Link from 'next/link';
import { requireUserPage } from '@/lib/dal/session';
import { CONSENT_PURPOSES, REQUEST_KIND_LABEL, REQUEST_STATUS_LABEL, getMyPrivacy } from '@/lib/dal/privacy';
import { ConsentSwitch, RequestForm, WithdrawButton } from './PrivacyForms';

export const dynamic = 'force-dynamic';

const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

export default async function PrivacyCentrePage() {
  await requireUserPage('/account/privacy');
  const { consents, requests } = await getMyPrivacy();
  const officer = process.env.GRIEVANCE_OFFICER_NAME;
  const officerEmail = process.env.GRIEVANCE_OFFICER_EMAIL;

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h2 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)]">Privacy Centre</h2>
        <p className="mt-2 text-sm text-[var(--charcoal-ink)]/80">
          Choose what we may use your details for, download what we hold, or ask us to correct or delete it.
          Read the full <Link href="/legal/privacy-policy" className="underline underline-offset-4">privacy policy</Link>.
        </p>
      </div>

      <section aria-labelledby="privacy-choices" className="border-2 border-[var(--charcoal-ink)] bg-white p-5">
        <h3 id="privacy-choices" className="font-serif text-xl font-bold">Your choices</h3>
        <p className="mt-1 text-xs text-[var(--charcoal-ink)]/80">Each one is separate and off until you turn it on. You can change them at any time.</p>
        <div className="mt-2">
          {CONSENT_PURPOSES.map((p) => (
            <ConsentSwitch key={p.id} purpose={p.id} title={p.title} body={p.body} granted={consents[p.id]?.granted ?? false} />
          ))}
        </div>
      </section>

      <section aria-labelledby="privacy-download" className="border-2 border-[var(--charcoal-ink)] bg-white p-5">
        <h3 id="privacy-download" className="font-serif text-xl font-bold">Download your data</h3>
        <p className="mt-1 text-sm text-[var(--charcoal-ink)]/80">
          A file with your account, addresses, orders, swatch credit, enquiries and the choices above.
        </p>
        {/* A plain link: the route sends a file download. */}
        <a href="/account/privacy/export" className="mt-3 inline-flex min-h-11 items-center border-2 border-[var(--charcoal-ink)] px-5 text-xs font-bold uppercase tracking-widest hover:bg-[var(--charcoal-ink)] hover:text-white">
          Download (JSON)
        </a>
      </section>

      <section aria-labelledby="privacy-request" className="border-2 border-[var(--charcoal-ink)] bg-white p-5">
        <h3 id="privacy-request" className="font-serif text-xl font-bold">Correct, complain or delete</h3>
        <p className="mt-1 mb-4 text-sm text-[var(--charcoal-ink)]/80">
          You can change your name, phone and addresses yourself on <Link href="/account/profile" className="underline underline-offset-4">Profile Details</Link>.
          For anything else, send us a request; we reply by e-mail within 30 days.
        </p>
        <RequestForm />
      </section>

      {requests.length > 0 && (
        <section aria-labelledby="privacy-history">
          <h3 id="privacy-history" className="font-serif text-xl font-bold">Your requests</h3>
          <ul className="mt-3 divide-y divide-[var(--charcoal-ink)]/10 border-2 border-[var(--charcoal-ink)] bg-white">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
                <div>
                  <div className="font-bold">{REQUEST_KIND_LABEL[r.kind] ?? r.kind}</div>
                  <div className="font-mono text-xs text-[var(--charcoal-ink)]/80">{r.ref} · sent {day(r.createdAt)}</div>
                  {r.resolution && <p className="mt-1 text-xs">{r.resolution}</p>}
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-widest">{REQUEST_STATUS_LABEL[r.status] ?? r.status}</div>
                  {r.status === 'open' && <WithdrawButton id={r.id} refCode={r.ref} />}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="privacy-officer" className="text-sm text-[var(--charcoal-ink)]/80">
        <h3 id="privacy-officer" className="font-serif text-lg font-bold text-[var(--charcoal-ink)]">Grievance officer</h3>
        {officer && officerEmail ? (
          <p className="mt-1">{officer} · <a className="underline underline-offset-4" href={`mailto:${officerEmail}`}>{officerEmail}</a></p>
        ) : (
          <p className="mt-1">Use the complaint option above, or write to us through the <Link href="/contact" className="underline underline-offset-4">contact page</Link>.</p>
        )}
      </section>
    </div>
  );
}
