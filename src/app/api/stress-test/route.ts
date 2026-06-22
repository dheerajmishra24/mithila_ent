import { NextResponse } from 'next/server'
import { processCheckout } from '@/actions/checkout'
import { login } from '@/actions/auth'

export async function GET() {
  // This is a destructive diagnostic endpoint: it fires real login attempts and
  // checkout calls (which can send emails). Never expose it in production.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const results = {
    authRateLimit: [] as any[],
    checkoutRace: [] as any[],
  };

  // 1. Stress Test Auth Rate Limiting
  // Simulate 6 rapid failed login attempts for a dummy user
  const dummyEmail = `hacker_${Date.now()}@test.com`;

  const formData = new FormData();
  formData.append('email', dummyEmail);
  formData.append('password', 'wrongpassword!');

  console.log(`[STRESS TEST] Firing 6 parallel login attempts for ${dummyEmail}...`);
  const authPromises = Array.from({ length: 6 }).map(() => login(null, formData));

  // We wait for all to settle
  const authResponses = await Promise.all(authPromises);
  results.authRateLimit = authResponses.map(r => r?.error || 'Success');

  // 2. Stress Test Checkout Race Condition (Placeholder)
  console.log(`[STRESS TEST] Firing 5 parallel checkout requests...`);

  const mockCartItems = [{
    id: 'prod_1',
    title: 'Stress Test Linen',
    price: 1500,
    quantity: 25
  }];

  const mockShipping = {
    firstName: 'Stress', lastName: 'Tester', email: 'test@mithilaenterprises.com',
    address1: '123 Main', city: 'Mumbai', state: 'MH', pinCode: '400001'
  };

  const checkoutPromises = Array.from({ length: 5 }).map(() => processCheckout(mockCartItems, mockShipping));
  const checkoutResponses = await Promise.all(checkoutPromises);

  results.checkoutRace = checkoutResponses.map(r => r.success ? `Success (Order ${r.orderId})` : `Failed: ${r.error}`);

  return NextResponse.json(results);
}
