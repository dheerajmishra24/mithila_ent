import crypto from 'crypto';

const RP_BASE = 'https://api.razorpay.com/v1';

export function razorpayConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export async function createRazorpayOrder(amountPaise: number, receipt: string, notes?: Record<string, string>) {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const res = await fetch(`${RP_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, payment_capture: 1, notes: notes || {} }),
  });
  if (!res.ok) {
    throw new Error(`Razorpay order create failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<{ id: string; amount: number; currency: string }>;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Verifies the checkout callback signature: HMAC_SHA256(order_id|payment_id, key_secret).
export function verifyPaymentSignature(razorpayOrderId: string, razorpayPaymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  const expected = crypto.createHmac('sha256', secret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

// Verifies a Razorpay webhook: HMAC_SHA256(rawBody, webhook_secret).
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}
