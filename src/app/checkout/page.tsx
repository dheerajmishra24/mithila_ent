"use client";

import { useCart } from '@/store/useCart';
import { asUnit, formatQuantity, lineTotal } from '@/lib/meterage';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import BackgroundPattern from '@/components/vectors/BackgroundPattern';
import { Button } from '@/components/ui/Button';
import { computeOrderTotals } from '@/lib/pricing';
import { INDIAN_STATES } from '@/lib/gst';
import AuthModal from '@/components/AuthModal';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { payWithRazorpay } from '@/lib/payments/razorpay-client';
import { mySwatchCreditBalance } from '@/actions/swatches';

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
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  const [shippingState, setShippingState] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [dynamicTotals, setDynamicTotals] = useState<{ shippingAmount: number, totalGst: number, breakdown: any, baseAmount: number } | null>(null);
  const [calculatingShipping, setCalculatingShipping] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [useCredit, setUseCredit] = useState(true);

  const supabase = createClient();

  useEffect(() => {

    setMounted(true);
    
    // Check auth status
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        setShowAuthModal(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session) {
        setShowAuthModal(false);
      } else {
        setShowAuthModal(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);



  useEffect(() => {
    if (!user) {
      setCreditBalance(0);
      return;
    }
    let live = true;
    mySwatchCreditBalance().then((b) => { if (live) setCreditBalance(b); }).catch(() => {});
    return () => { live = false; };
  }, [user]);

  const subtotal = items.reduce((sum, item) => sum + lineTotal(item.price, item.quantity), 0);
  
  // Use dynamic totals if available, otherwise fallback to static computeOrderTotals
  const staticTotals = computeOrderTotals(
    subtotal,
    applied ? { type: applied.type, amount: applied.discountAmount } : null
  );

  const shipping = dynamicTotals ? dynamicTotals.shippingAmount : staticTotals.shipping;
  const tax = dynamicTotals ? dynamicTotals.totalGst : staticTotals.tax;
  const isFreeShip = staticTotals.isFreeShip; // Keep discount logic for free shipping
  const finalShipping = isFreeShip ? 0 : shipping;
  const total = dynamicTotals ? (dynamicTotals.baseAmount - (staticTotals.subtotal - staticTotals.total + staticTotals.shipping + staticTotals.tax) + tax + finalShipping) : staticTotals.total;
  // Swatch credit counts as part payment on orders with metre fabric; the
  // database applies the same rule (at least Rs 1 is left for the gateway).
  const hasMetreFabric = items.some((i) => asUnit(i.unit) === 'MTR');
  const creditUsable = hasMetreFabric && creditBalance > 0;
  const creditToApply = creditUsable && useCredit ? Math.max(0, Math.min(creditBalance, total - 1)) : 0;
  const toPay = total - creditToApply;

  useEffect(() => {
    if (pinCode.length >= 6 && shippingState && items.length > 0) {
      const fetchDynamicShipping = async () => {
        setCalculatingShipping(true);
        try {
          const res = await fetch('/api/shipping/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items, pinCode, state: shippingState, discount: staticTotals.discountReduction })
          });
          if (res.ok) {
            const data = await res.json();
            if (!data.error) {
              setDynamicTotals(data);
            }
          }
        } catch (e) {
          console.error(e);
        } finally {
          setCalculatingShipping(false);
        }
      };
      const timer = setTimeout(fetchDynamicShipping, 500); // debounce
      return () => clearTimeout(timer);
    } else {
      setDynamicTotals(null);
    }
  }, [pinCode, shippingState, items, staticTotals.discountReduction]);

  if (!mounted) return null;

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

  const startPayment = (orderId: string, shipping: any) =>
    payWithRazorpay({
      orderId,
      shipping,
      onPaid: () => {
        useCart.getState().clearCart();
        router.push('/checkout/success?orderId=' + orderId);
      },
      onError: (message) => {
        setError(message);
        setIsProcessing(false);
      },
      onDismiss: () => setIsProcessing(false),
    });

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
      gstin: String(formData.get('gstin') ?? '').trim().toUpperCase(),
    };

    try {
      if (!idemKeyRef.current) idemKeyRef.current = crypto.randomUUID();
      const { createOrder } = await import('@/actions/orders');
      const result = await createOrder(items, shippingDetails, applied?.code, idemKeyRef.current, creditToApply > 0);

      if (!result.success) {
        setError(result.error || 'Failed to process checkout');
        setIsProcessing(false);
        return;
      }
      idemKeyRef.current = null; // order created; a future checkout gets a fresh key

      if (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
        await startPayment(result.orderId as string, shippingDetails);
        return;
      }

      useCart.getState().clearCart();
      router.push('/checkout/success?orderId=' + result.orderId);
    } catch (err) {
      setError('An unexpected error occurred during checkout');
      setIsProcessing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--unbleached-cotton)] flex flex-col pt-24 pb-12">
        <BackgroundPattern />
        <div className="container mx-auto px-4 relative z-10 flex flex-col items-center justify-center min-h-[50vh]">
          <h1 className="font-serif italic text-4xl mb-6 text-[var(--charcoal-ink)]">Your Cart is Empty</h1>
          <Button variant="primary" onClick={() => router.push('/shop')}>
            Continue Shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--unbleached-cotton)] flex flex-col pt-24 pb-12">
      <BackgroundPattern />
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => router.push('/cart')} 
        title="Sign In to Checkout" 
      />
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
                <select name="state" aria-label="State" required value={shippingState} onChange={e => setShippingState(e.target.value)} className="col-span-1 border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors">
                  <option value="" disabled>State</option>
                  {INDIAN_STATES.map(([code, name]) => (
                    <option key={code + name} value={name}>{name}</option>
                  ))}
                </select>
                <input type="text" name="pinCode" placeholder="PIN Code" required value={pinCode} onChange={e => setPinCode(e.target.value)} className="col-span-1 border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="checkout-gstin" className="font-sans text-sm font-bold text-[var(--charcoal-ink)]">
                GSTIN <span className="font-normal">(optional, for business purchases)</span>
              </label>
              <input
                id="checkout-gstin" type="text" name="gstin" maxLength={15} autoComplete="off"
                pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z][Zz][0-9A-Za-z]"
                title="15-character GSTIN, for example 07ABCDE1234F1Z5"
                className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-mono uppercase focus:outline-none focus:border-[var(--madder-red)] transition-colors"
              />
              <p className="text-xs text-[var(--charcoal-ink)]/80">Printed on your tax invoice so you can claim input tax credit.</p>
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
                    <span className="text-sm opacity-70 block">{item.color} × {formatQuantity(item.quantity, asUnit(item.unit))}</span>
                  </div>
                  <span>₹{lineTotal(item.price, item.quantity).toFixed(2)}</span>
                </div>
              ))}
              {items.length === 0 && (
                <p className="font-sans text-sm opacity-60">Your cart is empty.</p>
              )}
            </div>

            {/* Coupon */}
            <div className="mb-6">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--charcoal-ink)]/90 mb-2">Discount Code</label>
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
            </div>
            
            <div className="space-y-2 font-sans text-sm opacity-80 mb-4">
              {couponError && <p className="text-xs text-[var(--madder-red)] font-bold mt-2">{couponError}</p>}
            </div>

            <div className="border-t border-dashed border-[var(--charcoal-ink)]/20 pt-6 space-y-3 font-mono text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              
              {applied && (
                <div className="flex justify-between text-[var(--madder-red)] font-bold">
                  <span>Discount ({applied.code})</span>
                  <span>-₹{applied.discountAmount.toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span>GST (Dynamic)</span>
                <span>
                  {calculatingShipping ? <span className="opacity-50 animate-pulse">Calculating...</span> : `₹${tax.toFixed(2)}`}
                </span>
              </div>
              {dynamicTotals?.breakdown && !calculatingShipping && (
                <div className="text-[9px] uppercase tracking-widest opacity-50 flex flex-col items-end">
                  {dynamicTotals.breakdown.igst > 0 && <span>IGST: ₹{dynamicTotals.breakdown.igst.toFixed(2)}</span>}
                  {dynamicTotals.breakdown.cgst > 0 && <span>CGST: ₹{dynamicTotals.breakdown.cgst.toFixed(2)}</span>}
                  {dynamicTotals.breakdown.sgst > 0 && <span>SGST: ₹{dynamicTotals.breakdown.sgst.toFixed(2)}</span>}
                </div>
              )}

              <div className="flex justify-between">
                <span>Shipping</span>
                <span>
                  {isFreeShip ? (
                    <span className="text-[var(--madder-red)]">FREE</span>
                  ) : calculatingShipping ? (
                    <span className="opacity-50 animate-pulse">Calculating...</span>
                  ) : (
                    `₹${finalShipping.toFixed(2)}`
                  )}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center font-serif text-2xl font-bold text-[var(--madder-red)] mt-6 pt-6 border-t-2 border-[var(--charcoal-ink)]">
              <span>Total</span>
              <span>{calculatingShipping ? '...' : `₹${total.toFixed(2)}`}</span>
            </div>
            {creditUsable && (
              <div className="mt-4 space-y-2 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCredit}
                    onChange={(e) => setUseCredit(e.target.checked)}
                    className="w-4 h-4 accent-[var(--madder-red)]"
                  />
                  <span>Use my swatch credit (₹{creditBalance.toFixed(2)} available)</span>
                </label>
                {creditToApply > 0 && !calculatingShipping && (
                  <>
                    <div className="flex justify-between">
                      <span>Swatch credit</span>
                      <span>− ₹{creditToApply.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base">
                      <span>To pay now</span>
                      <span>₹{toPay.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
