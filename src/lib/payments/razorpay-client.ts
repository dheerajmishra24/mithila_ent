// Browser-side Razorpay Checkout launcher shared by the cart checkout and the
// swatch kit page. The server decides the amount (/api/payment/razorpay/
// create-order charges orders.amount_due) and verifies the payment.

type Shipping = { firstName?: unknown; lastName?: unknown; email?: unknown };

interface PayOptions {
  orderId: string;
  shipping: Shipping;
  description?: string;
  onPaid: () => void;
  onError: (message: string) => void;
  onDismiss: () => void;
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const sc = document.createElement('script');
    sc.src = 'https://checkout.razorpay.com/v1/checkout.js';
    sc.onload = () => resolve(true);
    sc.onerror = () => resolve(false);
    document.body.appendChild(sc);
  });
}

export async function payWithRazorpay({ orderId, shipping, description, onPaid, onError, onDismiss }: PayOptions) {
  if (!(await loadRazorpay())) {
    onError('Could not load the payment gateway.');
    return;
  }
  const res = await fetch('/api/payment/razorpay/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });
  const data = await res.json();
  if (!res.ok) {
    onError(data.error || 'Could not start payment.');
    return;
  }
  const rzp = new (window as any).Razorpay({
    key: data.keyId,
    amount: data.amount,
    currency: data.currency,
    order_id: data.razorpayOrderId,
    name: 'Mithila Enterprises',
    description: description ?? `Order ${String(orderId).split('-')[0].toUpperCase()}`,
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
      if (v.ok) onPaid();
      else onError('Payment could not be verified. If you were charged, please contact support.');
    },
    modal: { ondismiss: onDismiss },
  });
  rzp.open();
}
