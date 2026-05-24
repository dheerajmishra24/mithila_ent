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
        <div className="text-center py-16 border-2 border-dashed border-[var(--charcoal-ink)] opacity-50 relative">
          <div className="w-16 h-16 kachni-border bg-[var(--charcoal-ink)] opacity-20 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
          <p className="font-sans mb-4 relative z-10">Your registry is currently empty.</p>
          <Link href="/shop" className="relative z-10 text-[var(--madder-red)] font-bold underline underline-offset-4">Explore Collections</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between items-center border-b-2 border-[var(--charcoal-ink)]/10 pb-4">
              <div>
                <p className="font-sans font-bold text-[var(--charcoal-ink)]">{item.title}</p>
                <p className="text-sm opacity-70">Qty: {item.quantity}</p>
              </div>
              <p className="font-sans font-bold text-[var(--madder-red)]">₹{item.price * item.quantity}</p>
            </div>
          ))}
          <div className="flex justify-between items-center pt-4 text-xl">
            <span className="font-serif font-bold text-[var(--charcoal-ink)]">Subtotal</span>
            <span className="font-sans font-bold text-[var(--madder-red)]">₹{total.toFixed(2)}</span>
          </div>
          <Link href="/checkout" className="block pt-8">
            <Button className="w-full">Secure Procurement</Button>
          </Link>
        </div>
      )}
    </main>
  );
}
