import Link from 'next/link';
import { requireUserPage } from '@/lib/dal/session';
import { getMySwatchCredit } from '@/lib/dal/swatch-credit';

export const dynamic = 'force-dynamic';

const LABEL: Record<string, string> = {
  earn: 'Swatch kit paid',
  redeem: 'Used on an order',
  restore: 'Returned (order cancelled)',
  revoke: 'Removed (swatch kit cancelled)',
  adjust: 'Adjusted by Mithila',
};

export default async function SwatchCreditPage() {
  await requireUserPage('/account/credit');
  const credit = await getMySwatchCredit();
  const balance = credit?.balance ?? 0;
  const entries = credit?.entries ?? [];

  return (
    <div className="space-y-8 max-w-3xl">
      <h2 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)]">Swatch Credit</h2>

      <div className="border-4 border-double border-[var(--charcoal-ink)] bg-white p-6 shadow-[4px_4px_0_var(--turmeric)]">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--charcoal-ink)]/80">Available balance</div>
        <div className="mt-1 font-serif text-4xl font-bold text-[var(--madder-red)] tabular-nums">₹{balance.toFixed(2)}</div>
        <p className="mt-3 text-sm text-[var(--charcoal-ink)]/80">
          {balance > 0
            ? 'It comes off your next order with metre fabric at checkout.'
            : 'Order a swatch kit and the full kit price is credited here once it is paid.'}
        </p>
        <Link href={balance > 0 ? '/shop' : '/swatches'} className="mt-3 inline-block text-xs font-bold uppercase tracking-widest underline underline-offset-4 text-[var(--indigo-dye)]">
          {balance > 0 ? 'Shop fabrics' : 'Order a swatch kit'}
        </Link>
      </div>

      <section aria-labelledby="credit-history" className="space-y-3">
        <h3 id="credit-history" className="font-serif text-xl font-bold">History</h3>
        {entries.length === 0 ? (
          <p className="text-sm text-[var(--charcoal-ink)]/80">No credit activity yet.</p>
        ) : (
          <div role="region" aria-label="Swatch credit history" tabIndex={0} className="overflow-x-auto border-2 border-[var(--charcoal-ink)] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)]">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest">Date</th>
                  <th scope="col" className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest">Activity</th>
                  <th scope="col" className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-widest">Amount</th>
                  <th scope="col" className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-widest">Balance</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-[var(--charcoal-ink)]/10">
                    <td className="px-3 py-2 tabular-nums">{new Date(e.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                    <td className="px-3 py-2">
                      {LABEL[e.entry] ?? e.entry}
                      {e.orderRef && <span className="ml-2 font-mono text-xs text-[var(--charcoal-ink)]/80">#{e.orderRef}</span>}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-bold ${e.amount > 0 ? 'text-green-800' : 'text-[var(--charcoal-ink)]'}`}>
                      {e.amount > 0 ? '+' : '−'}₹{Math.abs(e.amount).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">₹{e.balanceAfter.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
