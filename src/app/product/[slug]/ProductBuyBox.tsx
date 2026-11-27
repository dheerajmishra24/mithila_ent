"use client";

import { useState, useEffect } from 'react';
import { useCart, CartItem } from '@/store/useCart';
import { asUnit, clampQuantity, formatQuantity, lineTotal, stepFor, type SellUnit } from '@/lib/meterage';
import SwatchButton from './SwatchButton';

type Variant = {
  id: string;
  color: string;
  price: number | string;
  min_order_quantity?: number | string | null;
  max_cut_m?: number | string | null;
  stock_quantity?: number | string | null;
  images?: string[];
};

export default function ProductBuyBox({
  productId,
  title,
  variants,
  unit: unitProp,
  swatch,
}: {
  productId: string;
  title: string;
  variants: Variant[];
  unit?: SellUnit | string | null;
  swatch?: { enabled: boolean; kitPrice: number; maxSwatches: number };
}) {
  const unit = asUnit(unitProp);
  const step = stepFor(unit);
  const { addItem, openCart } = useCart();
  const [selectedId, setSelectedId] = useState(variants[0]?.id);
  const [quantity, setQuantity] = useState<number>(Number(variants[0]?.min_order_quantity) || step);

  const selected = variants.find((v) => v.id === selectedId) || variants[0];
  const moq = Number(selected?.min_order_quantity) || step;
  const price = Number(selected?.price ?? 0);
  const stock = Number(selected?.stock_quantity ?? 0);
  // Metres are cut from one roll, so the most one line can hold is the longest roll.
  const maxCut = unit === 'MTR' ? Number(selected?.max_cut_m ?? 0) : stock;
  const soldOut = maxCut < moq;

  useEffect(() => {
    const next = clampQuantity(quantity, unit, moq, unit === 'MTR' ? maxCut : null);
    if (next !== quantity) setQuantity(next);
  }, [moq, quantity, unit, maxCut]);

  if (!selected) return null;

  const handleAdd = () => {
    const item: CartItem = {
      id: selected.id,
      product_id: productId,
      title,
      color: selected.color,
      price,
      quantity,
      min_order_quantity: moq,
      image: selected.images?.[0] || '',
      unit,
      max_cut_m: unit === 'MTR' ? maxCut : undefined,
    };
    addItem(item);
    openCart();
  };

  return (
    <div className="space-y-10">
      {/* Variants (Double Bezel architecture) */}
      {variants.length > 1 && (
        <div className="space-y-4">
          <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-[var(--charcoal-ink)]/90">
            Select Color
          </p>
          <div className="flex flex-wrap gap-3">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                className={`relative group rounded-[2rem] p-1.5 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ring-1 ${
                  v.id === selected.id
                    ? 'bg-black/5 ring-black/20'
                    : 'bg-transparent ring-transparent hover:ring-black/10'
                }`}
              >
                <div
                  className={`px-5 py-2.5 rounded-[calc(2rem-0.375rem)] text-xs font-bold uppercase tracking-wider transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                    v.id === selected.id
                      ? 'bg-[var(--charcoal-ink)] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]'
                      : 'bg-transparent text-[var(--charcoal-ink)] opacity-70 group-hover:opacity-100 group-hover:bg-black/5'
                  }`}
                >
                  {v.color}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantity Selector (Double Bezel) */}
      <div className="space-y-4">
        <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-[var(--charcoal-ink)]/90 flex items-center gap-2">
          {unit === 'MTR' ? 'Length (metres)' : 'Quantity'}
          {moq > step && (
            <span className="bg-[var(--madder-red)]/10 text-[var(--madder-red)] px-2 py-0.5 rounded-full tracking-widest text-[8px]">
              Minimum {formatQuantity(moq, unit)}
            </span>
          )}
        </p>
        
        <div className="w-fit rounded-[2rem] bg-black/5 ring-1 ring-black/10 p-1.5 flex items-center">
          <div className="flex items-center rounded-[calc(2rem-0.375rem)] bg-white/50 shadow-[inset_0_1px_1px_rgba(255,255,255,1)]">
            <button
              type="button"
              className="w-12 h-12 flex items-center justify-center font-bold text-xl text-[var(--charcoal-ink)]/90 hover:text-[var(--charcoal-ink)] transition-colors duration-300"
              onClick={() => setQuantity(q => clampQuantity(q - step, unit, moq, unit === 'MTR' ? maxCut : null))}
              aria-label={unit === 'MTR' ? 'Half a metre less' : 'One fewer'}
              disabled={soldOut || quantity <= moq}
            >
              −
            </button>
            <span className="min-w-16 px-1 text-center font-bold text-lg text-[var(--charcoal-ink)] tabular-nums" aria-live="polite">
              {formatQuantity(quantity, unit)}
            </span>
            <button
              type="button"
              className="w-12 h-12 flex items-center justify-center font-bold text-xl text-[var(--charcoal-ink)]/90 hover:text-[var(--charcoal-ink)] transition-colors duration-300"
              onClick={() => setQuantity(q => clampQuantity(q + step, unit, moq, unit === 'MTR' ? maxCut : null))}
              aria-label={unit === 'MTR' ? 'Half a metre more' : 'One more'}
              disabled={soldOut || quantity + step > maxCut}
            >
              +
            </button>
          </div>
        </div>
        <p className="text-xs text-[var(--charcoal-ink)]/80" role="status">
          {soldOut
            ? 'Out of stock in this colour.'
            : unit === 'MTR'
              ? `Cut as one continuous length. Up to ${formatQuantity(Math.floor(maxCut * 2) / 2, unit)} available in a single piece.`
              : `${formatQuantity(stock, unit)} in stock.`}
        </p>
      </div>

      {/* Button-in-Button Add to Cart */}
      <button
        onClick={handleAdd}
        disabled={soldOut}
        className="group relative w-full flex items-center justify-between rounded-full bg-[var(--charcoal-ink)] text-white p-2 pl-8 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] hover:bg-[var(--charcoal-ink)]/90 overflow-hidden"
      >
        <span className="text-sm uppercase tracking-widest font-bold">
          {soldOut ? 'Out of stock' : `Add to Cart — ₹${lineTotal(price, quantity).toLocaleString('en-IN')}`}
        </span>
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105 group-hover:translate-x-1 group-hover:-translate-y-[1px]">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>
      </button>

      {swatch?.enabled && unit === 'MTR' && (
        <SwatchButton
          pick={{ id: selected.id, title, color: selected.color, image: selected.images?.[0] || '' }}
          kitPrice={swatch.kitPrice}
          maxSwatches={swatch.maxSwatches}
        />
      )}
    </div>
  );
}
