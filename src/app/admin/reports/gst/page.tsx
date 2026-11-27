import Link from 'next/link';
import { requireAdminPage } from '@/lib/dal/session';
import { gstReport, currentMonthIst, MONTH_RE } from '@/lib/dal/gst-report';

export const dynamic = 'force-dynamic';

const inr = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rate = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(2)}%`;

const th = 'px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest';
const thR = `${th} text-right`;
const td = 'px-3 py-2';
const tdR = 'px-3 py-2 text-right tabular-nums';

function ExportLink({ month, part, label }: { month: string; part: string; label: string }) {
  return (
    <a
      href={`/admin/reports/gst/export?month=${month}&part=${part}`}
      className="inline-block border-2 border-[var(--charcoal-ink)] px-3 py-1.5 text-xs font-bold uppercase tracking-widest hover:bg-[var(--charcoal-ink)] hover:text-[var(--unbleached-cotton)]"
    >
      {label}
    </a>
  );
}

export default async function GstReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const month = sp.month && MONTH_RE.test(sp.month) ? sp.month : currentMonthIst();
  const report = await gstReport(month);
  const { totals } = report;

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="border-b-2 border-[var(--charcoal-ink)]/20 pb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)]">GST Liability</h1>
          <p className="font-sans text-sm opacity-70 mt-1 uppercase tracking-widest">
            Invoices dated {report.from} to {report.to} (IST)
          </p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <label className="text-xs font-bold uppercase tracking-widest" htmlFor="gst-month">
            Month
            <input
              id="gst-month"
              type="month"
              name="month"
              defaultValue={month}
              className="mt-1 block border-2 border-[var(--charcoal-ink)] bg-white px-2 py-1.5 text-sm font-normal normal-case tracking-normal"
            />
          </label>
          <button type="submit" className="bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] px-4 py-2 text-xs font-bold uppercase tracking-widest">
            Show
          </button>
        </form>
      </div>

      {report.missingHsn > 0 && (
        <div role="alert" className="border-2 border-[var(--madder-red)] bg-white p-4 text-sm">
          Some invoiced lines have no HSN code. Add HSN codes to those products in{' '}
          <Link href="/admin/products" className="underline font-bold">Products</Link>; new orders will pick them up.
        </div>
      )}

      <section aria-labelledby="gst-net" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <h2 id="gst-net" className="sr-only">Net liability</h2>
        {[
          ['Taxable value', totals.taxableValue],
          ['CGST', totals.cgst],
          ['SGST', totals.sgst],
          ['IGST', totals.igst],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-white border-2 border-[var(--charcoal-ink)] p-4 shadow-[4px_4px_0_var(--charcoal-ink)]">
            <div className="text-[11px] font-bold uppercase tracking-widest opacity-70">{label}</div>
            <div className="mt-1 text-xl font-bold tabular-nums">₹{inr(value as number)}</div>
          </div>
        ))}
      </section>

      <section aria-labelledby="gst-outward" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="gst-outward" className="font-serif text-xl font-bold">Outward supplies by place of supply</h2>
          <ExportLink month={month} part="outward" label="Download CSV" />
        </div>
        <div role="region" aria-label="Outward supplies table" tabIndex={0} className="overflow-x-auto bg-white border-2 border-[var(--charcoal-ink)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)]">
              <tr>
                <th scope="col" className={th}>Type</th>
                <th scope="col" className={th}>Place of supply</th>
                <th scope="col" className={thR}>Rate</th>
                <th scope="col" className={thR}>Invoices</th>
                <th scope="col" className={thR}>Taxable</th>
                <th scope="col" className={thR}>CGST</th>
                <th scope="col" className={thR}>SGST</th>
                <th scope="col" className={thR}>IGST</th>
              </tr>
            </thead>
            <tbody>
              {report.outward.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center opacity-70">No invoices in this month.</td></tr>
              ) : (
                report.outward.map((r, i) => (
                  <tr key={i} className="border-t border-[var(--charcoal-ink)]/10">
                    <td className={td}>{r.kind === 'supply' ? 'Supply' : 'Cancelled after invoice'}</td>
                    <td className={td}>{r.stateName} ({r.placeOfSupply})</td>
                    <td className={tdR}>{rate(r.gstRate)}</td>
                    <td className={tdR}>{r.invoices}</td>
                    <td className={tdR}>{inr(r.taxableValue)}</td>
                    <td className={tdR}>{inr(r.cgst)}</td>
                    <td className={tdR}>{inr(r.sgst)}</td>
                    <td className={tdR}>{inr(r.igst)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="gst-hsn" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="gst-hsn" className="font-serif text-xl font-bold">HSN summary</h2>
          <ExportLink month={month} part="hsn" label="Download HSN CSV" />
        </div>
        <div role="region" aria-label="HSN summary table" tabIndex={0} className="overflow-x-auto bg-white border-2 border-[var(--charcoal-ink)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)]">
              <tr>
                <th scope="col" className={th}>HSN</th>
                <th scope="col" className={th}>UQC</th>
                <th scope="col" className={thR}>Rate</th>
                <th scope="col" className={thR}>Quantity</th>
                <th scope="col" className={thR}>Taxable</th>
                <th scope="col" className={thR}>CGST</th>
                <th scope="col" className={thR}>SGST</th>
                <th scope="col" className={thR}>IGST</th>
              </tr>
            </thead>
            <tbody>
              {report.hsn.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center opacity-70">No invoiced lines in this month.</td></tr>
              ) : (
                report.hsn.map((r, i) => (
                  <tr key={i} className="border-t border-[var(--charcoal-ink)]/10">
                    <td className={`${td} font-mono ${r.hsnCode === 'MISSING' ? 'font-bold text-red-700' : ''}`}>{r.hsnCode}</td>
                    <td className={td}>{r.uqc}</td>
                    <td className={tdR}>{rate(r.gstRate)}</td>
                    <td className={tdR}>{r.quantity}</td>
                    <td className={tdR}>{inr(r.taxableValue)}</td>
                    <td className={tdR}>{inr(r.cgst)}</td>
                    <td className={tdR}>{inr(r.sgst)}</td>
                    <td className={tdR}>{inr(r.igst)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="gst-b2b" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="gst-b2b" className="font-serif text-xl font-bold">B2B invoices (buyer GSTIN)</h2>
          <ExportLink month={month} part="b2b" label="Download B2B CSV" />
        </div>
        <div role="region" aria-label="B2B invoices table" tabIndex={0} className="overflow-x-auto bg-white border-2 border-[var(--charcoal-ink)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)]">
              <tr>
                <th scope="col" className={th}>Invoice</th>
                <th scope="col" className={th}>Date</th>
                <th scope="col" className={th}>Buyer GSTIN</th>
                <th scope="col" className={th}>POS</th>
                <th scope="col" className={thR}>Taxable</th>
                <th scope="col" className={thR}>CGST</th>
                <th scope="col" className={thR}>SGST</th>
                <th scope="col" className={thR}>IGST</th>
              </tr>
            </thead>
            <tbody>
              {report.b2b.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center opacity-70">No B2B invoices in this month.</td></tr>
              ) : (
                report.b2b.map((r) => (
                  <tr key={r.invoiceNumber} className="border-t border-[var(--charcoal-ink)]/10">
                    <td className={`${td} font-mono`}>{r.invoiceNumber}</td>
                    <td className={`${td} tabular-nums`}>{new Date(r.invoiceDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                    <td className={`${td} font-mono`}>{r.buyerGstin}</td>
                    <td className={td}>{r.placeOfSupply}</td>
                    <td className={tdR}>{inr(r.taxableValue)}</td>
                    <td className={tdR}>{inr(r.cgst)}</td>
                    <td className={tdR}>{inr(r.sgst)}</td>
                    <td className={tdR}>{inr(r.igst)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs opacity-70 max-w-3xl">
        Figures come from the GST stored on each invoice line at checkout. Shipping charges are not taxed here;
        confirm that treatment and the HSN codes with your CA before filing.
      </p>
    </div>
  );
}
