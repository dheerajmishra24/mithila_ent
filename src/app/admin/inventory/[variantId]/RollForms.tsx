'use client'

import { useActionState } from 'react'
import { receiveRoll, retireRoll, setRollRemaining, markCut, type RollActionState } from '@/actions/rolls'

const input =
  'bg-transparent border border-white/20 px-3 py-2 font-mono text-sm focus:outline-none focus:border-[var(--turmeric)]'
const button =
  'bg-white/10 hover:bg-[var(--turmeric)] hover:text-[#111] font-bold text-[10px] uppercase tracking-widest px-4 py-2 transition-colors disabled:opacity-50'

function Message({ state }: { state: RollActionState }) {
  if (state?.error) return <p role="alert" className="text-sm text-red-400 mt-2">{state.error}</p>
  if (state?.ok) return <p role="status" className="text-sm text-green-400 mt-2">{state.ok}</p>
  return null
}

export function ReceiveRollForm({ variantId }: { variantId: string }) {
  const [state, action, pending] = useActionState(receiveRoll, undefined)
  return (
    <form action={action} className="border border-white/20 p-5 bg-[#111]">
      <h2 className="font-serif text-lg font-bold mb-4">Receive a roll</h2>
      <input type="hidden" name="variantId" value={variantId} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest opacity-80">
          Length (m)
          <input name="totalM" type="number" inputMode="decimal" step="0.01" min="0.01" max="10000" required className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest opacity-80">
          Dye lot
          <input name="dyeLot" type="text" maxLength={40} required className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest opacity-80">
          Shade note
          <input name="shade" type="text" maxLength={200} className={input} />
        </label>
      </div>
      <button type="submit" disabled={pending} className={`${button} mt-4`}>
        {pending ? 'Saving…' : 'Add roll'}
      </button>
      <Message state={state} />
    </form>
  )
}

export function StocktakeForm({ variantId, rollId, rollCode, available }: {
  variantId: string; rollId: string; rollCode: string; available: number
}) {
  const [state, action, pending] = useActionState(setRollRemaining, undefined)
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="rollId" value={rollId} />
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest opacity-70">
        Measured on roll (m)
        <input
          name="remainingM" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={available}
          aria-label={`Measured length on ${rollCode}`} className={`${input} w-28`}
        />
      </label>
      <input name="note" type="text" maxLength={200} placeholder="Note" aria-label={`Stocktake note for ${rollCode}`} className={`${input} w-32`} />
      <button type="submit" disabled={pending} className={button}>Save</button>
      <Message state={state} />
    </form>
  )
}

export function RetireRollForm({ variantId, rollId, rollCode }: { variantId: string; rollId: string; rollCode: string }) {
  const [state, action, pending] = useActionState(retireRoll, undefined)
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Retire roll ${rollCode}? Its remaining length stops being sold.`)) e.preventDefault()
      }}
    >
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="rollId" value={rollId} />
      <button type="submit" disabled={pending} className={`${button} hover:!bg-[var(--madder-red)] hover:!text-white`}>
        Retire
      </button>
      <Message state={state} />
    </form>
  )
}

export function MarkCutForm({ cutId, label }: { cutId: string; label: string }) {
  const [state, action, pending] = useActionState(markCut, undefined)
  if (state?.ok) return <p role="status" className="text-sm text-green-400">{state.ok}</p>
  return (
    <form action={action}>
      <input type="hidden" name="cutId" value={cutId} />
      <button type="submit" disabled={pending} aria-label={`Mark cut: ${label}`} className={button}>
        {pending ? 'Saving…' : 'Mark cut'}
      </button>
      <Message state={state} />
    </form>
  )
}
