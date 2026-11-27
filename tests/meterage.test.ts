import { describe, expect, it } from 'vitest';
import { asUnit, clampQuantity, formatQuantity, isValidQuantity, lineTotal, snapQuantity, stepFor } from '@/lib/meterage';

describe('meterage', () => {
  it('treats anything but PCS as metres', () => {
    expect(asUnit('PCS')).toBe('PCS');
    expect(asUnit('MTR')).toBe('MTR');
    expect(asUnit(undefined)).toBe('MTR');
    expect(asUnit('pcs')).toBe('MTR');
  });

  it('steps by half metres and whole pieces', () => {
    expect(stepFor('MTR')).toBe(0.5);
    expect(stepFor('PCS')).toBe(1);
    expect(snapQuantity(2.3, 'MTR')).toBe(2.5);
    expect(snapQuantity(2.2, 'MTR')).toBe(2);
    expect(snapQuantity(0.1, 'MTR')).toBe(0.5);
    expect(snapQuantity(2.4, 'PCS')).toBe(2);
    expect(snapQuantity(Number.NaN, 'MTR')).toBe(0.5);
  });

  it('accepts only exact steps', () => {
    expect(isValidQuantity(1.5, 'MTR')).toBe(true);
    expect(isValidQuantity(1.25, 'MTR')).toBe(false);
    expect(isValidQuantity(1.5, 'PCS')).toBe(false);
    expect(isValidQuantity(0, 'MTR')).toBe(false);
    expect(isValidQuantity(10_000.5, 'MTR')).toBe(false);
  });

  it('clamps to the minimum order and the longest single cut', () => {
    expect(clampQuantity(1, 'MTR', 2)).toBe(2);
    expect(clampQuantity(9, 'MTR', 1, 6.3)).toBe(6);
    // a cap below the minimum is ignored rather than producing an unorderable length
    expect(clampQuantity(3, 'MTR', 2, 1.5)).toBe(3);
    // piece goods ignore the roll cap
    expect(clampQuantity(9, 'PCS', 1, 2)).toBe(9);
  });

  it('formats with units', () => {
    expect(formatQuantity(2.5, 'MTR')).toBe('2.5 m');
    expect(formatQuantity(3, 'MTR')).toBe('3 m');
    expect(formatQuantity(1, 'PCS')).toBe('1 pc');
    expect(formatQuantity(4, 'PCS')).toBe('4 pcs');
  });

  it('rounds line totals to paise', () => {
    expect(lineTotal(333.33, 1.5)).toBe(500);
    expect(lineTotal(0.1, 3)).toBe(0.3);
    expect(lineTotal(1299, 2.5)).toBe(3247.5);
  });
});
