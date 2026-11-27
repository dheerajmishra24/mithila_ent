"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSwatchKit } from '@/store/useSwatchKit';
import { INDIAN_STATES } from '@/lib/gst';
import { payWithRazorpay } from '@/lib/payments/razorpay-client';
import { createSwatchOrder } from '@/actions/swatches';

const input = 'w-full border-2 border-[var(--charcoal-ink)] bg-white p-3 font-sans';
const label = 'block font-sans text-xs font-bold uppercase tracking-widest text-[var(--charcoal-ink)] mb-2';

export default function SwatchKitClient({ kitPrice, maxSwatches, signedIn }: { kitPrice: number; maxSwatches: number; signedIn: boolean }) {
  const router = useRouter();
  const picks = useSwatchKit((s) => s.picks);
  const remove = useSwatchKit((s) => s.remove);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idemKey = useRef<string | null>(null);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  if (picks.length === 0) {
    return (
      <div className="border-2 border-[var(--charcoal-ink)] bg-white p-6 space-y-3">
        <p>Your swatch kit is empty.</p>
        <p className="text-sm text-[var(--charcoal-ink)]/80">
          Open any fabric and choose <strong>Add swatch to kit</strong> for each colour you want to see.
        </p>
        <Link href="/shop" className="inline-block underline underline-offset-4 font-bold">Browse fabrics</Link>
      </div>
    );
  }

  const tooMany = picks.length > maxSwatches;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const shipping = {
      firstName: f.get('firstName'),
      lastName: f.get('lastName'),
      email: f.get('email'),
      address1: f.get('address1'),
      address2: f.get('address2'),
      city: f.get('city'),
      state: f.get('state'),
      pinCode: f.get('pinCode'),
      gstin: String(f.get('gstin') ?? '').trim().toUpperCase(),
    };
    if (!idemKey.current) idemKey.current = crypto.randomUUID();
    const result = await createSwatchOrder(picks.map((p) => p.id), shipping, idemKey.current);
    if (!result.success) {
      setError(result.error);
      setBusy(false);
      return;
    }
    idemKey.current = null;
    const done = () => {
      useSwatchKit.getState().clear();
      router.push('/checkout/success?orderId=' + result.orderId);
    };
    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      done();
      return;
    }
    await payWithRazorpay({
      orderId: result.orderId,
      shipping,
      description: 'Swatch kit',
      onPaid: done,
      onError: (message) => {
        setError(message);
        setBusy(false);
      },
      onDismiss: () => setBusy(false),
    });
  };

  return (
    <div className="grid gap-8 md:grid-cols-5">
      <section aria-labelledby="kit-list" className="md:col-span-2 space-y-3">
        <h2 id="kit-list" className="font-serif text-xl font-bold">
          {picks.length} of {maxSwatches} swatches
        </h2>
        <ul className="space-y-2">
          {picks.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 border-2 border-[var(--charcoal-ink)] bg-white p-3">
              <span>
                <span className="font-bold">{p.title}</span>
                <span className="block text-sm text-[var(--charcoal-ink)]/80">{p.color}</span>
              </span>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="text-xs font-bold uppercase tracking-widest underline underline-offset-4 text-[var(--madder-red)]"
                aria-label={`Remove ${p.title} ${p.color}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        {tooMany && (
          <p role="alert" className="text-sm text-[var(--madder-red)]">
            A kit holds up to {maxSwatches} swatches. Remove {picks.length - maxSwatches} to continue.
          </p>
        )}
        <div className="flex justify-between border-t-2 border-[var(--charcoal-ink)] pt-3 font-serif text-xl font-bold tabular-nums">
          <span>Kit price</span>
          <span>₹{kitPrice.toFixed(2)}</span>
        </div>
        <p className="text-xs text-[var(--charcoal-ink)]/80">Includes GST and delivery.</p>
      </section>

      <section aria-labelledby="kit-ship" className="md:col-span-3">
        <h2 id="kit-ship" className="font-serif text-xl font-bold mb-4">Deliver to</h2>
        {!signedIn ? (
          <div className="border-2 border-[var(--charcoal-ink)] bg-white p-6 space-y-3">
            <p>Please sign in so we can add the swatch credit to your account.</p>
            <Link href="/login?next=/swatches" className="inline-block bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] px-5 py-3 text-xs font-bold uppercase tracking-widest">
              Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="sw-first" className={label}>First name</label>
                <input id="sw-first" name="firstName" required autoComplete="given-name" className={input} />
              </div>
              <div>
                <label htmlFor="sw-last" className={label}>Last name</label>
                <input id="sw-last" name="lastName" autoComplete="family-name" className={input} />
              </div>
            </div>
            <div>
              <label htmlFor="sw-email" className={label}>Email</label>
              <input id="sw-email" name="email" type="email" autoComplete="email" className={input} />
            </div>
            <div>
              <label htmlFor="sw-addr1" className={label}>Address</label>
              <input id="sw-addr1" name="address1" required autoComplete="address-line1" className={input} />
            </div>
            <div>
              <label htmlFor="sw-addr2" className={label}>Apartment, landmark (optional)</label>
              <input id="sw-addr2" name="address2" autoComplete="address-line2" className={input} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="sw-city" className={label}>City</label>
                <input id="sw-city" name="city" required autoComplete="address-level2" className={input} />
              </div>
              <div>
                <label htmlFor="sw-pin" className={label}>PIN code</label>
                <input id="sw-pin" name="pinCode" required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} autoComplete="postal-code" className={input} />
              </div>
            </div>
            <div>
              <label htmlFor="sw-state" className={label}>State</label>
              <select id="sw-state" name="state" required defaultValue="" className={input}>
                <option value="" disabled>Choose your state</option>
                {INDIAN_STATES.map(([code, name]) => (
                  <option key={code} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sw-gstin" className={label}>GSTIN (optional, for business purchases)</label>
              <input id="sw-gstin" name="gstin" maxLength={15} autoComplete="off" className={`${input} uppercase`} />
            </div>
            {error && <p role="alert" className="text-sm font-bold text-[var(--madder-red)]">{error}</p>}
            <button
              type="submit"
              disabled={busy || tooMany}
              className="w-full bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] py-4 text-sm font-bold uppercase tracking-widest disabled:opacity-60"
            >
              {busy ? 'Placing order…' : `Pay ₹${kitPrice.toFixed(2)} for the kit`}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
