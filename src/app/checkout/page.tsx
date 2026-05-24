"use client";

import { useCart } from '@/store/useCart';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import BackgroundPattern from '@/components/vectors/BackgroundPattern';
import { Button } from '@/components/ui/Button';

export default function CheckoutPage() {
  const items = useCart((state) => state.items);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate secure checkout process
    setTimeout(() => {
      router.push('/checkout/success');
    }, 1500);
  };

  return (
    <main className="flex-grow bg-[var(--unbleached-cotton)] py-16 relative overflow-hidden">
      <BackgroundPattern className="opacity-40" />
      <div className="container mx-auto px-4 md:px-8 max-w-6xl relative z-10">
        <h1 className="font-serif text-4xl font-bold text-[var(--charcoal-ink)] mb-12">Finalize Procurement</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Form */}
          <form onSubmit={handleCheckout} className="space-y-8">
            <div className="space-y-4">
              <h2 className="font-sans font-bold uppercase tracking-widest text-[var(--madder-red)]">Shipping Provenance</h2>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="First Name" required className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
                <input type="text" placeholder="Last Name" required className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
              </div>
              <input type="text" placeholder="Address Line 1" required className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
              <input type="text" placeholder="Address Line 2 (Optional)" className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
              <div className="grid grid-cols-3 gap-4">
                <input type="text" placeholder="City" required className="col-span-1 border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
                <input type="text" placeholder="State" required className="col-span-1 border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
                <input type="text" placeholder="PIN Code" required className="col-span-1 border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="font-sans font-bold uppercase tracking-widest text-[var(--madder-red)]">Payment Method</h2>
              <div className="p-4 border-2 border-[var(--charcoal-ink)] flex items-center gap-4">
                <input type="radio" name="payment" required className="accent-[var(--madder-red)] w-4 h-4" defaultChecked />
                <span className="font-sans text-[var(--charcoal-ink)]">Credit / Debit Card (Stripe/Razorpay)</span>
              </div>
              <div className="p-4 border-2 border-[var(--charcoal-ink)] flex items-center gap-4 opacity-50 cursor-not-allowed">
                <input type="radio" name="payment" disabled className="accent-[var(--madder-red)] w-4 h-4" />
                <span className="font-sans text-[var(--charcoal-ink)]">Cash on Delivery (Unavailable for wholesale)</span>
              </div>
            </div>

            <Button type="submit" className="w-full text-lg py-4 bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] hover:bg-[var(--madder-red)]">
              Pay ₹{total.toFixed(2)}
            </Button>
          </form>

          {/* Order Summary */}
          <div className="bg-white/60 backdrop-blur-sm border-2 border-[var(--charcoal-ink)] p-8 h-fit sticky top-24">
            <h2 className="font-serif text-2xl font-bold text-[var(--charcoal-ink)] mb-6">Order Summary</h2>
            <div className="space-y-4 mb-6 border-b-2 border-[var(--charcoal-ink)]/20 pb-6">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between items-center font-sans">
                  <div>
                    <span className="font-bold">{item.title}</span>
                    <span className="text-sm opacity-70 block">{item.color} x {item.quantity}</span>
                  </div>
                  <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 font-sans text-sm opacity-80 mb-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>Calculated at next step</span>
              </div>
            </div>
            <div className="flex justify-between items-center font-serif text-2xl font-bold text-[var(--madder-red)] mt-6 pt-6 border-t-2 border-[var(--charcoal-ink)]">
              <span>Total</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
