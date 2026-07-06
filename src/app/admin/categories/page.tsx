"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Trash2, Star, Pencil, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { updateCategory } from '@/actions/admin';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', slug: '', is_featured: false });
  const supabase = createClient();

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    const slug = newCategory.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const { error } = await supabase.from('categories').insert({ name: newCategory, slug });
    if (!error) {
      setNewCategory('');
      fetchCategories();
    } else {
      alert(error.message);
    }
  };

  const startEdit = (cat: any) => {
    setEditingId(cat.id);
    setEditForm({ name: cat.name, slug: cat.slug, is_featured: !!cat.is_featured });
  };

  const saveEdit = async (id: string) => {
    try {
      await updateCategory(id, editForm);
      setEditingId(null);
      fetchCategories();
    } catch (err: any) {
      alert(err?.message || 'Failed to update category');
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
          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {loading ? (
              <p className="opacity-50">Loading categories...</p>
            ) : categories.length === 0 ? (
              <div className="bg-white border-2 border-[var(--charcoal-ink)] p-6 text-center opacity-50 shadow-[4px_4px_0_var(--charcoal-ink)]">No categories found.</div>
            ) : (
              categories.map((cat) => {
                const editing = editingId === cat.id;
                return (
                  <div key={cat.id} className="bg-white border-2 border-[var(--charcoal-ink)] p-4 shadow-[4px_4px_0_var(--charcoal-ink)]">
                    {editing ? (
                      <div className="space-y-3">
                        <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name" className="w-full border-2 border-[var(--charcoal-ink)]/20 bg-transparent p-2 text-sm focus:outline-none focus:border-[var(--madder-red)]" />
                        <input value={editForm.slug} onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })} placeholder="Slug" className="w-full border-2 border-[var(--charcoal-ink)]/20 bg-transparent p-2 text-sm font-mono focus:outline-none focus:border-[var(--madder-red)]" />
                        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={editForm.is_featured} onChange={(e) => setEditForm({ ...editForm, is_featured: e.target.checked })} className="accent-[var(--turmeric)] w-4 h-4" /> Featured</label>
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(cat.id)} className="flex-1 inline-flex items-center justify-center gap-2 border-2 border-green-600 text-green-700 py-2 text-xs font-bold uppercase tracking-widest hover:bg-green-600 hover:text-white transition-colors"><Check size={16} /> Save</button>
                          <button onClick={() => setEditingId(null)} className="inline-flex items-center justify-center border-2 border-[var(--charcoal-ink)]/20 px-4 hover:border-[var(--charcoal-ink)] transition-colors"><X size={16} /></button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <h3 className="font-serif font-bold text-lg">{cat.name}</h3>
                            <p className="font-mono text-xs opacity-70">{cat.slug}</p>
                          </div>
                          <Star size={18} className={cat.is_featured ? 'text-[var(--turmeric)] fill-[var(--turmeric)]' : 'opacity-20'} />
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button onClick={() => startEdit(cat)} className="flex-1 inline-flex items-center justify-center gap-2 border-2 border-[var(--charcoal-ink)] py-2 text-xs font-bold uppercase tracking-widest hover:bg-[var(--charcoal-ink)] hover:text-white transition-colors"><Pencil size={14} /> Edit</button>
                          <button onClick={() => handleDelete(cat.id)} className="inline-flex items-center justify-center border-2 border-[var(--madder-red)] text-[var(--madder-red)] px-4 py-2 hover:bg-[var(--madder-red)] hover:text-white transition-colors" aria-label="Delete"><Trash2 size={14} /></button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white border-2 border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)] overflow-x-auto">
            {loading ? (
              <p className="opacity-50">Loading categories...</p>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-[var(--charcoal-ink)] text-xs uppercase tracking-widest">
                    <th className="pb-3 font-bold">Name</th>
                    <th className="pb-3 font-bold">Slug</th>
                    <th className="pb-3 font-bold text-center">Featured</th>
                    <th className="pb-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => {
                    const editing = editingId === cat.id;
                    return (
                      <motion.tr layout key={cat.id} className="border-b border-[var(--charcoal-ink)]/10">
                        <td className="py-4 pr-2">
                          {editing ? (
                            <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full border-2 border-[var(--charcoal-ink)]/20 bg-transparent p-1 text-sm focus:outline-none focus:border-[var(--madder-red)]" />
                          ) : (
                            <span className="font-serif font-bold text-lg">{cat.name}</span>
                          )}
                        </td>
                        <td className="py-4 pr-2">
                          {editing ? (
                            <input value={editForm.slug} onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })} className="w-full border-2 border-[var(--charcoal-ink)]/20 bg-transparent p-1 text-sm font-mono focus:outline-none focus:border-[var(--madder-red)]" />
                          ) : (
                            <span className="opacity-70 text-sm font-mono">{cat.slug}</span>
                          )}
                        </td>
                        <td className="py-4 text-center">
                          {editing ? (
                            <input type="checkbox" checked={editForm.is_featured} onChange={(e) => setEditForm({ ...editForm, is_featured: e.target.checked })} className="accent-[var(--turmeric)] w-4 h-4" />
                          ) : (
                            <Star size={16} className={`inline ${cat.is_featured ? 'text-[var(--turmeric)] fill-[var(--turmeric)]' : 'opacity-20'}`} />
                          )}
                        </td>
                        <td className="py-4 text-right">
                          {editing ? (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => saveEdit(cat.id)} className="p-2 border-2 border-green-600 text-green-700 hover:bg-green-600 hover:text-white transition-colors" title="Save"><Check size={16} /></button>
                              <button onClick={() => setEditingId(null)} className="p-2 border-2 border-[var(--charcoal-ink)]/20 hover:border-[var(--charcoal-ink)] transition-colors" title="Cancel"><X size={16} /></button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => startEdit(cat)} className="p-2 border-2 border-[var(--charcoal-ink)]/20 hover:border-[var(--charcoal-ink)] transition-colors" title="Edit"><Pencil size={16} /></button>
                              <button onClick={() => handleDelete(cat.id)} className="p-2 border-2 border-transparent text-[var(--madder-red)] hover:bg-[var(--madder-red)] hover:text-white transition-colors" title="Delete"><Trash2 size={16} /></button>
                            </div>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center opacity-50">No categories found.</td>
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
