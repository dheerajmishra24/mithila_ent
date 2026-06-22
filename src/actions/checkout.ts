'use server'

import { createClient } from '@/lib/supabase/server'
import { sendInvoiceEmail } from '@/lib/email'

export async function processCheckout(cartItems: any[], shippingDetails: any) {
  const supabase = await createClient()
  
  // 1. Calculate exact totals (Financial Math Integrity)
  let subtotal = 0;
  for (const item of cartItems) {
    // In a real app, we must fetch the price from the DB to prevent client-side tampering!
    // But since this is a mock catalog right now, we'll trust the passed price for the placeholder.
    subtotal += (item.price * item.quantity);
  }
  
  // High-End exact math calculation
  const taxRate = 0.18; // 18% GST placeholder
  const taxAmount = Number((subtotal * taxRate).toFixed(2));
  const total = Number((subtotal + taxAmount).toFixed(2));

  // 2. Validate Stock Levels (Edge case handling)
  // For the sake of the placeholder, we assume stock is available unless quantity > 100
  for (const item of cartItems) {
    if (item.quantity > 100) {
      return { success: false, error: `Item ${item.title} is currently out of stock for requested quantity.` }
    }
  }

  // 3. Razorpay Placeholder Integration
  // Here we would call razorpay.orders.create({ amount: total * 100, currency: "INR" })
  const mockRazorpayOrderId = `order_rzp_mock_${Date.now()}`;
  const mockPaymentId = `pay_mock_${Math.random().toString(36).substring(7)}`;

  // 4. Save Order to Database
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id || null;

  // We are skipping the actual DB insert here if we don't have the variant IDs 
  // perfectly synced from the mock data to the DB. Since we are using hardcoded mock data
  // on the frontend (MOCK_VARIANTS), DB insert will fail Foreign Key constraints.
  // Instead, we log it.
  console.log(`[DB Placeholder] Saving order for ${shippingDetails.firstName} ${shippingDetails.lastName}. Total: ₹${total}`);

  // 5. Generate and Send PDF Invoice via Resend
  await sendInvoiceEmail(
    shippingDetails.email || 'customer@example.com', 
    shippingDetails, 
    cartItems, 
    subtotal, 
    taxAmount, 
    total,
    mockPaymentId
  );

  return { 
    success: true, 
    orderId: mockRazorpayOrderId,
    paymentId: mockPaymentId,
    total
  }
}
