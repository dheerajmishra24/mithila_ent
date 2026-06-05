"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
    setLoading(false);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    const slug = newCategory.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const { error } = await supabase.from('categories').insert({ name: newCategory, slug });
    
    if (!error) {
      setNewCategory('');
      fetchCategories();
    } else {
      alert(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    await supabase.from('categories').delete().eq('id', id);
    fetchCategories();
  };

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex items-center justify-between border-b-2 border-[var(--charcoal-ink)]/20 pb-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)]">Product Categories</h1>
          <p className="font-sans text-sm opacity-70 mt-1 uppercase tracking-widest">Manage taxonomy and collections</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <form onSubmit={handleAddCategory} className="bg-[var(--unbleached-cotton)] border-4 border-double border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)]">
            <h2 className="font-serif text-xl font-bold mb-4">Add Category</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">Category Name</label>
                <input 
                  type="text" 
                  value={newCategory} 
                  onChange={(e) => setNewCategory(e.target.value)} 
                  className="w-full border-2 border-[var(--charcoal-ink)]/20 bg-transparent p-2 focus:outline-none focus:border-[var(--madder-red)]"
                  placeholder="e.g. Silk Sarees"
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-[var(--charcoal-ink)] text-white hover:bg-[var(--turmeric)] hover:text-[var(--charcoal-ink)] uppercase tracking-widest text-xs font-bold py-3">
                Create Collection
              </Button>
            </div>
          </form>
        </div>

        <div className="md:col-span-2">
          <div className="bg-white border-2 border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)]">
            {loading ? (
              <p className="opacity-50">Loading categories...</p>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-[var(--charcoal-ink)]">
                    <th className="pb-3 text-xs uppercase tracking-widest font-bold">Name</th>
                    <th className="pb-3 text-xs uppercase tracking-widest font-bold">Slug</th>
                    <th className="pb-3 text-xs uppercase tracking-widest font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <motion.tr layout key={cat.id} className="border-b border-[var(--charcoal-ink)]/10">
                      <td className="py-4 font-serif font-bold text-lg">{cat.name}</td>
                      <td className="py-4 opacity-70 text-sm">{cat.slug}</td>
                      <td className="py-4 text-right">
                        <button onClick={() => handleDelete(cat.id)} className="text-[var(--madder-red)] hover:opacity-70 transition-opacity">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center opacity-50">No categories found.</td>
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
