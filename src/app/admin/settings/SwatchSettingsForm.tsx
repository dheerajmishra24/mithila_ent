"use client";

import { useActionState } from 'react';
import { updateSwatchSettings, type SwatchAdminState } from '@/actions/swatches';

const field = 'mt-1 block w-full border-2 border-[var(--charcoal-ink)] bg-white px-2 py-2 text-sm font-normal normal-case tracking-normal';
const lbl = 'block text-xs font-bold uppercase tracking-widest';

export default function SwatchSettingsForm({ enabled, kitPrice, maxSwatches }: { enabled: boolean; kitPrice: number; maxSwatches: number }) {
  const [state, action, pending] = useActionState<SwatchAdminState, FormData>(updateSwatchSettings, undefined);
  return (
    <form action={action} className="bg-white border-2 border-[var(--charcoal-ink)] p-8 space-y-4">
      <h2 className="font-serif text-xl font-bold">Swatch kits</h2>
      <p className="text-sm text-[var(--charcoal-ink)]/80">
        The kit price includes GST and delivery. When a kit is paid, the customer gets the same amount as swatch credit.
      </p>
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="w-4 h-4" />
        Offer swatch kits on product pages
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className={lbl}>
          Kit price (₹)
          <input name="kitPrice" type="number" step="0.01" min="1" max="10000" required defaultValue={kitPrice} className={field} />
        </label>
        <label className={lbl}>
          Swatches per kit
          <input name="maxSwatches" type="number" step="1" min="1" max="20" required defaultValue={maxSwatches} className={field} />
        </label>
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] px-4 py-2 text-xs font-bold uppercase tracking-widest disabled:opacity-60">
          {pending ? 'Saving…' : 'Save swatch settings'}
        </button>
        <p role="status" className={`text-sm font-bold ${state?.error ? 'text-[var(--madder-red)]' : 'text-green-800'}`}>
          {state?.error ?? state?.ok ?? ''}
        </p>
      </div>
    </form>
  );
}
