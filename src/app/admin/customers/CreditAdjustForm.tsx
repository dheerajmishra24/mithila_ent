"use client";

import { useActionState } from 'react';
import { adjustSwatchCredit, type SwatchAdminState } from '@/actions/swatches';

const field = 'mt-1 block w-full border-2 border-[var(--charcoal-ink)] bg-white px-2 py-2 text-sm font-normal normal-case tracking-normal';
const lbl = 'block text-xs font-bold uppercase tracking-widest';

export default function CreditAdjustForm({ customers }: { customers: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<SwatchAdminState, FormData>(adjustSwatchCredit, undefined);
  return (
    <form action={action} className="bg-white border-2 border-[var(--charcoal-ink)] p-4 md:p-6 shadow-[4px_4px_0_var(--charcoal-ink)] space-y-4">
      <h2 className="font-serif text-xl font-bold">Adjust swatch credit</h2>
      <p className="text-sm text-[var(--charcoal-ink)]/80">
        For goodwill credit or a correction. Use a negative amount to remove credit; a balance never goes below zero.
        Every change is recorded with your name and the reason.
      </p>
      <div className="grid gap-4 md:grid-cols-4">
        <label className={`${lbl} md:col-span-2`}>
          Customer
          <select name="userId" required defaultValue="" className={field}>
            <option value="" disabled>Choose a customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className={lbl}>
          Amount (₹)
          <input name="amount" type="number" step="0.01" required className={field} />
        </label>
        <label className={lbl}>
          Reason
          <input name="note" required minLength={3} maxLength={200} className={field} />
        </label>
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] px-4 py-2 text-xs font-bold uppercase tracking-widest disabled:opacity-60">
          {pending ? 'Saving…' : 'Save adjustment'}
        </button>
        <p role="status" className={`text-sm font-bold ${state?.error ? 'text-[var(--madder-red)]' : 'text-green-800'}`}>
          {state?.error ?? state?.ok ?? ''}
        </p>
      </div>
    </form>
  );
}
