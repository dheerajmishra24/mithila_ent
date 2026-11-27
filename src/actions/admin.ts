'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/dal/session'
import { parseOrThrow, productImageUrl, uuid } from '@/lib/validation/common'
import {
  categoryUpdateSchema,
  collectionUpdateSchema,
  productDraftSchema,
  productUpdateSchema,
  siteContentKey,
  stockAdjustmentSchema,
  storeSettingsSchema,
  variantFieldsSchema,
} from '@/lib/validation/admin'
import { decodeImageDataUrl } from '@/lib/image-validation'

// Every action starts with requireAdmin() (src/lib/dal/session.ts), which asks
// the database's is_admin() (public.user_roles). Inputs are parsed with Zod
// before they reach Supabase; catalogue text is stripped of markup (SEC-10),
// image URLs must point at our own image store (SEC-11).

export interface ProductDraft {
  title: string
  description: string
  weaveDensity: string
  count?: string
  construction?: string
  gsm: number
  width: string
  stretch: string
  origin: string
  bestSuitedFor: string
  pricePerMeter: number
  minOrderQuantity?: number
  colors: string[]
  categoryId: string
  subcategoryId?: string
  collectionIds?: string[]
  print?: string
  sellUnit?: 'MTR' | 'PCS'
  remnantThresholdM?: number
  hsnCode?: string
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 100)
}

function revalidateCatalog() {
  revalidatePath('/admin/products')
  revalidatePath('/admin/inventory')
  revalidatePath('/shop')
  revalidatePath('/product/[slug]', 'page')
  revalidateTag('latest-products', 'max')
}

