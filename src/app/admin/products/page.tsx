"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Trash2, Edit, Plus } from 'lucide-react';
import Link from 'next/link';
import { deleteProduct } from '@/actions/admin';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*, categories(name), product_variants(id, stock_quantity, price)')
      .order('created_at', { ascending: false });
    if (data) setProducts(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this product? If it has past orders it will be archived (hidden from the store) instead of deleted, to keep order history intact.')) return;
    try {
      const res = await deleteProduct(id);
      if (res?.archived) {
        alert('This product has existing orders, so it was archived (hidden from the storefront) rather than deleted.');
      }
    } catch (e: any) {
      alert('Could not remove product: ' + (e?.message || 'unknown error'));
    }
    fetchProducts();
  };

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex items-center justify-between border-b-2 border-[var(--charcoal-ink)]/20 pb-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)]">Fabric Registry</h1>
          <p className="font-sans text-sm opacity-70 mt-1 uppercase tracking-widest">Manage product catalog</p>
        </div>
        <Link href="/admin/products/new">
          <Button className="flex items-center gap-2 bg-[var(--charcoal-ink)] text-white hover:bg-[var(--turmeric)] hover:text-[var(--charcoal-ink)]">
            <Plus size={16} /> New Product
          </Button>
        </Link>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <p className="opacity-50">Loading catalog...</p>
        ) : products.length === 0 ? (
          <div className="bg-white border-2 border-[var(--charcoal-ink)] p-6 text-center opacity-50 shadow-[4px_4px_0_var(--charcoal-ink)]">No products found.</div>
        ) : (
          products.map((p) => {
            const totalStock = p.product_variants?.reduce((acc: number, v: any) => acc + v.stock_quantity, 0) || 0;
            return (
              <div key={p.id} className="bg-white border-2 border-[var(--charcoal-ink)] p-4 shadow-[4px_4px_0_var(--charcoal-ink)]">
                <div className="flex justify-between items-start gap-3">
                  <h3 className="font-serif font-bold text-lg leading-tight">{p.title}</h3>
                  <span className={`shrink-0 px-2 py-1 text-[10px] font-bold uppercase tracking-widest border-2 ${p.status === 'active' ? 'border-green-600 text-green-700 bg-green-50' : 'border-orange-600 text-orange-700 bg-orange-50'}`}>{p.status}</span>
                </div>
                <p className="text-sm opacity-70 mt-1">{p.categories?.name || 'Uncategorized'}</p>
                <p className="text-sm mt-2">{p.product_variants?.length || 0} variants &middot; {totalStock} in stock</p>
                <div className="flex gap-2 mt-4">
                  <Link href={`/admin/products/${p.id}`} className="flex-1 inline-flex items-center justify-center gap-2 border-2 border-[var(--charcoal-ink)] py-2 text-xs font-bold uppercase tracking-widest hover:bg-[var(--charcoal-ink)] hover:text-white transition-colors"><Edit size={14} /> Edit</Link>
                  <button onClick={() => handleDelete(p.id)} className="inline-flex items-center justify-center border-2 border-[var(--madder-red)] text-[var(--madder-red)] px-4 py-2 hover:bg-[var(--madder-red)] hover:text-white transition-colors" aria-label="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white border-2 border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)] overflow-x-auto">
        {loading ? (
          <p className="opacity-50">Loading catalog...</p>
        ) : (
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="border-b-2 border-[var(--charcoal-ink)]">
                <th className="pb-3 text-xs uppercase tracking-widest font-bold">Product</th>
                <th className="pb-3 text-xs uppercase tracking-widest font-bold">Category</th>
                <th className="pb-3 text-xs uppercase tracking-widest font-bold">Variants</th>
                <th className="pb-3 text-xs uppercase tracking-widest font-bold">Status</th>
                <th className="pb-3 text-xs uppercase tracking-widest font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const totalStock = p.product_variants?.reduce((acc: number, v: any) => acc + v.stock_quantity, 0) || 0;
                return (
                  <tr key={p.id} className="border-b border-[var(--charcoal-ink)]/10 hover:bg-[var(--unbleached-cotton)] transition-colors">
                    <td className="py-4 font-serif font-bold text-lg">{p.title}</td>
                    <td className="py-4 opacity-70 text-sm">{p.categories?.name || 'Uncategorized'}</td>
                    <td className="py-4 text-sm">{p.product_variants?.length || 0} ({totalStock} in stock)</td>
                    <td className="py-4">
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest border-2 ${p.status === 'active' ? 'border-green-600 text-green-700 bg-green-50' : 'border-orange-600 text-orange-700 bg-orange-50'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-4 text-right flex justify-end gap-2">
                      <Link href={`/admin/products/${p.id}`} className="p-2 border-2 border-[var(--charcoal-ink)]/20 hover:border-[var(--charcoal-ink)] transition-colors inline-flex items-center">
                        <Edit size={16} />
                      </Link>
                      <button onClick={() => handleDelete(p.id)} className="p-2 border-2 border-transparent text-[var(--madder-red)] hover:bg-[var(--madder-red)] hover:text-white transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center opacity-50">No products found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
