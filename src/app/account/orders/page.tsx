import { createClient } from '@/lib/supabase/server'
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
      tracking_status,
      created_at,
      order_items(
        quantity,
        unit_price,
        product_variants(color, products(title))
      )
    `)
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false })

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
                <div className="font-mono text-xs opacity-50 mb-1">ORDER #{order.id.split('-')[0].toUpperCase()}</div>
                <div className="font-bold">{new Date(order.created_at).toLocaleDateString()}</div>
              </div>
              <div className="mt-2 md:mt-0 text-right">
                <div className="font-serif text-xl font-bold text-[var(--madder-red)]">₹{order.total_amount.toFixed(2)}</div>
                {order.tracking_status && (
                  <div className="font-mono text-xs uppercase tracking-widest opacity-70">TRK: {order.tracking_status}</div>
                )}
                <div className="mt-2 flex md:justify-end items-center gap-2">
                  <span className={`px-2 py-0.5 text-[9px] uppercase tracking-widest font-bold border ${order.is_paid ? 'border-green-600 text-green-700' : 'border-[var(--madder-red)] text-[var(--madder-red)]'}`}>
                    {order.is_paid ? 'Paid' : 'Payment Pending'}
                  </span>
                </div>
                {(order.status === 'pending' || order.status === 'paid') && !order.cancellation_requested && (
                  <form action={async () => { 'use server'; await requestCancellation(order.id); }} className="mt-2 md:flex md:justify-end">
                    <button type="submit" className="text-[10px] uppercase tracking-widest font-bold text-[var(--madder-red)] border border-[var(--madder-red)]/50 px-3 py-1 hover:bg-[var(--madder-red)] hover:text-white transition-colors">
                      Request Cancellation
                    </button>
                  </form>
                )}
                {order.cancellation_requested && order.status !== 'cancelled' && (
                  <div className="mt-2 text-[10px] uppercase tracking-widest font-bold text-[var(--turmeric)]">Cancellation requested</div>
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

            {/* Order Items */}
            <div className="bg-[var(--unbleached-cotton)] p-4 border-2 border-[var(--charcoal-ink)]/10">
              <h3 className="text-[10px] uppercase font-bold tracking-widest opacity-50 mb-3">Items</h3>
              <div className="space-y-3">
                {order.order_items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-sm font-bold">
                    <div>
                      <span>{item.quantity}x </span>
                      <span>{item.product_variants?.products?.title}</span>
                      <span className="opacity-50 ml-2">({item.product_variants?.color})</span>
                    </div>
                    <div className="opacity-80">₹{(item.unit_price * item.quantity).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ))}

        {(!orders || orders.length === 0) && (
          <div className="text-center p-12 border-2 border-dashed border-[var(--charcoal-ink)]/20">
            <p className="font-sans uppercase tracking-widest text-sm opacity-50">No orders placed yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
