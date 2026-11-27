// Quantities: fabric is sold by the metre in 0.5 m steps ('MTR'); sarees and
// stitched items by the piece ('PCS'). The database enforces the same rules
// (migration 0050); this module keeps the UI in step with it.
// Safe to import from server and client code.

export type SellUnit = 'MTR' | 'PCS';

export function asUnit(value: unknown): SellUnit {
  return value === 'PCS' ? 'PCS' : 'MTR';
}

export function stepFor(unit: SellUnit): number {
  return unit === 'PCS' ? 1 : 0.5;
}

/** Round to the unit's step (half metres or whole pieces), never below one step. */
export function snapQuantity(quantity: number, unit: SellUnit): number {
  const step = stepFor(unit);
  if (!Number.isFinite(quantity)) return step;
  return Math.max(step, Math.round(quantity / step) * step);
}

export function isValidQuantity(quantity: number, unit: SellUnit): boolean {
  return Number.isFinite(quantity) && quantity > 0 && quantity <= 10_000 && snapQuantity(quantity, unit) === quantity;
}

/** Clamp to MOQ and, for metres, the longest single cut available. */
export function clampQuantity(quantity: number, unit: SellUnit, moq: number, maxCut?: number | null): number {
  let q = snapQuantity(Math.max(quantity, moq || stepFor(unit)), unit);
  if (unit === 'MTR' && maxCut != null && maxCut > 0) {
    const cap = Math.floor(maxCut / 0.5) * 0.5;
    if (cap >= (moq || 0.5)) q = Math.min(q, cap);
  }
  return q;
}

/** "2.5 m", "1 m", "3 pcs", "1 pc". */
export function formatQuantity(quantity: number, unit: SellUnit): string {
  const n = Number(quantity);
  const text = Number.isInteger(n) ? String(n) : n.toFixed(1);
  if (unit === 'PCS') return `${text} ${n === 1 ? 'pc' : 'pcs'}`;
  return `${text} m`;
}

/** Line total in rupees, rounded to paise (avoids 0.1 + 0.2 style drift). */
export function lineTotal(price: number, quantity: number): number {
  return Math.round(price * quantity * 100) / 100;
}
