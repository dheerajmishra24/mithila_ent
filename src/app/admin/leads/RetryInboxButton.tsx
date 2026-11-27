'use client';

import { useActionState } from 'react';
import { retryLeadInbox, type LeadActionState } from '@/actions/leads';

export default function RetryInboxButton() {
  const [state, action, pending] = useActionState<LeadActionState, FormData>(retryLeadInbox, null);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <button type="submit" disabled={pending} className="border border-[var(--charcoal-ink)] px-2 py-1 text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--charcoal-ink)] hover:text-white disabled:opacity-50">
        {pending ? 'Retrying…' : 'Retry now'}
      </button>
      <span aria-live="polite" className="text-[11px]">{state?.ok ?? state?.error ?? ''}</span>
    </form>
  );
}
