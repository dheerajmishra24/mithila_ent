import type { Metadata } from 'next';
import { getSwatchSettings } from '@/lib/dal/swatch-credit';
import { getSessionUser } from '@/lib/dal/session';
import SwatchKitClient from './SwatchKitClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Swatch Kit | Mithila Enterprises',
  description: 'Order fabric swatches to check colour and hand-feel. The kit price comes back as credit on your first fabric order.',
  robots: { index: false, follow: true },
};

export default async function SwatchesPage() {
  const [settings, user] = await Promise.all([getSwatchSettings(), getSessionUser()]);
  return (
    <main className="flex-grow pt-32 pb-16">
      <div className="container mx-auto px-4 md:px-8 max-w-4xl space-y-8">
        <div className="border-b-2 border-[var(--charcoal-ink)]/20 pb-4">
          <h1 className="font-serif text-4xl font-bold text-[var(--charcoal-ink)]">Your Swatch Kit</h1>
          <p className="mt-2 text-sm text-[var(--charcoal-ink)]/80 max-w-2xl">
            Up to {settings.maxSwatches} fabric swatches for ₹{settings.kitPrice.toFixed(0)}, delivered free.
            Once the kit is paid, the full ₹{settings.kitPrice.toFixed(0)} is added to your account as swatch credit
            and comes off your next fabric order.
          </p>
        </div>
        {settings.enabled ? (
          <SwatchKitClient kitPrice={settings.kitPrice} maxSwatches={settings.maxSwatches} signedIn={Boolean(user)} />
        ) : (
          <p className="border-2 border-[var(--charcoal-ink)] bg-white p-6">Swatch kits are not available right now.</p>
        )}
      </div>
    </main>
  );
}
