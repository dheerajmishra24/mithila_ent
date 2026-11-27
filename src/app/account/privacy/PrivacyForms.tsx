'use client';

import { startTransition, useActionState, useId, useRef, useState, type FormEvent } from 'react';
import { createPrivacyRequest, setConsent, withdrawPrivacyRequest, type PrivacyActionState } from '@/actions/privacy';

function Status({ state }: { state: PrivacyActionState }) {
  return (
    <p role="status" aria-live="polite" className={`text-xs ${state?.error ? 'text-[var(--madder-red)] font-bold' : 'text-[var(--charcoal-ink)]/80'}`}>
      {state?.error ?? state?.ok ?? ''}
    </p>
  );
}

/** One purpose, one switch. Saved on its own: consent is never bundled. */
export function ConsentSwitch({ purpose, title, body, granted }: { purpose: string; title: string; body: string; granted: boolean }) {
  const [state, action, pending] = useActionState<PrivacyActionState, FormData>(setConsent, null);
  const titleId = useId();
  const bodyId = useId();
  return (
    <form action={action} className="flex flex-wrap items-start justify-between gap-4 border-t border-[var(--charcoal-ink)]/10 py-4 first:border-t-0">
      <div className="min-w-0 flex-1">
        <h4 id={titleId} className="font-bold">{title}</h4>
        <p id={bodyId} className="mt-1 text-sm text-[var(--charcoal-ink)]/80">{body}</p>
        <Status state={state} />
      </div>
      <input type="hidden" name="purpose" value={purpose} />
      <input type="hidden" name="granted" value={granted ? 'false' : 'true'} />
      <button
        type="submit"
        role="switch"
        aria-checked={granted}
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        disabled={pending}
        className={`inline-flex min-h-11 min-w-20 items-center justify-center border-2 border-[var(--charcoal-ink)] px-4 text-xs font-bold uppercase tracking-widest disabled:opacity-50 ${granted ? 'bg-[var(--indigo-dye)] text-white' : 'bg-white text-[var(--charcoal-ink)]'}`}
      >
        {granted ? 'On' : 'Off'}
      </button>
    </form>
  );
}

export function RequestForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState('correction');
  const [state, action, pending] = useActionState<PrivacyActionState, FormData>(async (prev, fd) => {
    const result = await createPrivacyRequest(prev, fd);
    if (result?.ok) {
      formRef.current?.reset();
      setKind('correction');
    }
    return result;
  }, null);
  // React resets a form after its action runs, which would throw away the
  // customer's choice and text when the request is refused. Submitting via
  // onSubmit keeps them; without JavaScript the plain form action still works.
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return (
    <form ref={formRef} action={action} onSubmit={submit} className="space-y-4">
      <fieldset>
        <legend className="text-xs font-bold uppercase tracking-widest">What do you need?</legend>
        <div className="mt-2 space-y-2 text-sm">
          {[
            ['correction', 'Correct something we hold about me'],
            ['grievance', 'Raise a complaint about how my data is handled'],
            ['erasure', 'Delete my account and personal data'],
          ].map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="h-4 w-4" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="privacy-details" className="block text-xs font-bold uppercase tracking-widest">
          Details {kind === 'erasure' ? '(optional)' : ''}
        </label>
        <textarea id="privacy-details" name="details" rows={3} maxLength={2000} className="mt-1 w-full border-2 border-[var(--charcoal-ink)] bg-white p-2 text-sm" />
      </div>
      {kind === 'erasure' && (
        <div className="border-2 border-[var(--madder-red)] bg-white p-3 text-sm">
          <p>
            We delete your account, saved addresses, enquiries and preferences. Orders and their tax invoices are kept,
            without your e-mail or phone, for as long as the GST law requires. Unused swatch credit is lost.
          </p>
          <label className="mt-2 flex items-center gap-2 font-bold">
            <input type="checkbox" name="confirm" value="yes" className="h-4 w-4" />
            I understand and want my account deleted
          </label>
        </div>
      )}
      <button type="submit" disabled={pending} className="min-h-11 border-2 border-[var(--charcoal-ink)] bg-[var(--charcoal-ink)] px-5 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50">
        {pending ? 'Sending…' : 'Send request'}
      </button>
      <Status state={state} />
    </form>
  );
}

export function WithdrawButton({ id, refCode }: { id: string; refCode: string }) {
  const [state, action, pending] = useActionState<PrivacyActionState, FormData>(withdrawPrivacyRequest, null);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="text-xs font-bold underline underline-offset-4 disabled:opacity-50">
        Withdraw<span className="sr-only"> request {refCode}</span>
      </button>
      <Status state={state} />
    </form>
  );
}
