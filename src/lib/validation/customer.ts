import { z } from 'zod';
import { plainText, uuid } from './common';
import { gstStateCode, isValidGstin } from '@/lib/gst';

// Input schemas for customer-facing Server Actions (SEC-12).

const optionalText = (max: number) =>
  z.union([plainText(max), z.null(), z.undefined()]).transform((v) => v ?? '');

/** Shipping / saved address. Unknown keys are dropped, every field is capped. */
export const addressSchema = z.object({
  firstName: plainText(100, { min: 1 }),
  lastName: optionalText(100),
  email: z
    .union([z.literal(''), z.null(), z.undefined(), z.string().trim().max(254).pipe(z.email())])
    .transform((v) => v || ''),
  address1: plainText(200, { min: 1 }),
  address2: optionalText(200),
  city: plainText(100, { min: 1 }),
  // Place of supply for GST: must be a recognised Indian state or UT.
  state: plainText(100, { min: 1 }).refine((v) => gstStateCode(v) !== null, 'Please choose your state.'),
  pinCode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Please enter a valid 6-digit PIN code.'),
  // Optional, for business purchases: printed on the tax invoice.
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === '' || isValidGstin(v), 'Please enter a valid GSTIN.')
    .nullish()
    .transform((v) => v || undefined),
});

export type Address = z.output<typeof addressSchema>;

/**
 * Cart lines. The Zustand cart stores the variant id as `id` (src/store/useCart.ts),
 * so accept either `variant_id` or `id`. Quantities are metres (0.5 m steps
 * allowed); the database re-checks stock, MOQ and price.
 */
export const cartItemsSchema = z
  .array(
    z
      .object({
        variant_id: uuid.optional(),
        id: uuid.optional(),
        quantity: z.coerce.number().finite().positive().max(10_000),
      })
      .transform((i) => ({ variant_id: i.variant_id ?? i.id, quantity: i.quantity }))
      .refine((i) => !!i.variant_id, 'Missing variant'),
  )
  .min(1, 'Your cart is empty.')
  .max(50, 'Too many items in the cart.');

export const discountCodeSchema = z
  .union([z.string().trim().max(50).regex(/^[A-Za-z0-9_-]*$/), z.null(), z.undefined()])
  .transform((v) => (v ? v : null));

export const idempotencyKeySchema = z.union([uuid, z.null(), z.undefined()]).transform((v) => v ?? null);

export const variantIdListSchema = z.array(uuid).max(100);
