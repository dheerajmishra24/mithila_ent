import { createClient } from '@/lib/supabase/server'
import { updateOrderStatus } from '@/actions/orders'
import { revalidatePath } from 'next/cache'

export default async function AdminOrdersPage() {
  const supabase = await createClient()
  
  // Fetch orders with user details and item counts
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, 
      status, 
      total_amount, 
      tracking_status,
      created_at,
      shipping_address,
      profiles!orders_user_id_fkey(full_name, phone)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 min-h-screen bg-[var(--charcoal-ink)] text-white">
      <div className="mb-10 border-b border-white/10 pb-6">
        <h1 className="font-serif text-3xl font-bold tracking-wide">Command Center: Orders</h1>
        <p className="font-sans text-sm uppercase tracking-widest text-[var(--turmeric)] mt-2 opacity-80">Logistics & Fulfillment Ledger</p>
      </div>

      <div className="overflow-hidden border border-white/20 bg-[#111] shadow-[8px_8px_0_var(--turmeric)]">
        <table className="w-full text-left font-sans text-sm">
          <thead className="bg-[#1a1a1a] text-[var(--unbleached-cotton)] uppercase tracking-widest text-[10px] border-b border-white/20">
            <tr>
              <th className="p-4 font-bold">Order ID / Date</th>
              <th className="p-4 font-bold">Customer</th>
              <th className="p-4 font-bold">Total</th>
              <th className="p-4 font-bold">Status</th>
              <th className="p-4 font-bold">Logistics Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {orders?.map((order) => (
              <tr key={order.id} className="hover:bg-white/5 transition-colors">
                <td className="p-4 align-top">
                  <div className="font-mono text-xs opacity-60 mb-1">{order.id.split('-')[0]}...</div>
                  <div className="opacity-80 text-xs">{new Date(order.created_at).toLocaleDateString()}</div>
                </td>
                <td className="p-4 align-top">
                  <div className="font-bold">{(order.profiles as any)?.full_name || 'Guest'}</div>
                  <div className="opacity-60 text-xs mt-1">{(order.profiles as any)?.phone || 'No phone'}</div>
                </td>
                <td className="p-4 align-top font-bold text-[var(--turmeric)]">
                  ₹{order.total_amount.toFixed(2)}
                </td>
                <td className="p-4 align-top">
                  <span className={`px-2 py-1 text-[10px] uppercase tracking-widest font-bold border ${
                    order.status === 'pending' ? 'border-yellow-500/50 text-yellow-500' :
                    order.status === 'shipped' ? 'border-blue-500/50 text-blue-500' :
                    order.status === 'delivered' ? 'border-green-500/50 text-green-500' :
                    'border-white/20 text-white/70'
                  }`}>
                    {order.status}
                  </span>
                  {order.tracking_status && (
                    <div className="mt-2 text-xs opacity-70 font-mono tracking-tight">TRK: {order.tracking_status}</div>
                  )}
                </td>
                <td className="p-4 align-top">
                  {order.status === 'pending' && (
                    <form action={async (formData) => {
                      'use server';
                      const tracking = formData.get('tracking') as string;
                      await updateOrderStatus(order.id, 'shipped', tracking);
                    }} className="flex flex-col gap-2">
                      <input 
                        type="text" 
                        name="tracking" 
                        placeholder="Tracking Number" 
                        required
                        className="bg-transparent border border-white/20 p-2 text-xs focus:outline-none focus:border-[var(--turmeric)] placeholder:opacity-40"
                      />
                      <button type="submit" className="bg-[var(--turmeric)] text-[#111] font-bold text-[10px] uppercase tracking-widest py-2 hover:bg-white transition-colors">
                        Mark Shipped
                      </button>
                    </form>
                  )}
                  {order.status === 'shipped' && (
                    <form action={async () => {
                      'use server';
                      await updateOrderStatus(order.id, 'delivered');
                    }}>
                      <button type="submit" className="w-full bg-green-900/40 border border-green-500/50 text-green-500 font-bold text-[10px] uppercase tracking-widest py-2 hover:bg-green-500 hover:text-white transition-colors">
                        Mark Delivered
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!orders || orders.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center opacity-50 uppercase tracking-widest text-xs">No orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
