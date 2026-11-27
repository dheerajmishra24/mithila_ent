"use client";

import { useActionState } from 'react';
import Link from 'next/link';
import { confirmPhoneEnrol, removeOtpPhone, startPhoneEnrol, type TwoStepState } from '@/actions/admin-two-step';

const field = 'mt-1 block w-full border-2 border-[var(--charcoal-ink)] bg-white px-2 py-2 text-sm font-normal normal-case tracking-normal';
const lbl = 'block text-xs font-bold uppercase tracking-widest';
const btn = 'bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] px-4 py-2 text-xs font-bold uppercase tracking-widest disabled:opacity-60';

function Msg({ state }: { state: TwoStepState }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <p role={state.error ? 'alert' : 'status'} className={`text-sm font-bold ${state.error ? 'text-[var(--madder-red)]' : 'text-green-800'}`}>
      {state.error ?? state.ok}
    </p>
  );
}

export default function TwoStepSettings({
  authenticators,
  phone,
  phoneChannels,
}: {
  authenticators: number;
  phone: string | null;
  phoneChannels: boolean;
}) {
  const [sendState, send, sending] = useActionState<TwoStepState, FormData>(startPhoneEnrol, undefined);
  const [confirmState, confirm, confirming] = useActionState<TwoStepState, FormData>(confirmPhoneEnrol, undefined);
  const [removeState, remove, removing] = useActionState<TwoStepState, FormData>(removeOtpPhone, undefined);
  const sent = confirmState?.sent ?? (confirmState?.ok ? undefined : sendState?.sent);

  return (
    <section aria-labelledby="two-step-heading" className="bg-white border-2 border-[var(--charcoal-ink)] p-8 space-y-5">
      <h2 id="two-step-heading" className="font-serif text-xl font-bold">Two-step sign-in</h2>
      <p className="text-sm text-[var(--charcoal-ink)]/80">
        After your password, the owner portal asks for a code from an authenticator app or one sent to your phone.
        Each sign-in lasts 12 hours.
      </p>

      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <div className="border-2 border-[var(--charcoal-ink)]/20 p-3">
          <dt className="text-xs font-bold uppercase tracking-widest">Authenticator app</dt>
          <dd className="mt-1">{authenticators > 0 ? 'Set up' : 'Not set up'}</dd>
        </div>
        <div className="border-2 border-[var(--charcoal-ink)]/20 p-3">
          <dt className="text-xs font-bold uppercase tracking-widest">WhatsApp / SMS codes</dt>
          <dd className="mt-1">{phone ? `Sent to ${phone}` : 'No number set up'}</dd>
        </div>
      </dl>

      {authenticators === 0 && (
        <p className="text-sm">
          <Link href="/admin/settings/authenticator" className="font-bold underline underline-offset-4 text-[var(--indigo-dye)]">
            Set up an authenticator app
          </Link>{' '}
          so you can still sign in if WhatsApp and SMS are down.
        </p>
      )}

      {!phoneChannels ? (
        <p className="text-sm text-[var(--charcoal-ink)]/80">
          WhatsApp and SMS codes switch on once the WhatsApp Business and DLT SMS details are added on the server.
        </p>
      ) : sent ? (
        <form action={confirm} className="space-y-3 max-w-sm">
          <input type="hidden" name="challengeId" value={sent.challengeId} />
          <label className={lbl}>
            Code sent to +91 ••••••{sent.last4}
            <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className={field} />
          </label>
          <Msg state={confirmState} />
          <button type="submit" disabled={confirming} className={btn}>{confirming ? 'Checking…' : 'Verify number'}</button>
        </form>
      ) : (
        <form action={send} className="space-y-3 max-w-sm">
          <label className={lbl}>
            {phone ? 'Change number' : 'Mobile number for codes'}
            <input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" required maxLength={20} className={field} />
          </label>
          <Msg state={confirmState?.ok ? confirmState : sendState} />
          <button type="submit" disabled={sending} className={btn}>{sending ? 'Sending…' : 'Send a code to this number'}</button>
        </form>
      )}

      {phone && authenticators > 0 && (
        <form action={remove} className="flex items-center gap-4">
          <button type="submit" disabled={removing} className="text-xs font-bold uppercase tracking-widest underline underline-offset-4 text-[var(--madder-red)]">
            {removing ? 'Removing…' : 'Remove phone number'}
          </button>
          <Msg state={removeState} />
        </form>
      )}
    </section>
  );
}
