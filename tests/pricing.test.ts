import { describe, it, expect } from 'vitest';
import { computeOrderTotals } from '@/lib/pricing';

describe('order totals (mirrors create_order_atomic)', () => {
  it('no discount: 18% GST + flat ₹50 shipping', () => {
    const t = computeOrderTotals(1000);
    expect(t.tax).toBe(180);
    expect(t.shipping).toBe(50);
    expect(t.total).toBe(1230);
  });
  it('percentage discount reduces the total', () => {
    expect(computeOrderTotals(1000, { type: 'percentage', amount: 100 }).total).toBe(1130);
  });
  it('fixed-amount discount', () => {
    expect(computeOrderTotals(1000, { type: 'fixed_amount', amount: 200 }).total).toBe(1030);
  });
  it('free shipping waives shipping only (no double discount)', () => {
    const t = computeOrderTotals(1000, { type: 'free_shipping', amount: 50 });
    expect(t.shipping).toBe(0);
    expect(t.total).toBe(1180);
  });
  it('empty cart: no shipping, zero total', () => {
    const t = computeOrderTotals(0);
    expect(t.shipping).toBe(0);
    expect(t.total).toBe(0);
  });
});
