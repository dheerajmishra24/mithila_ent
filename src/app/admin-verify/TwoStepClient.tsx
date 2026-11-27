"use client";

import { useActionState, useEffect, useState } from 'react';
import {
  confirmAuthenticatorSetup,
  sendSignInCode,
  startAuthenticatorSetup,
  verifyAuthenticatorCode,
  verifySignInCode,
  type TwoStepState,
} from '@/actions/admin-two-step';
import { logout } from '@/actions/auth';

const input =
  'mt-1 block w-full border-2 border-[var(--charcoal-ink)] bg-white px-3 py-3 font-mono text-2xl tracking-[0.4em] text-center focus:outline-none focus:border-[var(--indigo-dye)]';
const button =
  'w-full bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[var(--madder-red)] disabled:opacity-60';
const secondary =
  'w-full border-2 border-[var(--charcoal-ink)] bg-transparent px-4 py-3 text-xs font-bold uppercase tracking-widest text-[var(--charcoal-ink)] hover:bg-[var(--charcoal-ink)] hover:text-[var(--unbleached-cotton)] disabled:opacity-60';
const label = 'block text-xs font-bold uppercase tracking-widest text-[var(--charcoal-ink)]';

function Message({ state }: { state: TwoStepState }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <p role={state.error ? 'alert' : 'status'} className={`text-sm font-bold ${state.error ? 'text-[var(--madder-red)]' : 'text-green-800'}`}>
      {state.error ?? state.ok}
    </p>
  );
}

function CodeField({ id, describedBy }: { id: string; describedBy?: string }) {
  return (
    <input
      id={id}
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      maxLength={6}
      required
      aria-describedby={describedBy}
      className={input}
    />
  );
}

function AuthenticatorForm() {
  const [state, action, pending] = useActionState<TwoStepState, FormData>(verifyAuthenticatorCode, undefined);
  return (
    <form action={action} className="space-y-3">
      <label htmlFor="totp-code" className={label}>Code from your authenticator app</label>
      <CodeField id="totp-code" />
      <Message state={state} />
      <button type="submit" disabled={pending} className={button}>{pending ? 'Checking…' : 'Verify'}</button>
    </form>
  );
}

function PhoneCodeForms({ phone }: { phone: string }) {
  const [sendState, send, sending] = useActionState<TwoStepState, FormData>(sendSignInCode, undefined);
  const [verifyState, verify, verifying] = useActionState<TwoStepState, FormData>(verifySignInCode, undefined);
  const sent = verifyState?.sent ?? sendState?.sent;
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (!sendState?.sent) return;
    setWait(30);
    const t = setInterval(() => setWait((w) => (w > 0 ? w - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [sendState]);

  if (!sent) {
    return (
      <form action={send} className="space-y-3">
        <input type="hidden" name="channel" value="whatsapp" />
        <Message state={sendState} />
        <button type="submit" disabled={sending} className={secondary}>
          {sending ? 'Sending…' : `Send a code to ${phone}`}
        </button>
      </form>
    );
  }

  const where = sent.channel === 'whatsapp' ? 'WhatsApp' : 'SMS';
  return (
    <div className="space-y-4">
      <form action={verify} className="space-y-3">
        <input type="hidden" name="challengeId" value={sent.challengeId} />
        <label htmlFor="otp-code" className={label}>Code sent by {where}</label>
        <p id="otp-help" className="text-sm text-[var(--charcoal-ink)]/80">
          Sent to +91 ••••••{sent.last4}. It works once and expires in 10 minutes.
          {sent.channel === 'whatsapp' && sent.smsFallback ? ' If WhatsApp does not deliver it within 15 seconds, the same code comes by SMS.' : ''}
        </p>
        <CodeField id="otp-code" describedBy="otp-help" />
        <Message state={verifyState?.error ? verifyState : sendState} />
        <button type="submit" disabled={verifying} className={button}>{verifying ? 'Checking…' : 'Verify'}</button>
      </form>
      <form action={send}>
        <input type="hidden" name="channel" value="sms" />
        <button type="submit" disabled={sending || wait > 0} className={secondary}>
          {wait > 0 ? `Send a new code by SMS (${wait}s)` : sending ? 'Sending…' : 'Send a new code by SMS'}
        </button>
      </form>
    </div>
  );
}

export function SetupForms() {
  const [startState, start, starting] = useActionState<TwoStepState, FormData>(startAuthenticatorSetup, undefined);
  const [confirmState, confirm, confirming] = useActionState<TwoStepState, FormData>(confirmAuthenticatorSetup, undefined);
  const setup = startState?.setup;

  if (!setup) {
    return (
      <form action={start} className="space-y-3">
        <Message state={startState} />
        <button type="submit" disabled={starting} className={button}>{starting ? 'Starting…' : 'Set up an authenticator app'}</button>
      </form>
    );
  }
  return (
    <form action={confirm} className="space-y-4">
      <ol className="list-decimal pl-5 space-y-2 text-sm text-[var(--charcoal-ink)]">
        <li>Open Google Authenticator, Microsoft Authenticator or a similar app on your phone.</li>
        <li>Add an account and scan this QR code.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element -- inline data: SVG from Supabase */}
      <img src={setup.qr} alt="QR code to add the owner portal to your authenticator app" width={192} height={192} className="mx-auto border-2 border-[var(--charcoal-ink)] bg-white" />
      <p className="text-xs text-[var(--charcoal-ink)]/80 break-all">
        Cannot scan? Enter this key instead: <span className="font-mono font-bold">{setup.secret}</span>
      </p>
      <input type="hidden" name="factorId" value={setup.factorId} />
      <label htmlFor="setup-code" className={label}>Then enter the 6-digit code it shows</label>
      <CodeField id="setup-code" />
      <Message state={confirmState} />
      <button type="submit" disabled={confirming} className={button}>{confirming ? 'Checking…' : 'Finish set-up'}</button>
    </form>
  );
}

export default function TwoStepClient({ hasAuthenticator, phone, needsSetup }: { hasAuthenticator: boolean; phone: string | null; needsSetup: boolean }) {
  return (
    <div className="space-y-6">
      {needsSetup && <SetupForms />}
      {hasAuthenticator && <AuthenticatorForm />}
      {hasAuthenticator && phone && (
        <p className="text-center text-xs font-bold uppercase tracking-widest text-[var(--charcoal-ink)]/80">or</p>
      )}
      {phone && <PhoneCodeForms phone={phone} />}
      <form action={logout}>
        <button type="submit" className="w-full text-center text-xs underline underline-offset-4 text-[var(--charcoal-ink)]/80 hover:text-[var(--charcoal-ink)]">
          Sign out
        </button>
      </form>
    </div>
  );
}
