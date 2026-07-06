"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function OrderListClient({ initialOrders }: { initialOrders: any[] }) {
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [orders, setOrders] = useState(initialOrders || []);
  const supabase = createClient();
  const router = useRouter();

  const handlePrint = () => {
    window.print();
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    // Optimistic update
    setOrders(orders.map((o: any) => o.id === orderId ? { ...o, status: newStatus } : o));
    
    // DB update
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (error) {
      alert("Failed to update status: " + error.message);
      router.refresh(); // Revert on failure
    }
  };

  return (
    <div className="relative">
      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        {orders.length === 0 ? (
          <div className="bg-[var(--unbleached-cotton)] border-2 border-[var(--charcoal-ink)] p-6 text-center font-serif text-lg opacity-50">No orders found.</div>
        ) : (
          orders.map((order: any) => (
            <div key={order.id} className="bg-[var(--unbleached-cotton)] border-2 border-[var(--charcoal-ink)] p-4 shadow-[4px_4px_0_var(--charcoal-ink)]">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="font-bold text-[var(--charcoal-ink)]">#{order.id.split('-')[0]}</p>
                  <p className="text-xs opacity-70">{new Date(order.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`shrink-0 px-2 py-1 text-[10px] font-bold uppercase tracking-widest border-2 ${order.is_paid ? 'border-green-600 text-green-700 bg-green-50' : 'border-red-600 text-red-700 bg-red-50'}`}>{order.is_paid ? 'Paid' : 'Unpaid'}</span>
              </div>
              <div className="flex justify-between items-center mt-3 text-sm">
                <span className="font-bold">{order.profiles?.full_name || 'Guest User'}</span>
                <span className="font-bold text-[var(--madder-red)]">&#8377;{order.total_amount}</span>
              </div>
              <div className="mt-3">
                <label className="block text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Status</label>
                <select
                  value={order.status}
                  onChange={(e) => handleStatusChange(order.id, e.target.value)}
                  className="w-full bg-transparent border-2 border-[var(--charcoal-ink)] p-2 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-[var(--madder-red)]"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <Button
                onClick={() => setSelectedOrder(order)}
                className="w-full mt-3 text-xs py-2 bg-transparent text-[var(--charcoal-ink)] border-2 border-[var(--charcoal-ink)] hover:bg-[var(--charcoal-ink)] hover:text-white transition-colors"
              >
                View Invoice
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-[var(--unbleached-cotton)] border-4 border-double border-[var(--charcoal-ink)] shadow-[4px_4px_0_var(--charcoal-ink)] overflow-x-auto">
        <table className="w-full text-left font-sans whitespace-nowrap">
          <thead className="bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)]">
            <tr>
              <th className="p-4 uppercase tracking-widest text-xs font-bold">Order ID</th>
              <th className="p-4 uppercase tracking-widest text-xs font-bold">Date</th>
              <th className="p-4 uppercase tracking-widest text-xs font-bold">Customer</th>
              <th className="p-4 uppercase tracking-widest text-xs font-bold">Total</th>
              <th className="p-4 uppercase tracking-widest text-xs font-bold">Payment</th>
              <th className="p-4 uppercase tracking-widest text-xs font-bold">Status</th>
              <th className="p-4 uppercase tracking-widest text-xs font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-[var(--charcoal-ink)]/20">
            {orders.map((order: any) => (
              <tr key={order.id} className="hover:bg-[var(--turmeric)]/20 transition-colors">
                <td className="p-4 font-bold text-[var(--charcoal-ink)]">#{order.id.split('-')[0]}</td>
                <td className="p-4 text-sm opacity-80">{new Date(order.created_at).toLocaleDateString()}</td>
                <td className="p-4 text-sm font-bold">{order.profiles?.full_name || 'Guest User'}</td>
                <td className="p-4 font-bold text-[var(--madder-red)]">₹{order.total_amount}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest border-2 ${order.is_paid ? 'border-green-600 text-green-700 bg-green-50' : 'border-red-600 text-red-700 bg-red-50'}`}>
                    {order.is_paid ? 'Paid' : 'Unpaid'}
                  </span>
                </td>
                <td className="p-4">
                  <select 
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    className="bg-transparent border-2 border-[var(--charcoal-ink)] p-1 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-[var(--madder-red)] cursor-pointer"
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="p-4 text-right">
                  <Button 
                    onClick={() => setSelectedOrder(order)}
                    className="text-xs py-1 px-3 bg-transparent text-[var(--charcoal-ink)] border-2 border-[var(--charcoal-ink)] hover:bg-[var(--charcoal-ink)] hover:text-white transition-colors"
                  >
                    View Invoice
                  </Button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center font-serif text-lg opacity-50">No orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Order Drawer Overlay */}
      <AnimatePresence>
        {selectedOrder && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="fixed inset-0 bg-[var(--charcoal-ink)]/50 z-40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-[var(--unbleached-cotton)] shadow-[-8px_0_0_var(--turmeric)] z-50 overflow-y-auto border-l-4 border-double border-[var(--charcoal-ink)]"
            >
              <div className="p-6">
                <div className="flex justify-between items-center border-b-2 border-[var(--charcoal-ink)] pb-4 mb-6">
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-[var(--charcoal-ink)]">Invoice #{selectedOrder.id.split('-')[0]}</h2>
                    <p className="text-xs uppercase tracking-widest opacity-70 font-sans mt-1">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-[var(--madder-red)] hover:text-white border-2 border-transparent transition-colors">
                    <X size={24} />
                  </button>
                </div>

                {/* Print Section */}
                <div id="print-area" className="bg-white border-2 border-[var(--charcoal-ink)] p-6 mb-6">
                   <div className="text-center border-b-2 border-dashed border-[var(--charcoal-ink)]/30 pb-4 mb-4">
                     <h1 className="font-serif text-2xl font-bold tracking-tight text-[var(--charcoal-ink)]">MITHILA</h1>
                     <p className="text-[10px] tracking-widest uppercase opacity-70 mt-1">Authentic Handloom Heritage</p>
                   </div>
                   
                   <div className="mb-6">
                     <p className="text-xs uppercase tracking-widest font-bold text-[var(--charcoal-ink)] mb-1">Bill To:</p>
                     <p className="font-serif text-lg">{selectedOrder.profiles?.full_name || 'Guest User'}</p>
                     <p className="text-sm opacity-80 mt-1">{selectedOrder.shipping_address || 'Address pending from gateway'}</p>
                     <p className="text-sm opacity-80">{selectedOrder.profiles?.phone || 'No phone provided'}</p>
                   </div>

                   <table className="w-full text-sm font-sans mb-6">
                     <thead>
                       <tr className="border-b-2 border-[var(--charcoal-ink)] text-xs uppercase tracking-widest">
                         <th className="py-2 text-left">Item (Fabric)</th>
                         <th className="py-2 text-center">Meters</th>
                         <th className="py-2 text-right">Price</th>
                       </tr>
                     </thead>
                     <tbody>
                       {selectedOrder.items?.map((item: any, i: number) => (
                         <tr key={i} className="border-b border-[var(--charcoal-ink)]/10">
                           <td className="py-3 font-bold">{item.product_name}</td>
                           <td className="py-3 text-center opacity-80">{item.quantity}</td>
                           <td className="py-3 text-right">₹{item.price * item.quantity}</td>
                         </tr>
                       ))}
                       {(!selectedOrder.items || selectedOrder.items.length === 0) && (
                         <tr className="border-b border-[var(--charcoal-ink)]/10">
                           <td className="py-3 font-bold">Standard Fabric Yardage</td>
                           <td className="py-3 text-center opacity-80">1</td>
                           <td className="py-3 text-right">₹{selectedOrder.total_amount}</td>
                         </tr>
                       )}
                     </tbody>
                     <tfoot>
                       <tr>
                         <td colSpan={2} className="py-4 text-right text-xs uppercase tracking-widest font-bold">Total (INR)</td>
                         <td className="py-4 text-right font-serif text-xl font-bold text-[var(--madder-red)]">₹{selectedOrder.total_amount}</td>
                       </tr>
                     </tfoot>
                   </table>

                   <div className="text-center pt-4 border-t-2 border-[var(--charcoal-ink)]">
                     <p className="font-serif text-sm italic text-[var(--indigo-dye)]">"Woven with time, crafted for life."</p>
                   </div>
                </div>

                <Button onClick={handlePrint} className="w-full flex items-center justify-center gap-2 bg-[var(--charcoal-ink)] text-white hover:bg-[var(--turmeric)] hover:text-[var(--charcoal-ink)] py-6 text-sm uppercase tracking-widest font-bold">
                  <Printer size={18} /> Print Packing Slip
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