export async function createProduct(draft: ProductDraft, imagePreview: string | null) {
  await requireAdmin()
  const d = parseOrThrow(productDraftSchema, draft)
  const image = imagePreview == null || imagePreview === '' ? null : parseOrThrow(productImageUrl, imagePreview, 'Invalid image')
  const supabase = await createClient()

  const slug = `${slugify(d.title) || 'fabric'}-${Math.floor(Math.random() * 1000)}`

  const { data: prodData, error: prodError } = await supabase.from('products').insert({
    category_id: d.categoryId,
    subcategory_id: d.subcategoryId || null,
    slug,
    title: d.title,
    description: d.description,
    weave: d.weaveDensity,
    count: d.count || null,
    construction: d.construction || null,
    gsm: d.gsm,
    width: d.width,
    stretch: d.stretch,
    origin: d.origin,
    best_suited_for: d.bestSuitedFor.split(',').map(s => s.trim()).filter(Boolean),
    status: 'active',
    print: d.print || null,
    sell_unit: d.sellUnit ?? 'MTR',
    hsn_code: d.hsnCode || null,
  }).select().single()

  if (prodError) throw new Error(prodError.message)

  const variantsToInsert = d.colors.map((color) => ({
    product_id: prodData.id,
    sku: `${slug.substring(0, 3).toUpperCase()}-${color.substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
    color,
    price: d.pricePerMeter,
    stock_quantity: 50,
    min_order_quantity: d.minOrderQuantity || 1,
    images: image ? [image] : []
  }))

  if (variantsToInsert.length > 0) {
    const { error: variantError } = await supabase.from('product_variants').insert(variantsToInsert)
    if (variantError) throw new Error(variantError.message)
  }

  if (d.collectionIds && d.collectionIds.length > 0) {
    const { error } = await supabase
      .from('product_collections')
      .insert(d.collectionIds.map(cId => ({ product_id: prodData.id, collection_id: cId })))
    if (error) throw new Error(error.message)
  }

  revalidatePath('/admin')
  revalidateCatalog()
  return { success: true, slug }
}

// SEC-08: one atomic UPDATE in the database (public.adjust_stock, migration
// 0048) instead of read-add-write, so a concurrent order's decrement is never
// overwritten.
export async function adjustInventory(variantId: string, adjustment: number) {
  await requireAdmin()
  const input = parseOrThrow(stockAdjustmentSchema, { variantId, adjustment })

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('adjust_stock', {
    p_variant_id: input.variantId,
    p_delta: input.adjustment,
  })
  if (error) {
    console.error('adjust_stock failed:', error.message)
    throw new Error(/VARIANT_NOT_FOUND/.test(error.message) ? 'Variant not found' : 'Could not adjust stock')
  }

  revalidatePath('/admin/inventory')
  return { success: true, newStock: data as number }
}

export interface ProductUpdate {
  title: string
  description: string
  status: string
  categoryId: string
  subcategoryId?: string
  weave: string
  count: string
  construction: string
  gsm: number
  width: string
  stretch: string
  origin: string
  bestSuitedFor: string
  collectionIds?: string[]
  print?: string
  sellUnit?: 'MTR' | 'PCS'
  remnantThresholdM?: number
  hsnCode?: string
}

export async function updateProduct(productId: string, fields: ProductUpdate) {
  await requireAdmin()
  const id = parseOrThrow(uuid, productId, 'Invalid product')
  const f = parseOrThrow(productUpdateSchema, fields)
  const supabase = await createClient()

  const { error } = await supabase
    .from('products')
    .update({
      title: f.title,
      description: f.description,
      status: f.status,
      category_id: f.categoryId || null,
      subcategory_id: f.subcategoryId || null,
      weave: f.weave,
      count: f.count || null,
      construction: f.construction || null,
      gsm: f.gsm,
      width: f.width,
      stretch: f.stretch,
      origin: f.origin,
      best_suited_for: f.bestSuitedFor.split(',').map((s) => s.trim()).filter(Boolean),
      print: f.print || null,
      ...(f.sellUnit ? { sell_unit: f.sellUnit } : {}),
      ...(f.remnantThresholdM != null ? { remnant_threshold_m: Math.round(f.remnantThresholdM * 100) / 100 } : {}),
      ...(f.hsnCode !== undefined ? { hsn_code: f.hsnCode || null } : {}),
    })
    .eq('id', id)

  if (error) {
    if (error.message.includes('UNIT_CHANGE_HAS_ROLLS')) {
      throw new Error('This product already has rolls or orders by the metre, so its unit cannot change.')
    }
    throw new Error(error.message)
  }

  if (f.collectionIds) {
    const { error: delErr } = await supabase.from('product_collections').delete().eq('product_id', id)
    if (delErr) throw new Error(delErr.message)
    if (f.collectionIds.length > 0) {
      const { error: insErr } = await supabase
        .from('product_collections')
        .insert(f.collectionIds.map(cId => ({ product_id: id, collection_id: cId })))
      if (insErr) throw new Error(insErr.message)
    }
  }

  revalidateCatalog()
  return { success: true }
}

type VariantFields = { color: string; price: number; stock_quantity: number; min_order_quantity?: number; images?: string[] }

export async function updateVariant(variantId: string, fields: VariantFields) {
  await requireAdmin()
  const id = parseOrThrow(uuid, variantId, 'Invalid variant')
  const f = parseOrThrow(variantFieldsSchema, fields)
  const supabase = await createClient()

  const payload: { color: string; price: number; stock_quantity: number; min_order_quantity?: number; images?: string[] } = {
    color: f.color,
    price: f.price,
    stock_quantity: f.stock_quantity,
  }
  if (f.min_order_quantity != null) payload.min_order_quantity = f.min_order_quantity
  if (f.images != null) payload.images = f.images

  const { error } = await supabase.from('product_variants').update(payload).eq('id', id)
  if (error) throw new Error(error.message)

  revalidateCatalog()
  return { success: true }
}

export async function updateStoreSettings(formData: FormData) {
  await requireAdmin()
  const s = parseOrThrow(storeSettingsSchema, {
    store_name: String(formData.get('store_name') ?? ''),
    support_email: String(formData.get('support_email') ?? '').trim(),
    support_phone: String(formData.get('support_phone') ?? ''),
  })
  const supabase = await createClient()

  const { error } = await supabase
    .from('store_settings')
    .upsert({ id: true, ...s, updated_at: new Date().toISOString() })

  if (error) throw new Error(error.message)

  revalidatePath('/admin/settings')
  revalidateTag('store-settings', 'max')
  redirect('/admin/settings?saved=1')
}

export async function addVariant(productId: string, fields: VariantFields) {
  await requireAdmin()
  const id = parseOrThrow(uuid, productId, 'Invalid product')
  const f = parseOrThrow(variantFieldsSchema, fields)
  const supabase = await createClient()

  const { data: prod } = await supabase.from('products').select('slug').eq('id', id).single()
  const base = (prod?.slug || 'prod').substring(0, 3).toUpperCase()
  const colorPart = (f.color || 'VAR').substring(0, 3).toUpperCase()
  const sku = `${base}-${colorPart}-${Math.floor(Math.random() * 10000)}`

  const { data, error } = await supabase
    .from('product_variants')
    .insert({
      product_id: id,
      sku,
      color: f.color || 'Default',
      price: f.price,
      stock_quantity: f.stock_quantity,
      min_order_quantity: f.min_order_quantity ?? 1,
      images: f.images ?? [],
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidateCatalog()
  return { success: true, variant: data }
}

export async function setUserRole(userId: string, role: 'admin' | 'retail') {
  const me = await requireAdmin()
  const target = parseOrThrow(uuid, userId, 'Invalid user')
  if (role !== 'admin' && role !== 'retail') throw new Error('Invalid role')

  // RLS-06 (migration 0047): public.user_roles is the only source of the admin
  // role. It is writable by the service role only; a trigger mirrors the role
  // into profiles.role, which nothing else may change.
  if (me.id === target && role !== 'admin') {
    throw new Error('You cannot remove your own admin role')
  }

  const admin = createAdminClient()
  const { error } = role === 'admin'
    ? await admin.from('user_roles').upsert(
        { user_id: target, role: 'admin', granted_by: me.id, granted_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
    : await admin.from('user_roles').delete().eq('user_id', target)
  if (error) {
    console.error('setUserRole failed:', error.message)
    throw new Error('Could not change the role')
  }

  revalidatePath('/admin/customers')
  return { success: true }
}

export interface CategoryUpdate {
  name: string
  slug: string
  is_featured: boolean
}

export async function updateCategory(id: string, fields: CategoryUpdate) {
  await requireAdmin()
  const catId = parseOrThrow(uuid, id, 'Invalid category')
  const f = parseOrThrow(categoryUpdateSchema, { ...fields, is_featured: !!fields?.is_featured })
  const slug = slugify(f.slug)
  if (!slug) throw new Error('Name and slug are required')
  const supabase = await createClient()

  const { error } = await supabase
    .from('categories')
    .update({ name: f.name, slug, is_featured: f.is_featured })
    .eq('id', catId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/categories')
  revalidatePath('/shop')
  revalidatePath('/product/[slug]', 'page')
  return { success: true }
}

export async function updateCollection(id: string, fields: { title: string, slug: string, is_active: boolean }) {
  await requireAdmin()
  const colId = parseOrThrow(uuid, id, 'Invalid collection')
  const f = parseOrThrow(collectionUpdateSchema, { ...fields, is_active: !!fields?.is_active })
  const slug = slugify(f.slug)
  if (!slug) throw new Error('Title and slug are required')
  const supabase = await createClient()

  const { error } = await supabase
    .from('collections')
    .update({ title: f.title, slug, is_active: f.is_active })
    .eq('id', colId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/collections')
  revalidatePath('/shop')
  return { success: true }
}

const MAX_CONTENT_FIELD = 50_000
const MAX_CONTENT_FIELDS = 50

export async function updateSiteContent(formData: FormData) {
  await requireAdmin()
  const key = parseOrThrow(siteContentKey, String(formData.get('key') ?? ''), 'Missing content key')
  const title = String(formData.get('title') ?? '').trim().slice(0, 300)

  // Collect all fields that are not 'key' or 'title' (Next.js adds $ACTION_*
  // fields for server actions; skip those).
  const payload: Record<string, string> = {}
  let count = 0
  for (const [k, v] of formData.entries()) {
    if (k === 'key' || k === 'title' || k.startsWith('$ACTION')) continue
    if (typeof v !== 'string') continue
    if (++count > MAX_CONTENT_FIELDS || k.length > 100 || v.length > MAX_CONTENT_FIELD) {
      throw new Error('Content too large')
    }
    payload[k] = v.trim()
  }

  // If the only field is 'body', store it as a raw string for backwards compatibility,
  // unless we have multiple custom fields, in which case we stringify the whole payload.
  let bodyContent = ''
  const keys = Object.keys(payload)
  if (keys.length > 0) {
    bodyContent = keys.length === 1 && payload['body'] !== undefined ? payload['body'] : JSON.stringify(payload)
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('site_content')
    .upsert({ key, title, body: bodyContent, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)

  revalidatePath('/admin/content')
  revalidatePath('/')
  revalidatePath('/about')
  revalidatePath('/legal', 'layout')
  revalidateTag('site-content', 'max')
  redirect('/admin/content?saved=1')
}

export async function deleteProduct(productId: string) {
  await requireAdmin()
  const id = parseOrThrow(uuid, productId, 'Invalid product')

  // Use the service-role client for the integrity check + write so it doesn't
  // depend on RLS nuances. We've already verified the caller is an admin.
  const admin = createAdminClient()

  // Has this product ever been ordered? order_items.variant_id is ON DELETE
  // SET NULL, so a hard delete would silently strip the product from past
  // invoices. If referenced, archive instead (hidden from storefront via the
  // status='active' RLS read policy); otherwise hard-delete (variants cascade).
  const { data: variants, error: vErr } = await admin
    .from('product_variants')
    .select('id')
    .eq('product_id', id)
  if (vErr) throw new Error(vErr.message)
  const variantIds = (variants || []).map((v: { id: string }) => v.id)

  let referenced = false
  if (variantIds.length > 0) {
    const { count, error: cErr } = await admin
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .in('variant_id', variantIds)
    if (cErr) throw new Error(cErr.message)
    referenced = (count || 0) > 0
  }

  if (referenced) {
    const { error } = await admin.from('products').update({ status: 'archived' }).eq('id', id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await admin.from('products').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  revalidateCatalog()
  return { success: true, archived: referenced }
}

// SEC-11: the type comes from the file's magic bytes, not the declared MIME.
// JPEG, PNG, WebP and AVIF only (no SVG), 5 MB max (same as the bucket).
export async function uploadProductImage(dataUrl: string) {
  await requireAdmin()
  const { buffer, image } = decodeImageDataUrl(dataUrl)

  const admin = createAdminClient()
  const path = `${globalThis.crypto.randomUUID()}.${image.ext}`
  const { error } = await admin.storage.from('product-images').upload(path, buffer, {
    contentType: image.contentType,
    upsert: false,
    cacheControl: '31536000',
  })
  if (error) {
    console.error('uploadProductImage failed:', error.message)
    throw new Error('Image upload failed')
  }

  const { data } = admin.storage.from('product-images').getPublicUrl(path)
  return { url: data.publicUrl }
}
