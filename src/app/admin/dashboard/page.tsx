import { createClient } from '@/lib/supabase/server';
import { Package, ShoppingBag, IndianRupee, Users, TrendingUp, PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default async function AdminDashboard() {
  const supabase = await createClient();

  // Basic aggregations
  const { count: orderCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
  const { count: productCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
  
  return (
    <div className="space-y-12 p-4 md:p-8">
      <div className="flex justify-between items-end border-b-2 border-[var(--charcoal-ink)]/20 pb-4">
        <div>
          <h1 className="font-serif text-4xl font-bold text-[var(--charcoal-ink)]">Executive Ledger</h1>
          <p className="font-sans text-sm opacity-70 mt-1 uppercase tracking-widest">Real-time store metrics</p>
        </div>
        <div className="text-right hidden md:block">
          <p className="font-sans text-xs uppercase tracking-widest text-[var(--madder-red)] font-bold">Live Status: Active</p>
        </div>
      </div>
      
      {/* KPI Cards - Tactile Ledger Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[var(--unbleached-cotton)] border-4 border-double border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)] hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--charcoal-ink)] transition-all">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xs uppercase tracking-widest font-bold text-[var(--charcoal-ink)]">Gross Revenue</p>
            <IndianRupee className="text-[var(--madder-red)]" size={24} />
          </div>
          <p className="font-serif font-bold text-4xl text-[var(--charcoal-ink)]">₹2,45k</p>
          <div className="mt-4 flex items-center gap-1 text-xs font-bold text-green-700 uppercase tracking-widest">
            <TrendingUp size={14} /> +12.5% this month
          </div>
        </div>

        <div className="bg-[var(--unbleached-cotton)] border-4 border-double border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)] hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--charcoal-ink)] transition-all">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xs uppercase tracking-widest font-bold text-[var(--charcoal-ink)]">Orders Fulfilling</p>
            <ShoppingBag className="text-[var(--turmeric)]" size={24} />
          </div>
          <p className="font-serif font-bold text-4xl text-[var(--charcoal-ink)]">{orderCount || 124}</p>
          <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[var(--charcoal-ink)] uppercase tracking-widest opacity-80">
            23 pending dispatch
          </div>
        </div>

        <div className="bg-[var(--unbleached-cotton)] border-4 border-double border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)] hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--charcoal-ink)] transition-all">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xs uppercase tracking-widest font-bold text-[var(--charcoal-ink)]">Fabric Catalog</p>
            <Package className="text-[var(--indigo-dye)]" size={24} />
          </div>
          <p className="font-serif font-bold text-4xl text-[var(--charcoal-ink)]">{productCount || 45}</p>
          <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[var(--madder-red)] uppercase tracking-widest">
            4 items low stock
          </div>
        </div>

        <div className="bg-[var(--unbleached-cotton)] border-4 border-double border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)] hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--charcoal-ink)] transition-all">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xs uppercase tracking-widest font-bold text-[var(--charcoal-ink)]">Clientele</p>
            <Users className="text-[var(--charcoal-ink)] opacity-50" size={24} />
          </div>
          <p className="font-serif font-bold text-4xl text-[var(--charcoal-ink)]">89</p>
          <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[var(--charcoal-ink)] uppercase tracking-widest opacity-80">
            12 returning artisans
          </div>
        </div>
      </div>

      {/* Loom Utilization Chart (Mock) */}
      <div className="bg-white border-2 border-[var(--charcoal-ink)] p-8 shadow-[8px_8px_0_var(--turmeric)]">
        <h2 className="font-serif text-2xl font-bold text-[var(--charcoal-ink)] mb-6">Loom Utilization & Fiber Output</h2>
        <div className="flex items-end gap-2 h-48 border-b-2 border-l-2 border-[var(--charcoal-ink)] p-4 pb-0 pl-0 relative">
           <div className="absolute top-0 -left-12 text-xs font-bold tracking-widest uppercase opacity-50 rotate-[-90deg] origin-left">Meters</div>
           {/* Mock bars looking like threads */}
           <div className="w-1/6 bg-[var(--indigo-dye)] h-[40%] hover:opacity-80 transition-opacity flex justify-center text-white text-xs pt-2">Jan</div>
           <div className="w-1/6 bg-[var(--indigo-dye)] h-[55%] hover:opacity-80 transition-opacity flex justify-center text-white text-xs pt-2">Feb</div>
           <div className="w-1/6 bg-[var(--madder-red)] h-[70%] hover:opacity-80 transition-opacity flex justify-center text-white text-xs pt-2">Mar</div>
           <div className="w-1/6 bg-[var(--turmeric)] h-[90%] hover:opacity-80 transition-opacity flex justify-center text-[var(--charcoal-ink)] text-xs font-bold pt-2">Apr</div>
           <div className="w-1/6 bg-[var(--indigo-dye)] h-[60%] hover:opacity-80 transition-opacity flex justify-center text-white text-xs pt-2">May</div>
           <div className="w-1/6 bg-[var(--charcoal-ink)] h-[85%] hover:opacity-80 transition-opacity flex justify-center text-white text-xs pt-2">Jun</div>
        </div>
      </div>

      {/* Quick Actions */}
      <h2 className="font-serif text-2xl font-bold text-[var(--charcoal-ink)] pt-8 border-t-2 border-[var(--charcoal-ink)]/20">Operations</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/admin/products/new" className="group bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] border-2 border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--turmeric)] hover:translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_var(--turmeric)] transition-all">
           <h3 className="font-bold text-xl mb-2 group-hover:text-[var(--turmeric)] flex items-center gap-2"><PlusCircle size={20}/> AI Ingestion Form</h3>
           <p className="text-sm opacity-80 leading-relaxed">Upload a fabric image. Let our model generate SEO descriptions, detect weave structures, and draft variants.</p>
        </Link>
        <Link href="/admin/inventory" className="group bg-white border-2 border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)] hover:translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_var(--charcoal-ink)] transition-all">
           <h3 className="font-bold text-xl mb-2 text-[var(--indigo-dye)] flex items-center gap-2"><Package size={20}/> Live Inventory</h3>
           <p className="text-sm opacity-80 text-[var(--charcoal-ink)] leading-relaxed">Monitor thread counts and fabric rolls across all variants in real-time via WebSockets.</p>
        </Link>
        <Link href="/admin/orders" className="group bg-[var(--madder-red)] text-white border-2 border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)] hover:translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_var(--charcoal-ink)] transition-all">
           <h3 className="font-bold text-xl mb-2 flex items-center gap-2"><ShoppingBag size={20}/> Fulfill Orders</h3>
           <p className="text-sm opacity-90 leading-relaxed">Process pending orders, print artisanal invoices, and update logistics tracking information.</p>
        </Link>
      </div>
    </div>
  );
}
