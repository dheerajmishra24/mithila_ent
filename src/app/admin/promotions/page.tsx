"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminPromotions() {
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const [newDiscount, setNewDiscount] = useState({
    code: '',
    type: 'percentage',
    value: 10,
  });

  const fetchDiscounts = async () => {
    const { data } = await supabase.from('discounts').select('*').order('created_at', { ascending: false });
    if (data) setDiscounts(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiscount.code.trim()) return;

    const { error } = await supabase.from('discounts').insert({
      code: newDiscount.code.toUpperCase(),
      type: newDiscount.type,
      value: newDiscount.value,
      is_active: true
    });
    
    if (!error) {
      setNewDiscount({ code: '', type: 'percentage', value: 10 });
      fetchDiscounts();
    } else {
      alert(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this discount?')) return;
    await supabase.from('discounts').delete().eq('id', id);
    fetchDiscounts();
  };

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex items-center justify-between border-b-2 border-[var(--charcoal-ink)]/20 pb-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)]">Promotions Engine</h1>
          <p className="font-sans text-sm opacity-70 mt-1 uppercase tracking-widest">Manage active coupons and sales</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <form onSubmit={handleCreate} className="bg-[var(--unbleached-cotton)] border-4 border-double border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)]">
            <h2 className="font-serif text-xl font-bold mb-4">Create Discount</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">Coupon Code</label>
                <input 
                  type="text" 
                  value={newDiscount.code} 
                  onChange={(e) => setNewDiscount({...newDiscount, code: e.target.value})} 
                  className="w-full border-2 border-[var(--charcoal-ink)]/20 bg-transparent p-2 focus:outline-none focus:border-[var(--madder-red)] uppercase"
                  placeholder="e.g. DIWALI20"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">Type</label>
                <select 
                  value={newDiscount.type} 
                  onChange={(e) => setNewDiscount({...newDiscount, type: e.target.value})}
                  className="w-full border-2 border-[var(--charcoal-ink)]/20 bg-transparent p-2 focus:outline-none focus:border-[var(--madder-red)]"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed_amount">Fixed Amount (₹)</option>
                  <option value="free_shipping">Free Shipping</option>
                </select>
              </div>
              {newDiscount.type !== 'free_shipping' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">Value</label>
                  <input 
                    type="number" 
                    value={newDiscount.value} 
                    onChange={(e) => setNewDiscount({...newDiscount, value: Number(e.target.value)})} 
                    className="w-full border-2 border-[var(--charcoal-ink)]/20 bg-transparent p-2 focus:outline-none focus:border-[var(--madder-red)]"
                    required
                  />
                </div>
              )}
              <Button type="submit" className="w-full bg-[var(--charcoal-ink)] text-white hover:bg-[var(--turmeric)] hover:text-[var(--charcoal-ink)] uppercase tracking-widest text-xs font-bold py-3">
                Issue Coupon
              </Button>
            </div>
          </form>
        </div>

        <div className="md:col-span-2">
          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {loading ? (
              <p className="opacity-50">Loading promotions...</p>
            ) : discounts.length === 0 ? (
              <div className="bg-white border-2 border-[var(--charcoal-ink)] p-6 text-center opacity-50 shadow-[4px_4px_0_var(--charcoal-ink)]">No active promotions.</div>
            ) : (
              discounts.map((d) => (
                <div key={d.id} className="bg-white border-2 border-[var(--charcoal-ink)] p-4 shadow-[4px_4px_0_var(--charcoal-ink)] flex justify-between items-center gap-3">
                  <div>
                    <h3 className="font-serif font-bold text-lg">{d.code}</h3>
                    <p className="text-[10px] uppercase tracking-widest opacity-70">{d.type.replace('_', ' ')}</p>
                    <p className="font-bold text-[var(--madder-red)] mt-1">{d.type === 'percentage' ? `${d.value}%` : d.type === 'fixed_amount' ? `₹${d.value}` : 'Free shipping'}</p>
                  </div>
                  <button onClick={() => handleDelete(d.id)} className="text-[var(--madder-red)] hover:opacity-70 transition-opacity p-2" aria-label="Delete"><Trash2 size={18} /></button>
                </div>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white border-2 border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)] overflow-x-auto">
            {loading ? (
              <p className="opacity-50">Loading promotions...</p>
            ) : (
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr className="border-b-2 border-[var(--charcoal-ink)]">
                    <th className="pb-3 text-xs uppercase tracking-widest font-bold">Code</th>
                    <th className="pb-3 text-xs uppercase tracking-widest font-bold">Type</th>
                    <th className="pb-3 text-xs uppercase tracking-widest font-bold">Value</th>
                    <th className="pb-3 text-xs uppercase tracking-widest font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {discounts.map((d) => (
                    <motion.tr layout key={d.id} className="border-b border-[var(--charcoal-ink)]/10">
                      <td className="py-4 font-serif font-bold text-lg">{d.code}</td>
                      <td className="py-4 opacity-70 text-xs uppercase tracking-widest">{d.type.replace('_', ' ')}</td>
                      <td className="py-4 font-bold text-[var(--madder-red)]">
                        {d.type === 'percentage' ? `${d.value}%` : d.type === 'fixed_amount' ? `₹${d.value}` : '-'}
                      </td>
                      <td className="py-4 text-right">
                        <button onClick={() => handleDelete(d.id)} className="text-[var(--madder-red)] hover:opacity-70 transition-opacity">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                  {discounts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center opacity-50">No active promotions.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
