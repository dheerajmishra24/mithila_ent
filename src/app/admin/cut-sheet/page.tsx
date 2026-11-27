import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireAdminPage } from '@/lib/dal/session'
import { MarkCutForm } from '../inventory/[variantId]/RollForms'

export const dynamic = 'force-dynamic'

// Cuts waiting at the cutting table: allocated lengths on paid, live orders,
// grouped by roll so each roll is unwound once.

type CutRow = {
  id: string
  roll_id: string | null
  roll_code: string
  dye_lot: string
  length_m: number
  status: 'allocated' | 'cut'
  cut_at: string | null
  created_at: string
  orders: { id: string; status: string; is_paid: boolean; created_at: string } | null
  order_items: {
    product_variants: { color: string | null; sku: string | null; products: { title: string } | null } | null
  } | null
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

// Pending cuts, plus the last 24 hours of finished ones so the cutter can see
// what was just done. Kept outside the component: Date.now() is impure.
async function loadCuts(supabase: Awaited<ReturnType<typeof createClient>>) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  return supabase
    .from('order_item_cuts')
    .select(
      'id, roll_id, roll_code, dye_lot, length_m, status, cut_at, created_at, orders!inner(id, status, is_paid, created_at), order_items!inner(product_variants(color, sku, products(title)))',
    )
    .or(`status.eq.allocated,and(status.eq.cut,cut_at.gte.${since})`)
    .eq('orders.is_paid', true)
    .neq('orders.status', 'cancelled')
    .order('created_at', { ascending: true })
    .limit(500)
}

export default async function CutSheetPage() {
  await requireAdminPage()
  const supabase = await createClient()

  const { data } = await loadCuts(supabase)

  const cuts = ((data ?? []) as unknown[]).map((raw) => {
    const r = raw as CutRow
    const item = one(r.order_items)
    const variant = one(item?.product_variants)
    return {
      ...r,
      order: one(r.orders),
      title: one(variant?.products)?.title ?? 'Unknown product',
      color: variant?.color ?? '',
      sku: variant?.sku ?? '',
    }
  })

  const byRoll = new Map<string, typeof cuts>()
  for (const c of cuts) {
    const key = c.roll_code
    byRoll.set(key, [...(byRoll.get(key) ?? []), c])
  }
  const pending = cuts.filter((c) => c.status === 'allocated')
  const totalM = pending.reduce((t, c) => t + Number(c.length_m), 0)
  const pendingRolls = new Set(pending.map((c) => c.roll_code)).size

  return (
    <div className="p-4 sm:p-8 min-h-screen bg-[var(--charcoal-ink)] text-white">
      <div className="mb-8 border-b border-white/10 pb-6">
        <h1 className="font-serif text-3xl font-bold">Cut Sheet</h1>
        <p className="text-sm opacity-70 mt-2 tabular-nums">
          {pending.length} {pending.length === 1 ? 'cut' : 'cuts'} to make · {totalM.toFixed(2)} m on {pendingRolls} {pendingRolls === 1 ? 'roll' : 'rolls'}.
          Once a length is marked cut, the customer can no longer cancel it.
        </p>
      </div>

      {pending.length === 0 && cuts.length === 0 && <p className="opacity-70">Nothing to cut. Paid orders appear here.</p>}

      <div className="space-y-8">
        {[...byRoll.entries()].map(([rollCode, list]) => (
          <section key={rollCode} aria-labelledby={`roll-${rollCode}`} className="border border-white/15 bg-[#111]">
            <header className="flex flex-wrap items-baseline justify-between gap-2 p-4 border-b border-white/10">
              <h2 id={`roll-${rollCode}`} className="font-mono text-lg font-bold">
                {rollCode} <span className="text-sm font-normal opacity-70">dye lot {list[0].dye_lot}</span>
              </h2>
              <p className="text-sm opacity-80">
                {list[0].title} · {list[0].color}
                <span className="ml-3 font-mono tabular-nums">
                  {list.filter((c) => c.status === 'allocated').reduce((t, c) => t + Number(c.length_m), 0).toFixed(2)} m to cut
                </span>
              </p>
            </header>
            <table className="w-full text-sm tabular-nums">
              <thead className="text-[10px] uppercase tracking-widest text-left opacity-70">
                <tr>
                  <th scope="col" className="p-3">Order</th>
                  <th scope="col" className="p-3">Paid order date</th>
                  <th scope="col" className="p-3 text-right">Length</th>
                  <th scope="col" className="p-3"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-t border-white/10">
                    <th scope="row" className="p-3 text-left font-mono font-normal">
                      {c.order ? (
                        <Link href={`/admin/orders/${c.order.id}`} className="underline underline-offset-4">
                          #{c.order.id.slice(0, 8).toUpperCase()}
                        </Link>
                      ) : '—'}
                    </th>
                    <td className="p-3">
                      {c.order ? new Date(c.order.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : ''}
                    </td>
                    <td className="p-3 text-right font-mono font-bold">{Number(c.length_m).toFixed(2)} m</td>
                    <td className="p-3 text-right">
                      {c.status === 'cut' ? (
                        <span className="text-xs uppercase tracking-widest text-green-400">
                          Cut{c.cut_at ? ` ${new Date(c.cut_at).toLocaleTimeString('en-IN', { timeStyle: 'short' })}` : ''}
                        </span>
                      ) : (
                        <MarkCutForm cutId={c.id} label={`${Number(c.length_m).toFixed(2)} m from ${rollCode}`} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  )
}
