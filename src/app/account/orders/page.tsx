import { createClient } from '@/lib/supabase/server'
import { formatQuantity, lineTotal } from '@/lib/meterage'
import { redirect } from 'next/navigation'
import { requestCancellation } from '@/actions/orders'

export default async function AccountOrdersPage() {
  const supabase = await createClient()
  
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) {
    redirect('/login')
  }

  // Fetch only the authenticated user's orders
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id,
      status,
      is_paid,
      cancellation_requested,
      total_amount,
      invoice_number,
      order_kind,
      credit_applied,
      cgst_total,
      sgst_total,
      igst_total,
      tracking_status,
      courier_name,
      awb_code,
      shipment_status,
      shipment_status_at,
      expected_delivery_at,
      created_at,
      order_items(
        quantity,
        uqc,
        dye_lot,
        unit_price,
        product_variants(color, products(title))
      )
    `)
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false })

  // Courier scans for all of this person's shipments in one query (RLS limits
  // them to AWBs on their own orders).
  const awbs = (orders ?? []).map((o) => o.awb_code).filter((a): a is string => Boolean(a))
  const scansByAwb = new Map<string, { event_at: string; status_label: string; activity: string | null; location: string | null }[]>()
  if (awbs.length > 0) {
    const { data: scans } = await supabase
      .from('shipment_events')
      .select('awb_code, event_at, status_label, activity, location')
      .in('awb_code', awbs)
      .order('event_at', { ascending: false })
      .limit(500)
    for (const sc of scans ?? []) {
      const list = scansByAwb.get(sc.awb_code) ?? []
      list.push(sc)
      scansByAwb.set(sc.awb_code, list)
    }
  }
  const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      <div className="border-b-2 border-[var(--charcoal-ink)]/20 pb-4">
        <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)]">Your Orders</h1>
        <p className="font-sans text-sm opacity-70 mt-1 uppercase tracking-widest">Order History & Tracking</p>
      </div>

      <div className="space-y-8">
        {orders?.map((order) => (
          <div key={order.id} className="border-4 border-double border-[var(--charcoal-ink)] p-6 bg-white shadow-[4px_4px_0_var(--turmeric)]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-[var(--charcoal-ink)]/10 pb-4">
              <div>
                <div className="font-mono text-xs opacity-75 mb-1">ORDER #{order.id.split('-')[0].toUpperCase()}</div>
                <div className="font-bold">{new Date(order.created_at).toLocaleDateString()}</div>
              </div>
              <div className="mt-2 md:mt-0 text-right">
                <div className="font-serif text-xl font-bold text-[var(--madder-red)] tabular-nums">₹{Number(order.total_amount).toFixed(2)}</div>
                {order.order_kind === 'swatch' && (
                  <div className="text-xs font-bold uppercase tracking-widest text-[var(--indigo-dye)]">Swatch kit</div>
                )}
                {order.invoice_number && (
                  <div className="font-mono text-xs opacity-75">Invoice {order.invoice_number}</div>
                )}
                {Number(order.credit_applied) > 0 && (
                  <div className="text-xs opacity-75 tabular-nums">Swatch credit used ₹{Number(order.credit_applied).toFixed(2)}</div>
                )}
                {Number(order.cgst_total) + Number(order.sgst_total) + Number(order.igst_total) > 0 && (
                  <div className="text-xs opacity-75 tabular-nums">
                    {Number(order.igst_total) > 0
                      ? `incl. IGST ₹${Number(order.igst_total).toFixed(2)}`
                      : `incl. CGST ₹${Number(order.cgst_total).toFixed(2)} + SGST ₹${Number(order.sgst_total).toFixed(2)}`}
                  </div>
                )}
                {order.awb_code ? (
                  <div className="font-mono text-xs uppercase tracking-widest opacity-70">{order.courier_name || 'Courier'} · AWB {order.awb_code}</div>
                ) : order.tracking_status ? (
                  <div className="font-mono text-xs uppercase tracking-widest opacity-70">TRK: {order.tracking_status}</div>
                ) : null}
                <div className="mt-2 flex md:justify-end items-center gap-2">
                  <span className={`px-2 py-0.5 text-[9px] uppercase tracking-widest font-bold border ${order.is_paid ? 'border-green-700 text-green-800' : 'border-[var(--madder-red)] text-[var(--madder-red)]'}`}>
                    {order.is_paid ? 'Paid' : 'Payment Pending'}
                  </span>
                </div>
                {order.is_paid && (
                  <a
                    href={`/api/invoice/${order.id}`}
                    download
                    className="mt-2 inline-block text-[10px] uppercase tracking-widest font-bold text-[var(--indigo-dye)] underline underline-offset-4"
                  >
                    Download GST invoice (PDF)
                  </a>
                )}
                {(order.status === 'pending' || order.status === 'paid') && !order.cancellation_requested && (
                  <form action={async () => { 'use server'; await requestCancellation(order.id); }} className="mt-2 md:flex md:justify-end">
                    <button type="submit" className="text-[10px] uppercase tracking-widest font-bold text-[var(--madder-red)] border border-[var(--madder-red)]/50 px-3 py-1 hover:bg-[var(--madder-red)] hover:text-white transition-colors">
                      Request Cancellation
                    </button>
                  </form>
                )}
                {order.cancellation_requested && order.status !== 'cancelled' && (
                  <div className="mt-2 text-[10px] uppercase tracking-widest font-bold text-[var(--turmeric-ink)]">Cancellation requested</div>
                )}
              </div>
            </div>

            {/* Visual Timeline Component */}
            <div className="mb-8">
              <div className="flex items-center justify-between relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-[var(--charcoal-ink)]/10 z-0"></div>
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[var(--indigo-dye)] z-0 transition-all duration-500`} 
                     style={{ width: order.status === 'pending' ? '15%' : order.status === 'shipped' ? '50%' : '100%' }}></div>
                
                <div className="relative z-10 flex flex-col items-center">
                  <div className={`w-4 h-4 rounded-full border-2 ${order.status === 'pending' || order.status === 'shipped' || order.status === 'delivered' ? 'bg-[var(--indigo-dye)] border-[var(--indigo-dye)]' : 'bg-white border-[var(--charcoal-ink)]/20'}`}></div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mt-2">Processing</div>
                </div>
                <div className="relative z-10 flex flex-col items-center">
                  <div className={`w-4 h-4 rounded-full border-2 ${order.status === 'shipped' || order.status === 'delivered' ? 'bg-[var(--indigo-dye)] border-[var(--indigo-dye)]' : 'bg-white border-[var(--charcoal-ink)]/20'}`}></div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mt-2">Shipped</div>
                </div>
                <div className="relative z-10 flex flex-col items-center">
                  <div className={`w-4 h-4 rounded-full border-2 ${order.status === 'delivered' ? 'bg-[var(--indigo-dye)] border-[var(--indigo-dye)]' : 'bg-white border-[var(--charcoal-ink)]/20'}`}></div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mt-2">Delivered</div>
                </div>
              </div>
            </div>

            {order.awb_code && (
              <section aria-label={`Courier updates for order ${order.id.split('-')[0].toUpperCase()}`} className="mb-6 border-2 border-[var(--charcoal-ink)]/10 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-75">Courier updates</h3>
                  {order.expected_delivery_at && order.status !== 'delivered' && (
                    <span className="text-xs">Expected by <strong>{new Date(order.expected_delivery_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })}</strong></span>
                  )}
                </div>
                {order.shipment_status && (
                  <p className="mt-1 text-sm font-bold">{order.shipment_status}{order.shipment_status_at ? <span className="font-normal opacity-75"> · {when(order.shipment_status_at)}</span> : null}</p>
                )}
                {(scansByAwb.get(order.awb_code)?.length ?? 0) > 0 ? (
                  <ol className="mt-3 space-y-2 border-l-2 border-[var(--turmeric)] pl-3 text-xs">
                    {scansByAwb.get(order.awb_code)!.slice(0, 12).map((sc, i) => (
                      <li key={i}>
                        <span className="font-bold">{sc.status_label}</span>
                        {sc.activity ? ` — ${sc.activity}` : ''}
                        <span className="block opacity-75">{[sc.location, when(sc.event_at)].filter(Boolean).join(' · ')}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-1 text-xs opacity-75">The courier has not sent any scans yet.</p>
                )}
              </section>
            )}

            {/* Order Items */}
            <div className="bg-[var(--unbleached-cotton)] p-4 border-2 border-[var(--charcoal-ink)]/10">
              <h3 className="text-[10px] uppercase font-bold tracking-widest opacity-75 mb-3">Items</h3>
              <div className="space-y-3">
                {order.order_items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-sm font-bold">
                    <div>
                      <span className="tabular-nums">{formatQuantity(Number(item.quantity), item.uqc === 'PCS' ? 'PCS' : 'MTR')} </span>
                      <span>{item.product_variants?.products?.title}</span>
                      <span className="opacity-75 ml-2">({item.product_variants?.color})</span>
                      {item.dye_lot && <span className="block text-xs font-normal opacity-70">Dye lot {item.dye_lot}</span>}
                    </div>
                    <div className="opacity-80 tabular-nums">₹{lineTotal(Number(item.unit_price), Number(item.quantity)).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ))}

        {(!orders || orders.length === 0) && (
          <div className="text-center p-12 border-2 border-dashed border-[var(--charcoal-ink)]/20">
            <p className="font-sans uppercase tracking-widest text-sm opacity-75">No orders placed yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
