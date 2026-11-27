import { createClient } from '@/lib/supabase/server'
import { requireAdminPage } from '@/lib/dal/session';
import Link from 'next/link'
import { adjustInventory } from '@/actions/admin'
import { asUnit, formatQuantity } from '@/lib/meterage'

export default async function AdminInventoryPage() {
  await requireAdminPage();
  const supabase = await createClient()
  
  // Fetch variants joined with parent product data
  const { data: variants } = await supabase
    .from('product_variants')
    .select(`
      id,
      sku,
      color,
      price,
      stock_quantity,
      max_cut_m,
      images,
      products!inner(title, slug, sell_unit)
    `)
    .order('stock_quantity', { ascending: true })

  return (
    <div className="p-8 min-h-screen bg-[var(--charcoal-ink)] text-white">
      <div className="mb-10 border-b border-white/10 pb-6 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-wide">Command Center: Inventory</h1>
          <p className="font-sans text-sm uppercase tracking-widest text-[var(--turmeric)] mt-2 opacity-80">Stock Level Operations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {variants?.map((variant) => {
          const product = (Array.isArray(variant.products) ? variant.products[0] : variant.products) as { title?: string; sell_unit?: string } | null
          const unit = asUnit(product?.sell_unit)
          const stock = Number(variant.stock_quantity)
          return (
          <div key={variant.id} className="border border-white/20 bg-[#111] p-6 flex flex-col justify-between shadow-[4px_4px_0_var(--turmeric)] group hover:border-[var(--turmeric)]/50 transition-colors">
            
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="bg-white/10 text-xs px-2 py-1 font-mono tracking-wider opacity-80 border border-white/10">
                  {variant.sku}
                </div>
                <div className={`font-mono text-xl font-bold tabular-nums ${stock === 0 ? 'text-red-400' : stock < 20 ? 'text-[var(--turmeric)]' : 'text-green-500'}`}>
                  {formatQuantity(stock, unit)} <span className="text-[10px] uppercase opacity-80 font-sans tracking-widest ml-1">in stock</span>
                </div>
              </div>

              <div className="flex gap-4">
                {variant.images && variant.images[0] ? (
                  <div className="w-16 h-16 rounded border border-white/20 overflow-hidden relative shrink-0">
                    <img src={variant.images[0]} alt="Variant" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded border border-white/20 bg-white/5 flex items-center justify-center shrink-0">
                    <span className="text-[10px] opacity-80 text-center leading-tight">No<br/>img</span>
                  </div>
                )}
                <div>
                  <h2 className="font-serif text-xl font-bold mb-1 group-hover:text-[var(--turmeric)] transition-colors">
                    {product?.title || 'Unknown Product'}
                  </h2>
                  <div className="text-sm font-bold uppercase tracking-widest opacity-80 flex gap-2">
                    <span>{variant.color}</span>
                    <span aria-hidden="true">|</span>
                    <span className="tabular-nums">₹{Number(variant.price).toLocaleString('en-IN')} / {unit === 'MTR' ? 'm' : 'pc'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              {unit === 'MTR' ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs opacity-70 tabular-nums">Longest cut: {formatQuantity(Number(variant.max_cut_m ?? 0), 'MTR')}</span>
                  <Link href={`/admin/inventory/${variant.id}`} className="bg-white/10 hover:bg-[var(--turmeric)] hover:text-[#111] font-bold text-[10px] uppercase tracking-widest px-4 py-3 transition-colors">
                    Manage rolls
                  </Link>
                </div>
              ) : (
              <form action={async (formData) => {
                'use server';
                const actionType = formData.get('actionType') as string;
                const qty = parseInt(formData.get('quantity') as string) || 0;
                const adjustment = actionType === 'add' ? qty : -qty;
                if (adjustment !== 0) {
                  await adjustInventory(variant.id, adjustment);
                }
              }} className="flex items-center gap-2">
                <input 
                  type="number" 
                  aria-label={`Quantity to add or deduct for ${variant.sku}`}
                  name="quantity"
                  min="1"
                  defaultValue="1"
                  className="bg-transparent border border-white/20 p-2 w-20 text-center font-mono focus:outline-none focus:border-[var(--turmeric)]"
                />
                <button type="submit" name="actionType" value="add" className="flex-1 bg-white/10 hover:bg-[var(--turmeric)] hover:text-[#111] font-bold text-[10px] uppercase tracking-widest py-3 transition-colors">
                  Add
                </button>
                <button type="submit" name="actionType" value="deduct" className="flex-1 bg-white/10 hover:bg-[var(--madder-red)] hover:text-white font-bold text-[10px] uppercase tracking-widest py-3 transition-colors">
                  Deduct
                </button>
              </form>
              )}
            </div>

          </div>
          )
        })}
      </div>
    </div>
  )
}
