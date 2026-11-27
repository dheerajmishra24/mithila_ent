import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireAdminPage } from '@/lib/dal/session'
import { uuid } from '@/lib/validation/common'
import { ReceiveRollForm, RetireRollForm, StocktakeForm } from './RollForms'

export const dynamic = 'force-dynamic'

type RollRow = {
  roll_id: string
  roll_code: string
  dye_lot: string
  shade_note: string | null
  status: 'active' | 'remnant' | 'depleted' | 'retired'
  total_m: number
  available_m: number
  reserved_m: number
  committed_m: number
  cut_m: number
  is_opening_balance: boolean
  received_at: string
}

const m = (n: unknown) => `${Number(n ?? 0).toFixed(2)} m`

const STATUS_CLASS: Record<RollRow['status'], string> = {
  active: 'border-green-500/50 text-green-400',
  remnant: 'border-[var(--turmeric)]/50 text-[var(--turmeric)]',
  depleted: 'border-white/20 text-white/50',
  retired: 'border-red-500/50 text-red-400',
}

export default async function VariantRollsPage({ params }: { params: Promise<{ variantId: string }> }) {
  await requireAdminPage()
  const { variantId } = await params
  if (!uuid.safeParse(variantId).success) notFound()
  const supabase = await createClient()

  const { data: variant } = await supabase
    .from('product_variants')
    .select('id, sku, color, stock_quantity, max_cut_m, products!inner(title, sell_unit, remnant_threshold_m)')
    .eq('id', variantId)
    .maybeSingle()
  if (!variant) notFound()
  const product = (Array.isArray(variant.products) ? variant.products[0] : variant.products) as {
    title: string; sell_unit: string; remnant_threshold_m: number
  }

  const [{ data: rolls }, { data: events }] = await Promise.all([
    supabase
      .from('fabric_roll_stock')
      .select('*')
      .eq('variant_id', variantId)
      .order('status', { ascending: true })
      .order('available_m', { ascending: false })
      .returns<RollRow[]>(),
    supabase
      .from('roll_events')
      .select('id, event, delta_m, note, created_at, fabric_rolls!inner(roll_code, variant_id)')
      .eq('fabric_rolls.variant_id', variantId)
      .order('created_at', { ascending: false })
      .limit(25),
  ])

  const sellable = (rolls ?? []).filter((r) => r.status === 'active' || r.status === 'remnant')
  const totals = sellable.reduce(
    (t, r) => ({
      available: t.available + Number(r.available_m),
      reserved: t.reserved + Number(r.reserved_m),
      committed: t.committed + Number(r.committed_m),
    }),
    { available: 0, reserved: 0, committed: 0 },
  )

  return (
    <div className="p-4 sm:p-8 min-h-screen bg-[var(--charcoal-ink)] text-white">
      <Link href="/admin/inventory" className="inline-flex items-center gap-1 text-xs uppercase tracking-widest opacity-70 hover:opacity-100">
        <ChevronLeft size={14} aria-hidden /> Inventory
      </Link>
      <div className="mt-4 mb-8 border-b border-white/10 pb-6">
        <h1 className="font-serif text-3xl font-bold">{product.title}</h1>
        <p className="text-sm uppercase tracking-widest opacity-70 mt-1">
          {variant.color} · <span className="font-mono">{variant.sku}</span>
        </p>
        {product.sell_unit !== 'MTR' && (
          <p role="note" className="mt-4 text-[var(--turmeric)] text-sm">
            This product is sold by the piece. Rolls apply only to fabric sold by the metre.
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 tabular-nums">
        {[
          ['Available', totals.available],
          ['Longest single cut', Number(variant.max_cut_m ?? 0)],
          ['Reserved (unpaid)', totals.reserved],
          ['Committed (paid, uncut)', totals.committed],
        ].map(([label, value]) => (
          <div key={label as string} className="border border-white/15 p-4 bg-[#111]">
            <dt className="text-[10px] uppercase tracking-widest opacity-60">{label}</dt>
            <dd className="font-mono text-2xl font-bold mt-1">{m(value)}</dd>
          </div>
        ))}
      </dl>

      {product.sell_unit === 'MTR' && <ReceiveRollForm variantId={variantId} />}

      <h2 className="font-serif text-xl font-bold mt-10 mb-4">Rolls</h2>
      <p className="text-xs opacity-60 mb-4">
        A roll below {m(product.remnant_threshold_m)} becomes a remnant. Orders take the smallest roll that holds the whole length.
      </p>
      <div role="region" aria-label="Rolls table" tabIndex={0} className="overflow-x-auto border border-white/15 focus-visible:outline-2 focus-visible:outline-[var(--turmeric)]">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-left">
            <tr>
              <th scope="col" className="p-3">Roll</th>
              <th scope="col" className="p-3">Dye lot</th>
              <th scope="col" className="p-3">Status</th>
              <th scope="col" className="p-3 text-right">Received</th>
              <th scope="col" className="p-3 text-right">Available</th>
              <th scope="col" className="p-3 text-right">Reserved</th>
              <th scope="col" className="p-3 text-right">Committed</th>
              <th scope="col" className="p-3 text-right">Cut</th>
              <th scope="col" className="p-3">Stocktake</th>
              <th scope="col" className="p-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {(rolls ?? []).length === 0 && (
              <tr><td colSpan={10} className="p-6 text-center opacity-60">No rolls yet.</td></tr>
            )}
            {(rolls ?? []).map((r) => {
              const open = r.status === 'active' || r.status === 'remnant'
              return (
                <tr key={r.roll_id} className="border-t border-white/10 align-top">
                  <th scope="row" className="p-3 font-mono font-normal text-left">
                    {r.roll_code}
                    {r.is_opening_balance && <span className="block text-[10px] opacity-50">opening balance</span>}
                  </th>
                  <td className="p-3 font-mono">
                    {r.dye_lot}
                    {r.shade_note && <span className="block text-xs opacity-60 font-sans">{r.shade_note}</span>}
                  </td>
                  <td className="p-3">
                    <span className={`border px-2 py-0.5 text-[10px] uppercase tracking-widest ${STATUS_CLASS[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="p-3 text-right font-mono">{m(r.total_m)}</td>
                  <td className="p-3 text-right font-mono font-bold">{m(r.available_m)}</td>
                  <td className="p-3 text-right font-mono">{m(r.reserved_m)}</td>
                  <td className="p-3 text-right font-mono">{m(r.committed_m)}</td>
                  <td className="p-3 text-right font-mono">{m(r.cut_m)}</td>
                  <td className="p-3">
                    {open && (
                      <StocktakeForm variantId={variantId} rollId={r.roll_id} rollCode={r.roll_code} available={Number(r.available_m)} />
                    )}
                  </td>
                  <td className="p-3">
                    {open && <RetireRollForm variantId={variantId} rollId={r.roll_id} rollCode={r.roll_code} />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h2 className="font-serif text-xl font-bold mt-10 mb-4">Recent roll history</h2>
      <ul className="divide-y divide-white/10 border border-white/15 text-sm">
        {(events ?? []).length === 0 && <li className="p-4 opacity-60">No history yet.</li>}
        {(events ?? []).map((e) => {
          const roll = (Array.isArray(e.fabric_rolls) ? e.fabric_rolls[0] : e.fabric_rolls) as { roll_code: string } | null
          const delta = Number(e.delta_m)
          return (
            <li key={e.id} className="p-3 flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
              <time dateTime={e.created_at} className="opacity-60 font-mono text-xs">
                {new Date(e.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </time>
              <span className="font-mono">{roll?.roll_code}</span>
              <span className="uppercase tracking-widest text-[10px] self-center">{e.event.replace('_', ' ')}</span>
              {delta !== 0 && <span className="font-mono">{delta > 0 ? '+' : ''}{delta.toFixed(2)} m</span>}
              {e.note && <span className="opacity-70">{e.note}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
