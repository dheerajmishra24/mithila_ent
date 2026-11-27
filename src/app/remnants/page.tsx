import Link from 'next/link';
import type { Metadata } from 'next';
import ProductImage from '@/components/ProductImage';
import { listRemnants } from '@/lib/dal/remnants';
import { formatQuantity, lineTotal } from '@/lib/meterage';
import { getSiteUrl } from '@/lib/site-url';

export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Fabric Remnants | End-of-Roll Pieces',
  description: 'End-of-roll fabric pieces, each cut as one continuous length. Order the exact length shown to receive that piece.',
  alternates: { canonical: `${getSiteUrl()}/remnants` },
};

export default async function RemnantsPage() {
  const remnants = await listRemnants();

  return (
    <main id="main-content" className="max-w-6xl mx-auto px-4 py-10 md:py-16">
      <header className="mb-10 border-b-2 border-[var(--charcoal-ink)]/20 pb-6">
        <h1 className="font-serif text-4xl font-bold text-[var(--charcoal-ink)]">Remnants</h1>
        <p className="mt-3 max-w-2xl text-[var(--charcoal-ink)]/80">
          The last length on a roll, sold as one continuous piece. Order the exact length shown and we cut it from that piece.
          Quantities change as orders come in.
        </p>
      </header>

      {remnants.length === 0 ? (
        <p className="text-[var(--charcoal-ink)]/80">No remnants right now. Check back after our next stocktake.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {remnants.map((r) => (
            <li key={r.key} className="border-2 border-[var(--charcoal-ink)] bg-white">
              <Link href={`/product/${r.slug}`} className="block group focus-visible:outline-2 focus-visible:outline-offset-2">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <ProductImage src={r.image} alt={`${r.title}, ${r.color}`} sizes="(max-width: 640px) 100vw, 33vw" />
                </div>
                <div className="p-4">
                  <h2 className="font-serif text-lg font-bold text-[var(--charcoal-ink)] group-hover:underline underline-offset-4">{r.title}</h2>
                  <p className="text-sm text-[var(--charcoal-ink)]/75">{r.color}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm tabular-nums">
                    <div>
                      <dt className="text-[10px] uppercase tracking-widest text-[var(--charcoal-ink)]/70">Piece</dt>
                      <dd className="font-bold">{formatQuantity(r.lengthM, 'MTR')}</dd>
                    </div>
                    <div className="text-right">
                      <dt className="text-[10px] uppercase tracking-widest text-[var(--charcoal-ink)]/70">Whole piece</dt>
                      <dd className="font-bold">₹{lineTotal(r.pricePerM, r.lengthM).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</dd>
                    </div>
                  </dl>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
