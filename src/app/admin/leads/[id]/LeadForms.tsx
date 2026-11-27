'use client';

import { useActionState } from 'react';
import { mergeLead, updateLead, type LeadActionState } from '@/actions/leads';

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost', 'spam'] as const;

export function LeadStatusForm({ leadId, status, valueRupees, notes }: { leadId: string; status: string; valueRupees: string; notes: string }) {
  const [state, action, pending] = useActionState<LeadActionState, FormData>(updateLead, null);
  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <div className="flex flex-col gap-1">
        <label htmlFor="lead-status" className="text-[10px] font-bold uppercase tracking-widest">Status</label>
        <select id="lead-status" name="status" defaultValue={status} className="sonic-input">
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="lead-value" className="text-[10px] font-bold uppercase tracking-widest">Order value (₹, when won)</label>
        <input id="lead-value" name="value" inputMode="decimal" defaultValue={valueRupees} placeholder="e.g. 12500" className="sonic-input" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="lead-notes" className="text-[10px] font-bold uppercase tracking-widest">Notes</label>
        <textarea id="lead-notes" name="notes" rows={4} maxLength={4000} defaultValue={notes} className="sonic-input resize-y" />
      </div>
      <button type="submit" disabled={pending} className="w-full border-2 border-[var(--charcoal-ink)] bg-[var(--charcoal-ink)] px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-[var(--madder-red)] disabled:opacity-50">
        {pending ? 'Saving…' : 'Save'}
      </button>
      <p aria-live="polite" className={`text-xs ${state?.error ? 'font-bold text-[var(--madder-red)]' : ''}`}>{state?.error ?? state?.ok ?? ''}</p>
    </form>
  );
}

export function MergeForm({ keep, drop, dropRef }: { keep: string; drop: string; dropRef: string }) {
  const [state, action, pending] = useActionState<LeadActionState, FormData>(mergeLead, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Merge ${dropRef} into this lead? Its history moves here.`)) e.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="keep" value={keep} />
      <input type="hidden" name="drop" value={drop} />
      <button type="submit" disabled={pending} className="border-2 border-[var(--charcoal-ink)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--charcoal-ink)] hover:text-white disabled:opacity-50">
        {pending ? 'Merging…' : 'Merge here'}
        <span className="sr-only">: {dropRef} into this lead</span>
      </button>
      <span aria-live="polite" className="text-xs">{state?.error ?? state?.ok ?? ''}</span>
    </form>
  );
}
