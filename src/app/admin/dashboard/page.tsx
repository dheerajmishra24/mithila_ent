import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { Package, ShoppingBag, IndianRupee, Users, TrendingUp, PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default async function AdminDashboard() {
  await requireAdmin();
  const supabase = await createClient();

  // Live aggregations
  const { count: orderCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
  const { count: productCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
  const { count: customerCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  const { count: pendingCount } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const { data: revenueRows } = await supabase.from('orders').select('total_amount');
  const grossRevenue = (revenueRows || []).reduce((sum, o: any) => sum + Number(o.total_amount || 0), 0);
  const revenueLabel = grossRevenue >= 1000 ? `₹${(grossRevenue / 1000).toFixed(1)}k` : `₹${grossRevenue.toFixed(0)}`;
  
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('id, total_amount, status, is_paid, created_at')
    .order('created_at', { ascending: false })
    .limit(6);

  const { data: lowStock } = await supabase
    .from('product_variants')
    .select('id, color, stock_quantity, products(title)')
    .lt('stock_quantity', 20)
    .order('stock_quantity', { ascending: true })
    .limit(8);
  const lowStockCount = lowStock?.length ?? 0;

  const { data: soldItems } = await supabase
    .from('order_items')
    .select('quantity, product_variants(products(title))');
  const topMap: Record<string, number> = {};
  for (const it of soldItems || []) {
    const title = (it as any).product_variants?.products?.title;
    if (!title) continue;
    topMap[title] = (topMap[title] || 0) + Number(it.quantity || 0);
  }
  const topProducts = Object.entries(topMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

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
          <p className="font-serif font-bold text-4xl text-[var(--charcoal-ink)]">{revenueLabel}</p>
          <div className="mt-4 flex items-center gap-1 text-xs font-bold text-green-700 uppercase tracking-widest">
            <TrendingUp size={14} /> +12.5% this month
          </div>
        </div>

        <div className="bg-[var(--unbleached-cotton)] border-4 border-double border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)] hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--charcoal-ink)] transition-all">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xs uppercase tracking-widest font-bold text-[var(--charcoal-ink)]">Orders Fulfilling</p>
            <ShoppingBag className="text-[var(--turmeric)]" size={24} />
          </div>
          <p className="font-serif font-bold text-4xl text-[var(--charcoal-ink)]">{orderCount ?? 0}</p>
          <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[var(--charcoal-ink)] uppercase tracking-widest opacity-80">
            {pendingCount ?? 0} pending dispatch
          </div>
        </div>

        <div className="bg-[var(--unbleached-cotton)] border-4 border-double border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)] hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--charcoal-ink)] transition-all">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xs uppercase tracking-widest font-bold text-[var(--charcoal-ink)]">Fabric Catalog</p>
            <Package className="text-[var(--indigo-dye)]" size={24} />
          </div>
          <p className="font-serif font-bold text-4xl text-[var(--charcoal-ink)]">{productCount ?? 0}</p>
          <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[var(--madder-red)] uppercase tracking-widest">
            {lowStockCount} items low stock
          </div>
        </div>

        <div className="bg-[var(--unbleached-cotton)] border-4 border-double border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)] hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--charcoal-ink)] transition-all">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xs uppercase tracking-widest font-bold text-[var(--charcoal-ink)]">Clientele</p>
            <Users className="text-[var(--charcoal-ink)] opacity-50" size={24} />
          </div>
          <p className="font-serif font-bold text-4xl text-[var(--charcoal-ink)]">{customerCount ?? 0}</p>
          <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[var(--charcoal-ink)] uppercase tracking-widest opacity-80">
            12 returning artisans
          </div>
        </div>
      </div>

      {/* Recent Orders + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border-2 border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl font-bold text-[var(--charcoal-ink)]">Recent Orders</h2>
            <Link href="/admin/orders" className="text-xs uppercase tracking-widest text-[var(--madder-red)] font-bold hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-[var(--charcoal-ink)]/10">
            {(recentOrders || []).map((o: any) => (
              <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center justify-between py-3 px-2 -mx-2 hover:bg-[var(--unbleached-cotton)] transition-colors">
                <div>
                  <div className="font-mono text-xs font-bold">#{o.id.split('-')[0].toUpperCase()}</div>
                  <div className="text-[10px] opacity-50">{new Date(o.created_at).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] uppercase tracking-widest font-bold opacity-60">{o.status}</span>
                  <span className={`text-[9px] uppercase tracking-widest font-bold ${o.is_paid ? 'text-green-700' : 'text-[var(--madder-red)]'}`}>{o.is_paid ? 'Paid' : 'Unpaid'}</span>
                  <span className="font-bold text-[var(--madder-red)]">₹{Number(o.total_amount).toFixed(0)}</span>
                </div>
              </Link>
            ))}
            {(!recentOrders || recentOrders.length === 0) && <p className="py-6 text-center opacity-50 text-sm">No orders yet.</p>}
          </div>
        </div>

        <div className="bg-white border-2 border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl font-bold text-[var(--charcoal-ink)]">Low Stock</h2>
            <Link href="/admin/inventory" className="text-xs uppercase tracking-widest text-[var(--madder-red)] font-bold hover:underline">Manage</Link>
          </div>
          <div className="divide-y divide-[var(--charcoal-ink)]/10">
            {(lowStock || []).map((v: any) => (
              <div key={v.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-bold text-sm">{v.products?.title || 'Variant'}</div>
                  <div className="text-[10px] opacity-50">{v.color}</div>
                </div>
                <span className={`font-mono font-bold ${v.stock_quantity === 0 ? 'text-[var(--madder-red)]' : 'text-[var(--turmeric)]'}`}>{v.stock_quantity}</span>
              </div>
            ))}
            {(!lowStock || lowStock.length === 0) && <p className="py-6 text-center opacity-50 text-sm">All variants well stocked.</p>}
          </div>
        </div>
      </div>

      {/* Top Sellers */}
      <div className="bg-white border-2 border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)]">
        <h2 className="font-serif text-xl font-bold text-[var(--charcoal-ink)] mb-4">Top Sellers (units)</h2>
        {topProducts.length > 0 ? (
          <div className="space-y-2">
            {topProducts.map(([title, qty]) => {
              const max = topProducts[0][1] || 1;
              return (
                <div key={title} className="flex items-center gap-3">
                  <span className="w-40 truncate text-sm font-bold">{title}</span>
                  <div className="flex-1 bg-[var(--charcoal-ink)]/5 h-4 relative">
                    <div className="bg-[var(--indigo-dye)] h-4" style={{ width: `${Math.round((qty / max) * 100)}%` }} />
                  </div>
                  <span className="text-sm font-mono font-bold w-10 text-right">{qty}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-4 text-center opacity-50 text-sm">No sales recorded yet.</p>
        )}
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
