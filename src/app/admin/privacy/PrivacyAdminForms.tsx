'use client';

import { createContext, useActionState, useContext, useId, useState, type ReactNode } from 'react';
import { eraseForRequest, unsuppressEmail, updatePrivacyRequest, type PrivacyActionState } from '@/actions/privacy';

type Action = (prev: PrivacyActionState, fd: FormData) => Promise<PrivacyActionState>;

// A finished action often removes its own row (an erased request leaves the
// open queue, an allowed address leaves the hold list), so success messages
// are shown in one page-level live region that outlives the row.
const Announce = createContext<(message: string) => void>(() => {});

export function PrivacyAnnouncer({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  return (
    <Announce.Provider value={setMessage}>
      <p
        role="status"
        aria-live="polite"
        className={message ? 'sticky top-0 z-10 border-2 border-[var(--charcoal-ink)] bg-[var(--unbleached-cotton)] px-3 py-2 text-sm font-bold' : 'sr-only'}
      >
        {message}
      </p>
      {children}
    </Announce.Provider>
  );
}

function useAnnouncedAction(fn: Action) {
  const announce = useContext(Announce);
  return useActionState<PrivacyActionState, FormData>(async (prev, fd) => {
    announce('');
    const result = await fn(prev, fd);
    if (result?.ok) announce(result.ok);
    return result;
  }, null);
}

/** Row-level: errors only (the row is still there when something fails). */
function RowError({ state }: { state: PrivacyActionState }) {
  return (
    <p role="alert" className="text-xs font-bold text-[var(--madder-red)]">
      {state?.error ?? ''}
    </p>
  );
}

export function RequestUpdateForm({ id, refCode, kind }: { id: string; refCode: string; kind: string }) {
  const [state, action, pending] = useAnnouncedAction(updatePrivacyRequest);
  const uid = useId();
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={`${uid}-status`} className="block text-[10px] font-bold uppercase tracking-widest">Status</label>
          <select id={`${uid}-status`} name="status" defaultValue="in_progress" className="border-2 border-[var(--charcoal-ink)] bg-white p-1 text-sm">
            <option value="in_progress">In progress</option>
            {kind !== 'erasure' && <option value="completed">Completed</option>}
            <option value="rejected">Declined</option>
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <label htmlFor={`${uid}-res`} className="block text-[10px] font-bold uppercase tracking-widest">Reply / reason</label>
          <input id={`${uid}-res`} name="resolution" maxLength={2000} className="w-full border-2 border-[var(--charcoal-ink)] bg-white p-1 text-sm" />
        </div>
        <button type="submit" disabled={pending} className="min-h-9 border-2 border-[var(--charcoal-ink)] px-3 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50">
          Save<span className="sr-only"> {refCode}</span>
        </button>
      </div>
      <RowError state={state} />
    </form>
  );
}

export function EraseForm({ id, refCode }: { id: string; refCode: string }) {
  const [state, action, pending] = useAnnouncedAction(eraseForRequest);
  const uid = useId();
  return (
    <form action={action} className="space-y-2 border-2 border-[var(--madder-red)] p-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-xs">
        Deletes the account, profile, addresses, cart, swatch credit, enquiries and consent history. Orders stay for GST records
        without e-mail or phone. This cannot be undone.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={`${uid}-confirm`} className="block text-[10px] font-bold uppercase tracking-widest">Type ERASE to confirm</label>
          <input id={`${uid}-confirm`} name="confirm" autoComplete="off" className="w-32 border-2 border-[var(--charcoal-ink)] bg-white p-1 font-mono text-sm" />
        </div>
        <button type="submit" disabled={pending} className="min-h-9 border-2 border-[var(--madder-red)] bg-[var(--madder-red)] px-3 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50">
          {pending ? 'Erasing…' : 'Erase now'}<span className="sr-only"> for {refCode}</span>
        </button>
      </div>
      <RowError state={state} />
    </form>
  );
}

export function UnsuppressForm({ email }: { email: string }) {
  const [state, action, pending] = useAnnouncedAction(unsuppressEmail);
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="email" value={email} />
      <button type="submit" disabled={pending} className="text-xs font-bold underline underline-offset-4 disabled:opacity-50">
        Allow again<span className="sr-only"> for {email}</span>
      </button>
      <RowError state={state} />
    </form>
  );
}
