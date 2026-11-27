import { z } from 'zod';
import { plainText, productImageUrl, uuid } from './common';

// Input schemas for src/actions/admin.ts (SEC-10, SEC-11, SEC-12).

const money = z.coerce.number().finite().min(0).max(10_000_000);
// Fabric is sold in 0.5 m steps (migration 0050); pieces round to whole numbers in the UI.
const halfStep = (n: number) => Math.round(n * 2) / 2;
const stockQty = z.coerce.number().finite().min(0).max(1_000_000).transform(halfStep);
const minOrder = z.coerce.number().finite().min(0.5).max(10_000).transform(halfStep);
const csv = plainText(500);
// HSN: 4, 6 or 8 digits (blank clears it).
const hsn = z.union([z.literal(''), z.string().trim().regex(/^\d{4}(\d{2}){0,2}$/, 'HSN must be 4, 6 or 8 digits')]).optional();

export const productDraftSchema = z.object({
  title: plainText(200, { min: 1 }),
  description: plainText(5000),
  weaveDensity: plainText(100),
  count: plainText(100).nullish(),
  construction: plainText(100).nullish(),
  gsm: z.coerce.number().finite().min(0).max(5000),
  width: plainText(50),
  stretch: plainText(50),
  origin: plainText(100),
  bestSuitedFor: csv,
  pricePerMeter: money,
  minOrderQuantity: minOrder.nullish(),
  colors: z.array(plainText(60, { min: 1 })).max(50),
  categoryId: uuid,
  subcategoryId: z.union([uuid, z.literal('')]).nullish(),
  collectionIds: z.array(uuid).max(50).nullish(),
  print: plainText(100).nullish(),
  sellUnit: z.enum(['MTR', 'PCS']).optional(),
  hsnCode: hsn,
});

export const productUpdateSchema = z.object({
  title: plainText(200, { min: 1 }),
  description: plainText(5000),
  status: z.enum(['draft', 'active', 'archived']),
  categoryId: z.union([uuid, z.literal('')]).nullish(),
  subcategoryId: z.union([uuid, z.literal('')]).nullish(),
  weave: plainText(100),
  count: plainText(100),
  construction: plainText(100),
  gsm: z.coerce.number().finite().min(0).max(5000),
  width: plainText(50),
  stretch: plainText(50),
  origin: plainText(100),
  bestSuitedFor: csv,
  collectionIds: z.array(uuid).max(50).nullish(),
  print: plainText(100).nullish(),
  sellUnit: z.enum(['MTR', 'PCS']).optional(),
  remnantThresholdM: z.coerce.number().finite().min(0).max(100).optional(),
  hsnCode: hsn,
});

export const variantFieldsSchema = z.object({
  color: plainText(60),
  price: money,
  stock_quantity: stockQty,
  min_order_quantity: minOrder.nullish(),
  images: z.array(productImageUrl).max(20).nullish(),
});

export const stockAdjustmentSchema = z.object({
  variantId: uuid,
  adjustment: z.number().int().refine((n) => n !== 0 && Math.abs(n) <= 100_000, 'Adjustment out of range'),
});

export const categoryUpdateSchema = z.object({
  name: plainText(100, { min: 1 }),
  slug: z.string().max(120),
  is_featured: z.boolean(),
});

export const collectionUpdateSchema = z.object({
  title: plainText(150, { min: 1 }),
  slug: z.string().max(120),
  is_active: z.boolean(),
});

export const storeSettingsSchema = z.object({
  store_name: plainText(150),
  support_email: z.union([z.literal(''), z.string().trim().max(254).pipe(z.email())]),
  support_phone: plainText(20),
});

export const siteContentKey = z.string().trim().min(1).max(100).regex(/^[a-z0-9_.-]+$/i);
