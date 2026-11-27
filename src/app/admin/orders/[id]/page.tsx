import { createClient } from '@/lib/supabase/server';
import { requireAdminPage } from '@/lib/dal/session';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cancelOrder } from '@/actions/orders';
import { asUnit, formatQuantity, lineTotal } from '@/lib/meterage';

export const dynamic = 'force-dynamic';

const money = (n: any) => `₹${Number(n || 0).toFixed(2)}`;

function statusClasses(status: string) {
  if (status === 'pending') return 'border-yellow-500/50 text-yellow-500';
  if (status === 'shipped') return 'border-blue-500/50 text-blue-500';
  if (status === 'delivered') return 'border-green-500/50 text-green-500';
  if (status === 'paid') return 'border-[var(--turmeric)]/50 text-[var(--turmeric)]';
  if (status === 'cancelled') return 'border-red-500/50 text-red-500';
  return 'border-white/20 text-white/90';
}

function paymentStatusClasses(status: string) {
  if (status === 'captured') return 'border-green-500/50 text-green-500';
  if (status === 'created' || status === 'authorized') return 'border-yellow-500/50 text-yellow-500';
  if (status === 'failed') return 'border-red-500/50 text-red-500';
  if (status === 'refunded') return 'border-blue-500/50 text-blue-500';
  return 'border-white/20 text-white/90';
}

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select(
      '*, order_items(id, status, quantity, uqc, dye_lot, unit_price, order_item_cuts(roll_code, status), product_variants(color, sku, products(title))), discounts(code, type, value)'
    )
    .eq('id', id)
    .single();

  if (!order) {
    notFound();
  }

  let customer: { full_name: string | null; phone: string | null } | null = null;
  if (order.user_id) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', order.user_id)
      .single();
    customer = prof || null;
  }

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', id)
    .order('created_at', { ascending: true });

  const { data: events } = await supabase
    .from('order_events')
    .select('*')
    .eq('order_id', id)
    .order('created_at', { ascending: true });

  const addr: any = order.shipping_address || {};
  const customerName =
    customer?.full_name ||
    [addr.firstName, addr.lastName].filter(Boolean).join(' ') ||
    addr.full_name ||
    'Guest';
  const addressLines = [
    addr.address1 || addr.address,
    addr.address2,
    [addr.city, addr.state, addr.pinCode || addr.zip].filter(Boolean).join(', '),
  ].filter(Boolean);

  return (
    <div className="p-6 md:p-8 min-h-screen bg-[var(--charcoal-ink)] text-white">
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1 text-xs uppercase tracking-widest opacity-70 hover:opacity-100 mb-6"
      >
        <ChevronLeft size={14} /> Back to orders
      </Link>

      <div className="flex flex-wrap items-center gap-4 border-b border-white/10 pb-6 mb-8">
        <h1 className="font-serif text-3xl font-bold tracking-wide">
          Order #{order.id.split('-')[0].toUpperCase()}
        </h1>
        <span className={`px-2 py-1 text-[10px] uppercase tracking-widest font-bold border ${statusClasses(order.status)}`}>
          {order.status}
        </span>
        <span className={`px-2 py-1 text-[10px] uppercase tracking-widest font-bold border ${order.is_paid ? 'border-green-500/50 text-green-500' : 'border-white/20 text-white/90'}`}>
          {order.is_paid ? 'Paid' : 'Unpaid'}
        </span>
        <span className="ml-auto text-xs opacity-60 font-mono">
          {new Date(order.created_at).toLocaleString()}
        </span>
      </div>

      {order.status !== 'cancelled' && (
        <div className="flex flex-wrap items-center gap-4 mb-8 -mt-4">
          {order.cancellation_requested && (
            <span className="text-xs uppercase tracking-widest font-bold text-[var(--turmeric)]">
              Customer requested cancellation
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <form action={async () => { 'use server'; await cancelOrder(order.id, false); }}>
              <button type="submit" className="text-[10px] uppercase tracking-widest font-bold border border-orange-500/50 text-orange-400 px-3 py-1.5 hover:bg-orange-500 hover:text-white transition-colors" title="Cancel order without returning items to active stock.">
                Refund Only (Shrinkage)
              </button>
            </form>
            <form action={async () => { 'use server'; await cancelOrder(order.id, true); }}>
              <button type="submit" className="text-[10px] uppercase tracking-widest font-bold border border-red-500/50 text-red-400 px-3 py-1.5 hover:bg-red-500 hover:text-white transition-colors" title="Cancel order and return items to active stock.">
                Cancel &amp; Restock
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: customer + items + totals */}
        <div className="lg:col-span-2 space-y-8">
          <section className="border border-white/15 bg-[#111] p-6">
            <h2 className="text-[10px] uppercase tracking-widest font-bold text-[var(--turmeric)] mb-3">Customer</h2>
            <div className="font-bold">{customerName}</div>
            {customer?.phone && <div className="text-sm opacity-70">{customer.phone}</div>}
            {addr.email && <div className="text-sm opacity-70">{addr.email}</div>}
            {addressLines.length > 0 && (
              <div className="mt-3 text-sm opacity-80 leading-relaxed">
                {addressLines.map((l: string, i: number) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            )}
          </section>

          <section className="border border-white/15 bg-[#111]">
            <h2 className="text-[10px] uppercase tracking-widest font-bold text-[var(--turmeric)] p-6 pb-3">Items</h2>
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] uppercase tracking-widest opacity-50 border-b border-white/10">
                <tr>
                  <th className="px-6 py-2 font-bold">Item</th>
                  <th className="px-6 py-2 font-bold text-center">Qty</th>
                  <th className="px-6 py-2 font-bold text-right">Unit</th>
                  <th className="px-6 py-2 font-bold text-right">Line</th>
                  <th className="px-6 py-2 font-bold text-right">Status / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(order.order_items || []).map((it: any, i: number) => (
                  <tr key={i}>
                    <td className="px-6 py-3">
                      <div className="font-bold">{it.product_variants?.products?.title || 'Item'}</div>
                      <div className="text-xs opacity-50">
                        {it.product_variants?.color}
                        {it.product_variants?.sku ? ` · ${it.product_variants.sku}` : ''}
                      </div>
                      {(() => {
                        const cut = Array.isArray(it.order_item_cuts) ? it.order_item_cuts[0] : it.order_item_cuts;
                        if (!cut && !it.dye_lot) return null;
                        return (
                          <div className="text-xs opacity-70 font-mono mt-1">
                            {cut?.roll_code ? `Roll ${cut.roll_code}` : ''}
                            {it.dye_lot ? ` · Dye lot ${it.dye_lot}` : ''}
                            {cut?.status ? (
                              <span className={`ml-2 uppercase tracking-widest text-[9px] font-sans font-bold ${cut.status === 'cut' ? 'text-green-400' : cut.status === 'released' ? 'text-white/50' : 'text-[var(--turmeric)]'}`}>
                                {cut.status === 'allocated' ? 'to cut' : cut.status}
                              </span>
                            ) : null}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-3 text-center tabular-nums">{formatQuantity(Number(it.quantity), asUnit(it.uqc === 'PCS' ? 'PCS' : 'MTR'))}</td>
                    <td className="px-6 py-3 text-right tabular-nums">{money(it.unit_price)}</td>
                    <td className="px-6 py-3 text-right tabular-nums">{money(lineTotal(Number(it.unit_price), Number(it.quantity)))}</td>
                    <td className="px-6 py-3 text-right flex justify-end items-center gap-2">
                      {it.status !== 'pending' && it.status !== 'fulfilled' ? (
                        <span className={`text-[9px] uppercase tracking-widest font-bold ${it.status === 'refunded' ? 'text-orange-400' : 'text-red-400'}`}>
                          {it.status}
                        </span>
                      ) : (
                        <>
                          <form action={async () => {
                            'use server';
                            const { partialCancelOrderItem } = await import('@/actions/orders');
                            await partialCancelOrderItem(order.id, it.id, false);
                          }}>
                            <button type="submit" className="text-[9px] uppercase tracking-widest border border-orange-500/30 text-orange-400 px-2 py-1 hover:bg-orange-500 hover:text-white" title="Refund Only">
                              Shrinkage
                            </button>
                          </form>
                          <form action={async () => {
                            'use server';
                            const { partialCancelOrderItem } = await import('@/actions/orders');
                            await partialCancelOrderItem(order.id, it.id, true);
                          }}>
                            <button type="submit" className="text-[9px] uppercase tracking-widest border border-red-500/30 text-red-400 px-2 py-1 hover:bg-red-500 hover:text-white" title="Cancel & Restock">
                              Restock
                            </button>
                          </form>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {(!order.order_items || order.order_items.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-center opacity-50 text-xs uppercase tracking-widest">
                      No line items recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="border-t border-white/10 p-6 space-y-1 text-sm tabular-nums">
              {order.order_kind === 'swatch' && (
                <div className="pb-2 mb-2 border-b border-white/10 text-xs font-bold uppercase tracking-widest text-[var(--turmeric)]">
                  Swatch kit: no cutting, send sample cards
                </div>
              )}
              {order.invoice_number && (
                <div className="flex justify-between pb-2 mb-2 border-b border-white/10">
                  <span className="opacity-80">Tax invoice</span>
                  <span className="font-mono">{order.invoice_number}</span>
                </div>
              )}
              {(order.place_of_supply || order.buyer_gstin) && (
                <div className="flex justify-between opacity-80 text-xs">
                  <span>Place of supply {order.place_of_supply}</span>
                  {order.buyer_gstin && <span className="font-mono">GSTIN {order.buyer_gstin}</span>}
                </div>
              )}
              <div className="flex justify-between opacity-80"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
              {order.taxable_value != null ? (
                <>
                  <div className="flex justify-between opacity-80"><span>Taxable value</span><span>{money(order.taxable_value)}</span></div>
                  {Number(order.cgst_total) > 0 && <div className="flex justify-between opacity-80"><span>CGST</span><span>{money(order.cgst_total)}</span></div>}
                  {Number(order.sgst_total) > 0 && <div className="flex justify-between opacity-80"><span>SGST</span><span>{money(order.sgst_total)}</span></div>}
                  {Number(order.igst_total) > 0 && <div className="flex justify-between opacity-80"><span>IGST</span><span>{money(order.igst_total)}</span></div>}
                </>
              ) : (
                <div className="flex justify-between opacity-80"><span>Tax</span><span>{money(order.tax_amount)}</span></div>
              )}
              <div className="flex justify-between opacity-80"><span>Shipping</span><span>{money(order.shipping_amount)}</span></div>
              {Number(order.discount_applied) > 0 && (
                <div className="flex justify-between text-green-500">
                  <span>Discount{order.discounts?.code ? ` (${order.discounts.code})` : ''}</span>
                  <span>- {money(order.discount_applied)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-[var(--turmeric)] text-lg pt-2 border-t border-white/10 mt-2">
                <span>Total</span><span>{money(order.total_amount)}</span>
              </div>
              {Number(order.credit_applied) > 0 && (
                <>
                  <div className="flex justify-between opacity-80"><span>Paid with swatch credit</span><span>{money(order.credit_applied)}</span></div>
                  <div className="flex justify-between font-bold"><span>Due via gateway</span><span>{money(order.amount_due)}</span></div>
                </>
              )}
            </div>
          </section>
        </div>

        {/* Right: payments ledger + event timeline */}
        <div className="space-y-8">
          
          <section className="border border-white/15 bg-[#111] p-6">
            <h2 className="text-[10px] uppercase tracking-widest font-bold text-[var(--turmeric)] mb-4">Fulfillment</h2>
            <form action={async (formData) => {
              'use server';
              const { updateOrderStatus } = await import('@/actions/orders');
              await updateOrderStatus(
                order.id, 
                formData.get('status') as string,
                (formData.get('courierName') as string) || undefined,
                (formData.get('awbCode') as string) || undefined
              );
            }} className="space-y-4">
              <div>
                <label htmlFor="order-status" className="block text-[10px] uppercase tracking-widest opacity-60 mb-1">Update Status</label>
                <select id="order-status" name="status" defaultValue={order.status} className="w-full bg-black border border-white/20 p-2 text-sm focus:outline-none focus:border-[var(--turmeric)]">
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="order-courier" className="block text-[10px] uppercase tracking-widest opacity-60 mb-1">Courier</label>
                  <input id="order-courier" type="text" name="courierName" maxLength={100} defaultValue={order.courier_name || ''} placeholder="e.g. Delhivery" className="w-full bg-black border border-white/20 p-2 text-sm focus:outline-none focus:border-[var(--turmeric)]" />
                </div>
                <div>
                  <label htmlFor="order-awb" className="block text-[10px] uppercase tracking-widest opacity-60 mb-1">AWB number</label>
                  <input id="order-awb" type="text" name="awbCode" pattern="[A-Za-z0-9\-]{4,40}" defaultValue={order.awb_code || ''} placeholder="e.g. 19041424751540" className="w-full bg-black border border-white/20 p-2 font-mono text-sm focus:outline-none focus:border-[var(--turmeric)]" />
                </div>
              </div>
              {order.shipment_status && (
                <p className="text-xs opacity-80">Courier says: <strong>{order.shipment_status}</strong>{order.shipment_status_at ? ` (${new Date(order.shipment_status_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })})` : ''}</p>
              )}
              <button type="submit" className="w-full text-[10px] uppercase tracking-widest font-bold bg-[var(--turmeric)] text-black px-3 py-2 hover:bg-white transition-colors">
                Save Updates
              </button>
            </form>
          </section>

          <section className="border border-white/15 bg-[#111] p-6">
            <h2 className="text-[10px] uppercase tracking-widest font-bold text-[var(--turmeric)] mb-4">Payment Ledger</h2>
            {payments && payments.length > 0 ? (
              <div className="space-y-4">
                {payments.map((p: any) => (
                  <div key={p.id} className="border border-white/10 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{money(p.amount)} <span className="opacity-50 text-xs">{p.currency}</span></span>
                      <span className={`px-2 py-0.5 text-[9px] uppercase tracking-widest font-bold border ${paymentStatusClasses(p.status)}`}>
                        {p.status}
                      </span>
                    </div>
                    <div className="text-xs opacity-60 mt-2">
                      {p.provider}{p.method ? ` · ${p.method}` : ''}
                    </div>
                    {p.provider_payment_id && (
                      <div className="text-[10px] opacity-50 font-mono mt-1 break-all">{p.provider_payment_id}</div>
                    )}
                    <div className="text-[10px] opacity-70 mt-1">{new Date(p.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs opacity-50 uppercase tracking-widest">No payments recorded.</p>
            )}
          </section>

          <section className="border border-white/15 bg-[#111] p-6">
            <h2 className="text-[10px] uppercase tracking-widest font-bold text-[var(--turmeric)] mb-4">Event Timeline</h2>
            {events && events.length > 0 ? (
              <ol className="relative border-l border-white/15 ml-2 space-y-5">
                {events.map((e: any) => (
                  <li key={e.id} className="ml-4">
                    <div className="absolute -left-[5px] mt-1 w-2.5 h-2.5 rounded-full bg-[var(--turmeric)]" />
                    <div className="text-sm font-bold">{e.event}</div>
                    {(e.from_status || e.to_status) && (
                      <div className="text-xs opacity-60">
                        {e.from_status ? `${e.from_status} → ` : ''}{e.to_status}
                      </div>
                    )}
                    {e.note && <div className="text-xs opacity-70 mt-0.5">{e.note}</div>}
                    <div className="text-[10px] opacity-70 mt-1">{new Date(e.created_at).toLocaleString()}</div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs opacity-50 uppercase tracking-widest">No events recorded yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
