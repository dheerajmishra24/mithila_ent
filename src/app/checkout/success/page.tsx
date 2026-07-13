"use client";

import { useCart } from '@/store/useCart';
import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { CheckCircle } from 'lucide-react';

export default function CheckoutSuccessPage() {
  const { clearCart } = useCart();

  useEffect(() => {
    // Clear cart upon successful order
    clearCart();
  }, [clearCart]);

  return (
    <main className="flex-grow bg-transparent py-24 flex items-center justify-center text-center">
      <div className="max-w-xl mx-auto px-4">
        <CheckCircle className="w-24 h-24 text-[var(--turmeric)] mx-auto mb-8" />
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-[var(--charcoal-ink)] mb-4">
          Order Confirmed
        </h1>
        <p className="font-sans text-lg opacity-70 mb-8">
          Thank you for choosing Mithila Enterprises. Your order is being prepared by our artisans. We&apos;ve sent a confirmation invoice to your email and WhatsApp.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/account/orders">
            <Button className="bg-[var(--turmeric)] text-[var(--charcoal-ink)] border-[var(--turmeric)] hover:bg-[var(--charcoal-ink)] hover:text-[var(--unbleached-cotton)]">
              Track Order
            </Button>
          </Link>
          <Link href="/shop">
            <Button variant="outline">Continue Shopping</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
