"use client";

import { useState } from 'react';
import { useCart, CartItem } from '@/store/useCart';
import { Button } from '@/components/ui/Button';

type Variant = { id: string; color: string; price: number; images?: string[] };

export default function ProductBuyBox({
  productId,
  title,
  variants,
}: {
  productId: string;
  title: string;
  variants: Variant[];
}) {
  const { addItem, openCart } = useCart();
  const [selectedId, setSelectedId] = useState(variants[0]?.id);

  const selected = variants.find((v) => v.id === selectedId) || variants[0];
  if (!selected) return null;

  const handleAdd = () => {
    const item: CartItem = {
      id: selected.id,
      product_id: productId,
      title,
      color: selected.color,
      price: selected.price,
      quantity: 1,
      image: selected.images?.[0] || '',
    };
    addItem(item);
    openCart();
  };

  return (
    <div className="space-y-6">
      {variants.length > 1 && (
        <div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--charcoal-ink)]/50 mb-3">
            Select Color
          </p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-2 transition-colors ${
                  v.id === selected.id
                    ? 'bg-[var(--charcoal-ink)] text-white border-[var(--charcoal-ink)]'
                    : 'border-[var(--charcoal-ink)]/20 text-[var(--charcoal-ink)] opacity-70 hover:opacity-100'
                }`}
              >
                {v.color}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button onClick={handleAdd} className="w-full text-lg">
        Add to Cart - ₹{selected.price}
      </Button>
    </div>
  );
}
