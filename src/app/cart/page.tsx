"use client";

import { useCart } from '@/store/useCart';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function CartFallbackPage() {
  const { items } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <main className="flex-grow max-w-4xl mx-auto px-4 py-16 w-full">
      <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)] mb-8">Your Registry</h1>
      
      {items.length === 0 ? (
        <div className="text-center py-24 border-2 border-[var(--charcoal-ink)] bg-[var(--charcoal-ink)]/5 relative shadow-[8px_8px_0_var(--charcoal-ink)]">
          <div className="absolute top-0 left-0 w-8 h-8 bg-[var(--madder-red)] border-b-2 border-r-2 border-[var(--charcoal-ink)] z-10"></div>
          <p className="font-serif italic text-2xl mb-4 relative z-10 text-[var(--charcoal-ink)]">It's quiet here.</p>
          <Link href="/shop" className="relative z-10 text-[var(--madder-red)] font-bold underline underline-offset-4 font-sans tracking-widest uppercase text-sm">Explore Collections</Link>
        </div>
      ) : (
        <div className="space-y-6 bg-[var(--unbleached-cotton)] border-2 border-[var(--charcoal-ink)] p-6 sm:p-10 shadow-[8px_8px_0_var(--turmeric)] relative">
          <div className="absolute top-0 right-0 w-12 h-12 bg-[var(--charcoal-ink)] border-b-2 border-l-2 border-[var(--charcoal-ink)] z-10"></div>
          
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-center border-b-2 border-[var(--charcoal-ink)] pb-4">
                <div>
                  <p className="font-serif font-bold text-xl text-[var(--charcoal-ink)]">{item.title}</p>
                  <p className="font-sans text-xs uppercase tracking-[0.2em] opacity-80 text-[var(--charcoal-ink)] mt-1">
                    {item.color} <span className="mx-2">|</span> QTY: {item.quantity}
                  </p>
                </div>
                <p className="font-sans font-bold text-xl text-[var(--charcoal-ink)]">₹{(item.price * item.quantity).toLocaleString()}</p>
              </div>
            ))}
          </div>
          
          <div className="flex justify-between items-end pt-8">
            <span className="font-sans text-xs uppercase tracking-widest font-bold opacity-80 text-[var(--charcoal-ink)]">Subtotal</span>
            <span className="font-serif italic text-4xl font-bold text-[var(--charcoal-ink)]">₹{total.toLocaleString()}</span>
          </div>
          
          <div className="pt-8">
            <Link href="/checkout" className="block w-full">
              <button className="group relative w-full flex items-center justify-between border-2 border-[var(--charcoal-ink)] bg-[var(--turmeric)] text-[var(--charcoal-ink)] p-4 pl-8 transition-colors duration-300 ease-out active:scale-[0.98] hover:bg-[var(--charcoal-ink)] hover:text-[var(--unbleached-cotton)] shadow-[4px_4px_0_var(--charcoal-ink)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]">
                <span className="text-sm uppercase tracking-widest font-bold">
                  Secure Checkout
                </span>
                <div className="w-10 h-10 border-2 border-[var(--charcoal-ink)] bg-white group-hover:bg-[var(--charcoal-ink)] group-hover:border-[var(--unbleached-cotton)] flex items-center justify-center shrink-0 transition-colors duration-300">
                  <svg className="w-5 h-5 text-[var(--charcoal-ink)] group-hover:text-[var(--unbleached-cotton)] transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </button>
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
