"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSwatchKit, type SwatchPick } from '@/store/useSwatchKit';

export default function SwatchButton({ pick, kitPrice, maxSwatches }: { pick: SwatchPick; kitPrice: number; maxSwatches: number }) {
  const picks = useSwatchKit((s) => s.picks);
  const add = useSwatchKit((s) => s.add);
  const remove = useSwatchKit((s) => s.remove);
  const [mounted, setMounted] = useState(false);
  const [full, setFull] = useState(false);

  // The kit lives in localStorage, so render the stored state only after mount.
  useEffect(() => setMounted(true), []);
  useEffect(() => setFull(false), [pick.id]);

  const inKit = mounted && picks.some((p) => p.id === pick.id);
  const count = mounted ? picks.length : 0;

  return (
    <div className="border-2 border-dashed border-[var(--charcoal-ink)]/40 p-4 space-y-2">
      <p className="text-sm text-[var(--charcoal-ink)]">
        Not sure about the colour or feel? Get up to {maxSwatches} swatches for ₹{kitPrice.toFixed(0)}, delivered free.
        The full amount comes back as credit on your first fabric order.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-pressed={inKit}
          onClick={() => {
            if (inKit) {
              remove(pick.id);
              setFull(false);
            } else {
              setFull(!add(pick, maxSwatches));
            }
          }}
          className="border-2 border-[var(--charcoal-ink)] px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-[var(--charcoal-ink)] hover:text-[var(--unbleached-cotton)] transition-colors"
        >
          {inKit ? `Remove ${pick.color} swatch` : `Add ${pick.color} swatch to kit`}
        </button>
        {count > 0 && (
          <Link href="/swatches" className="text-xs font-bold uppercase tracking-widest underline underline-offset-4 text-[var(--indigo-dye)]">
            View swatch kit ({count}/{maxSwatches})
          </Link>
        )}
      </div>
      <p role="status" className="text-xs text-[var(--madder-red)] min-h-4">
        {full ? `Your kit already has ${maxSwatches} swatches. Remove one to add this colour.` : ''}
      </p>
    </div>
  );
}
