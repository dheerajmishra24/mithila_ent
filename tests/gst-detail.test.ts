import { describe, it, expect } from 'vitest';
import { gstRateFor, isValidGstin, INDIAN_STATES, stateName, gstStateCode } from '@/lib/gst';
import { monthBounds, MONTH_RE } from '@/lib/dal/gst-report';
import { csvCell } from '@/lib/csv';

describe('gstRateFor (GST 2.0 rate by HSN chapter)', () => {
  it('charges a flat 5% on fabrics, chapters 50 to 60', () => {
    expect(gstRateFor('5208', 9999)).toBe(5);
    expect(gstRateFor('540752', 100)).toBe(5);
    expect(gstRateFor('6006', 4000)).toBe(5);
  });

  it('applies the Rs 2,500 cliff to stitched garments, chapters 61 and 62', () => {
    expect(gstRateFor('6204', 2500)).toBe(5);
    expect(gstRateFor('6204', 2500.01)).toBe(18);
    expect(gstRateFor('61091000', 800)).toBe(5);
    expect(gstRateFor('61091000', 3000)).toBe(18);
  });

  it('falls back to the product rate when the HSN is missing or outside those chapters', () => {
    expect(gstRateFor(null, 100)).toBe(5);
    expect(gstRateFor(undefined, 100, 12)).toBe(12);
    expect(gstRateFor('9619', 100, 12)).toBe(12);
  });
});

describe('isValidGstin', () => {
  it('accepts a GSTIN with a correct check digit', () => {
    expect(isValidGstin('07AGUPM2548P1ZH')).toBe(true);
  });

  it('normalises case, as the checkout form does', () => {
    expect(isValidGstin('07agupm2548p1zh')).toBe(true);
  });

  it('rejects a wrong check digit or a bad shape', () => {
    expect(isValidGstin('07AGUPM2548P1ZA')).toBe(false);
    expect(isValidGstin('07AGUPM2548P1Z')).toBe(false);
    expect(isValidGstin('')).toBe(false);
    expect(isValidGstin(null)).toBe(false);
  });
});

describe('state list and names', () => {
  it('lists every state once with a two-digit code, sorted by name', () => {
    const codes = INDIAN_STATES.map(([c]) => c);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(c).toMatch(/^\d\d$/);
    const names = INDIAN_STATES.map(([, n]) => n);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it('round-trips each listed name through gstStateCode', () => {
    for (const [code, name] of INDIAN_STATES) expect(gstStateCode(name)).toBe(code);
  });

  it('names a state code and returns null for unknown codes', () => {
    expect(stateName('07')).toBe('Delhi');
    expect(stateName('99')).toBeNull();
    expect(stateName(null)).toBeNull();
  });
});

describe('GST report month helpers', () => {
  it('accepts only YYYY-MM', () => {
    expect(MONTH_RE.test('2026-11')).toBe(true);
    expect(MONTH_RE.test('2026-13')).toBe(false);
    expect(MONTH_RE.test('2026-1')).toBe(false);
    expect(MONTH_RE.test("2026-11' OR 1=1")).toBe(false);
  });

  it('returns the first and last day of the month, including leap years', () => {
    expect(monthBounds('2026-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(monthBounds('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthBounds('2027-02')).toEqual({ from: '2027-02-01', to: '2027-02-28' });
  });
});

describe('GST CSV cells', () => {
  it('keeps negative adjustment amounts as numbers but neutralises formula text', () => {
    expect(csvCell(-120.5)).toBe('-120.5');
    expect(csvCell('-120.5')).toBe('"\t-120.5"');
    expect(csvCell('=HYPERLINK("x")')).toBe('"\t=HYPERLINK(""x"")"');
  });
});

describe('checkout address GSTIN field', () => {
  const base = { firstName: 'A', lastName: 'B', email: '', address1: '1 Road', address2: '', city: 'Patna', state: 'Bihar', pinCode: '800001' };

  it('is optional for B2C buyers (missing, empty or null)', async () => {
    const { addressSchema } = await import('@/lib/validation/customer');
    expect(addressSchema.parse(base).gstin).toBeUndefined();
    expect(addressSchema.parse({ ...base, gstin: '' }).gstin).toBeUndefined();
    expect(addressSchema.parse({ ...base, gstin: null }).gstin).toBeUndefined();
  });

  it('trims and upper-cases a valid GSTIN and rejects a bad one', async () => {
    const { addressSchema } = await import('@/lib/validation/customer');
    expect(addressSchema.parse({ ...base, gstin: ' 07agupm2548p1zh ' }).gstin).toBe('07AGUPM2548P1ZH');
    expect(addressSchema.safeParse({ ...base, gstin: '07AGUPM2548P1ZA' }).success).toBe(false);
  });
});
