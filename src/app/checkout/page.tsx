"use client";

import { useCart } from '@/store/useCart';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import BackgroundPattern from '@/components/vectors/BackgroundPattern';
import { Button } from '@/components/ui/Button';
import { computeOrderTotals } from '@/lib/pricing';

type AppliedDiscount = { code: string; type: string; discountAmount: number; label: string };

export default function CheckoutPage() {
  const items = useCart((state) => state.items);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [applied, setApplied] = useState<AppliedDiscount | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const idemKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const { tax, shipping, total, isFreeShip } = computeOrderTotals(
    subtotal,
    applied ? { type: applied.type, amount: applied.discountAmount } : null
  );

  const handleApplyCoupon = async () => {
    setCouponError(null);
    if (!couponCode.trim()) {
      setCouponError('Enter a code.');
      return;
    }
    setApplyingCoupon(true);
    try {
      const { previewDiscount } = await import('@/actions/orders');
      const res = await previewDiscount(couponCode, subtotal);
      if (res.valid) {
        setApplied({ code: res.code, type: res.type, discountAmount: res.discountAmount, label: res.label });
        setCouponError(null);
      } else {
        setApplied(null);
        setCouponError(res.error || 'Invalid code.');
      }
    } catch {
      setCouponError('Could not validate code.');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setApplied(null);
    setCouponCode('');
    setCouponError(null);
  };

  const loadRazorpay = () =>
    new Promise<boolean>((resolve) => {
      if ((window as any).Razorpay) return resolve(true);
      const sc = document.createElement('script');
      sc.src = 'https://checkout.razorpay.com/v1/checkout.js';
      sc.onload = () => resolve(true);
      sc.onerror = () => resolve(false);
      document.body.appendChild(sc);
    });

  const payWithRazorpay = async (orderId: string, shipping: any) => {
    const ok = await loadRazorpay();
    if (!ok) {
      setError('Could not load the payment gateway.');
      setIsProcessing(false);
      return;
    }
    const res = await fetch('/api/payment/razorpay/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Could not start payment.');
      setIsProcessing(false);
      return;
    }
    const rzp = new (window as any).Razorpay({
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      order_id: data.razorpayOrderId,
      name: 'Mithila Enterprises',
      description: `Order ${String(orderId).split('-')[0].toUpperCase()}`,
      prefill: {
        name: [shipping.firstName, shipping.lastName].filter(Boolean).join(' '),
        email: shipping.email,
      },
      notes: { order_id: orderId },
      theme: { color: '#8B2E2E' },
      handler: async (response: any) => {
        const v = await fetch('/api/payment/razorpay/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
        });
        if (v.ok) {
          useCart.getState().clearCart();
          router.push('/checkout/success?orderId=' + orderId);
        } else {
          setError('Payment could not be verified. If you were charged, please contact support.');
          setIsProcessing(false);
        }
      },
      modal: { ondismiss: () => setIsProcessing(false) },
    });
    rzp.open();
  };

  const handleCheckout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsProcessing(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const shippingDetails = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      address1: formData.get('address1'),
      address2: formData.get('address2'),
      city: formData.get('city'),
      state: formData.get('state'),
      pinCode: formData.get('pinCode'),
    };

    try {
      if (!idemKeyRef.current) idemKeyRef.current = crypto.randomUUID();
      const { createOrder } = await import('@/actions/orders');
      const result = await createOrder(items, shippingDetails, applied?.code, idemKeyRef.current);

      if (!result.success) {
        setError(result.error || 'Failed to process checkout');
        setIsProcessing(false);
        return;
      }
      idemKeyRef.current = null; // order created; a future checkout gets a fresh key

      if (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
        await payWithRazorpay(result.orderId as string, shippingDetails);
        return;
      }

      useCart.getState().clearCart();
      router.push('/checkout/success?orderId=' + result.orderId);
    } catch (err) {
      setError('An unexpected error occurred during checkout');
      setIsProcessing(false);
    }
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
                <input type="text" name="firstName" placeholder="First Name" required className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
                <input type="text" name="lastName" placeholder="Last Name" required className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
              </div>
              <input type="email" name="email" placeholder="Email Address" required className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
              <input type="text" name="address1" placeholder="Address Line 1" required className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
              <input type="text" name="address2" placeholder="Address Line 2 (Optional)" className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
              <div className="grid grid-cols-3 gap-4">
                <input type="text" name="city" placeholder="City" required className="col-span-1 border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
                <input type="text" name="state" placeholder="State" required className="col-span-1 border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
                <input type="text" name="pinCode" placeholder="PIN Code" required className="col-span-1 border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
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

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded font-sans text-sm">
                {error}
              </div>
            )}

            <Button type="submit" disabled={isProcessing || items.length === 0} className="w-full text-lg py-4 bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] hover:bg-[var(--madder-red)] disabled:opacity-70">
              {isProcessing ? 'Processing Securely...' : `Pay ₹${total.toFixed(2)}`}
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
              {items.length === 0 && (
                <p className="font-sans text-sm opacity-60">Your cart is empty.</p>
              )}
            </div>

            {/* Coupon */}
            <div className="mb-6">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--charcoal-ink)]/60 mb-2">Discount Code</label>
              {applied ? (
                <div className="flex items-center justify-between border-2 border-green-600 bg-green-50 px-3 py-2">
                  <span className="font-sans text-sm font-bold text-green-700">{applied.code} - {applied.label}</span>
                  <button type="button" onClick={handleRemoveCoupon} className="text-xs font-bold uppercase tracking-widest text-[var(--madder-red)] hover:underline">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    className="flex-1 border-2 border-[var(--charcoal-ink)] bg-transparent p-2 font-sans uppercase focus:outline-none focus:border-[var(--madder-red)]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={applyingCoupon}
                    className="px-4 bg-[var(--charcoal-ink)] text-white text-xs font-bold uppercase tracking-widest hover:bg-[var(--madder-red)] disabled:opacity-60"
                  >
                    {applyingCoupon ? '...' : 'Apply'}
                  </button>
                </div>
              )}
              {couponError && <p className="text-xs text-[var(--madder-red)] font-bold mt-2">{couponError}</p>}
            </div>

            <div className="space-y-2 font-sans text-sm opacity-80 mb-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST (18%)</span>
                <span>₹{tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{isFreeShip ? 'FREE' : `₹${shipping.toFixed(2)}`}</span>
              </div>
              {applied && (
                <div className="flex justify-between text-green-700 font-bold">
                  <span>Discount ({applied.code})</span>
                  <span>- ₹{applied.discountAmount.toFixed(2)}</span>
                </div>
              )}
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
