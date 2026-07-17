"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { updateProduct, updateVariant, addVariant, uploadProductImage } from '@/actions/admin';

export default function EditProductForm({ product, categories, collections, initialCollectionIds }: { product: any; categories: any[]; collections: any[]; initialCollectionIds: string[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [form, setForm] = useState({
    title: product.title || '',
    description: product.description || '',
    status: product.status || 'active',
    categoryId: product.category_id || '',
    weave: product.weave || '',
    count: product.count || '',
    construction: product.construction || '',
    gsm: product.gsm ?? 0,
    width: product.width || '',
    stretch: product.stretch || '',
    origin: product.origin || '',
    bestSuitedFor: Array.isArray(product.best_suited_for) ? product.best_suited_for.join(', ') : '',
    print: product.print || '',
    collectionIds: initialCollectionIds || [],
  });

  const [variants, setVariants] = useState<any[]>(
    (product.product_variants || []).map((v: any) => ({
      id: v.id,
      color: v.color || '',
      price: Number(v.price) || 0,
      stock_quantity: Number(v.stock_quantity) || 0,
      min_order_quantity: Number(v.min_order_quantity) || 1,
      images: Array.isArray(v.images) ? v.images : [],
    }))
  );

  const setField = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));
  const setVariantField = (id: string, key: string, value: any) =>
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, [key]: value } : v)));

  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const handleVariantImage = (id: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(id);
    setMessage(null);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
      });
      const { url } = await uploadProductImage(dataUrl);
      setVariantField(id, 'images', [url]);
      setMessage({ type: 'ok', text: 'Image uploaded — click Save Changes to apply.' });
    } catch (err: any) {
      setMessage({ type: 'err', text: err?.message || 'Image upload failed.' });
    } finally {
      setUploadingId(null);
    }
  };

  const [newVar, setNewVar] = useState({ color: '', price: 0, stock_quantity: 0, min_order_quantity: 1 });
  const [addingVariant, setAddingVariant] = useState(false);

  const handleAddVariant = async () => {
    if (!newVar.color.trim()) {
      setMessage({ type: 'err', text: 'Enter a colour for the new variant.' });
      return;
    }
    setAddingVariant(true);
    setMessage(null);
    try {
      const res = await addVariant(product.id, {
        color: newVar.color,
        price: Number(newVar.price) || 0,
        stock_quantity: Number(newVar.stock_quantity) || 0,
        min_order_quantity: Number(newVar.min_order_quantity) || 1,
      });
      if (res?.variant) {
        setVariants((prev) => [
          ...prev,
          {
            id: res.variant.id,
            color: res.variant.color || '',
            price: Number(res.variant.price) || 0,
            stock_quantity: Number(res.variant.stock_quantity) || 0,
            min_order_quantity: Number(res.variant.min_order_quantity) || 1,
          },
        ]);
      }
      setNewVar({ color: '', price: 0, stock_quantity: 0, min_order_quantity: 1 });
      setMessage({ type: 'ok', text: 'Variant added.' });
      router.refresh();
    } catch (err: any) {
      setMessage({ type: 'err', text: err?.message || 'Failed to add variant.' });
    } finally {
      setAddingVariant(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateProduct(product.id, {
        title: form.title,
        description: form.description,
        status: form.status,
        categoryId: form.categoryId,
        weave: form.weave,
        count: form.count,
        construction: form.construction,
        gsm: Number(form.gsm) || 0,
        width: form.width,
        stretch: form.stretch,
        origin: form.origin,
        bestSuitedFor: form.bestSuitedFor,
        print: form.print,
        collectionIds: form.collectionIds,
      });

      for (const v of variants) {
        await updateVariant(v.id, {
          color: v.color,
          price: Number(v.price) || 0,
          stock_quantity: Number(v.stock_quantity) || 0,
          min_order_quantity: Number(v.min_order_quantity) || 1,
          images: v.images,
        });
      }

      setMessage({ type: 'ok', text: 'Product saved successfully.' });
      router.refresh();
    } catch (err: any) {
      setMessage({ type: 'err', text: err?.message || 'Failed to save product.' });
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-2 font-sans focus:outline-none focus:border-[var(--turmeric)] transition-colors";
  const labelClass = "block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1";

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-4xl">
      <div className="flex items-center justify-between border-b-2 border-[var(--charcoal-ink)]/20 pb-4">
        <div>
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-1 text-xs uppercase tracking-widest opacity-70 hover:opacity-100 mb-2"
          >
            <ChevronLeft size={14} /> Back to catalog
          </Link>
          <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)]">Edit Product</h1>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[var(--charcoal-ink)] text-white hover:bg-[var(--turmeric)] hover:text-[var(--charcoal-ink)] uppercase tracking-widest text-xs font-bold"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {message && (
        <div
          className={
            message.type === 'ok'
              ? "bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-sm"
              : "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm"
          }
        >
          {message.text}
        </div>
      )}

      <div className="bg-white border-2 border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)] space-y-4">
        <h2 className="font-serif text-xl font-bold">Details</h2>
        <div>
          <label className={labelClass}>Title</label>
          <input className={inputClass} value={form.title} onChange={(e) => setField('title', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea
            className={inputClass}
            rows={4}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Status</label>
            <select className={inputClass} value={form.status} onChange={(e) => setField('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select
              className={inputClass}
              value={form.categoryId}
              onChange={(e) => setField('categoryId', e.target.value)}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Collections (Optional)</label>
            <div className="border border-[var(--charcoal-ink)]/20 p-2 max-h-32 overflow-y-auto space-y-1 focus-within:border-[var(--turmeric)]">
              {collections.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={form.collectionIds.includes(c.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setField('collectionIds', [...form.collectionIds, c.id]);
                      } else {
                        setField('collectionIds', form.collectionIds.filter((id: string) => id !== c.id));
                      }
                    }}
                  />
                  {c.title}
                </label>
              ))}
              {collections.length === 0 && <span className="opacity-50 text-xs">No collections found</span>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Weave</label>
            <input className={inputClass} value={form.weave} onChange={(e) => setField('weave', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>GSM</label>
            <input
              type="number"
              className={inputClass}
              value={form.gsm}
              onChange={(e) => setField('gsm', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Width</label>
            <input className={inputClass} value={form.width} onChange={(e) => setField('width', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Thread Count</label>
            <input className={inputClass} value={form.count} onChange={(e) => setField('count', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Construction</label>
            <input className={inputClass} value={form.construction} onChange={(e) => setField('construction', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Stretch</label>
            <input className={inputClass} value={form.stretch} onChange={(e) => setField('stretch', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Print / Pattern</label>
            <input className={inputClass} value={form.print} onChange={(e) => setField('print', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Origin</label>
            <input className={inputClass} value={form.origin} onChange={(e) => setField('origin', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Best Suited For (comma separated)</label>
            <input
              className={inputClass}
              value={form.bestSuitedFor}
              onChange={(e) => setField('bestSuitedFor', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white border-2 border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)]">
        <h2 className="font-serif text-xl font-bold mb-4">Variants &amp; Pricing</h2>
        {variants.length === 0 ? (
          <p className="opacity-50 text-sm">No variants for this product.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-4 text-[10px] uppercase tracking-widest font-bold opacity-60">
              <span>Color</span>
              <span>Price (INR)</span>
              <span>Stock</span>
              <span>MOQ (Meters)</span>
            </div>
            {variants.map((v) => (
              <div key={v.id} className="space-y-2 border-b border-[var(--charcoal-ink)]/10 pb-3 last:border-0">
                <div className="grid grid-cols-4 gap-4">
                  <input
                    className={inputClass}
                    value={v.color}
                    onChange={(e) => setVariantField(v.id, 'color', e.target.value)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    className={inputClass}
                    value={v.price}
                    onChange={(e) => setVariantField(v.id, 'price', e.target.value)}
                  />
                  <input
                    type="number"
                    className={inputClass}
                    value={v.stock_quantity}
                    onChange={(e) => setVariantField(v.id, 'stock_quantity', e.target.value)}
                  />
                  <input
                    type="number"
                    min="1"
                    className={inputClass}
                    value={v.min_order_quantity}
                    onChange={(e) => setVariantField(v.id, 'min_order_quantity', e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 border-2 border-[var(--charcoal-ink)]/20 overflow-hidden bg-[var(--unbleached-cotton)] flex items-center justify-center shrink-0">
                    {v.images && v.images[0] ? (
                      <img src={v.images[0]} alt={v.color || 'variant'} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={18} className="opacity-40" />
                    )}
                  </div>
                  <label className="text-[10px] font-bold uppercase tracking-widest cursor-pointer border-2 border-[var(--charcoal-ink)] px-3 py-2 hover:bg-[var(--turmeric)] transition-colors">
                    {uploadingId === v.id ? 'Uploading…' : v.images && v.images[0] ? 'Replace Image' : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingId === v.id}
                      onChange={handleVariantImage(v.id)}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border-2 border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)]">
        <h2 className="font-serif text-xl font-bold mb-4">Add Variant</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className={labelClass}>Color</label>
            <input className={inputClass} value={newVar.color} onChange={(e) => setNewVar({ ...newVar, color: e.target.value })} placeholder="e.g. Indigo" />
          </div>
          <div>
            <label className={labelClass}>Price (INR)</label>
            <input type="number" step="0.01" className={inputClass} value={newVar.price} onChange={(e) => setNewVar({ ...newVar, price: Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelClass}>Stock</label>
            <input type="number" className={inputClass} value={newVar.stock_quantity} onChange={(e) => setNewVar({ ...newVar, stock_quantity: Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelClass}>MOQ (Meters)</label>
            <input type="number" min="1" className={inputClass} value={newVar.min_order_quantity} onChange={(e) => setNewVar({ ...newVar, min_order_quantity: Number(e.target.value) })} />
          </div>
          <Button onClick={handleAddVariant} disabled={addingVariant} className="bg-[var(--indigo-dye)] text-white hover:bg-[var(--charcoal-ink)] uppercase tracking-widest text-xs font-bold">
            {addingVariant ? 'Adding...' : 'Add Variant'}
          </Button>
        </div>
      </div>
    </div>
  );
}
