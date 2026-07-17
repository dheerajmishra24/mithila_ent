'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

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
  collectionIds?: string[]
  print?: string
}

export async function createProduct(draft: ProductDraft, imagePreview: string | null) {
  const supabase = await createClient()

  // Verify Admin
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) throw new Error('Unauthorized')
  const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single()
  if (adminProfile?.role !== 'admin') throw new Error('Forbidden')
  
  if (!draft.categoryId) {
    throw new Error('Category is required')
  }

  // Generate a unique slug
  const slug = draft.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Math.floor(Math.random()*1000)

  // Insert the core product record securely on the server side
  const { data: prodData, error: prodError } = await supabase.from('products').insert({
    category_id: draft.categoryId,
    slug: slug,
    title: draft.title,
    description: draft.description,
    weave: draft.weaveDensity,
    count: draft.count || null,
    construction: draft.construction || null,
    gsm: draft.gsm,
    width: draft.width,
    stretch: draft.stretch,
    origin: draft.origin,
    best_suited_for: draft.bestSuitedFor.split(',').map(s => s.trim()).filter(Boolean),
    status: 'active',
    print: draft.print || null
  }).select().single()

  if (prodError) throw new Error(prodError.message)

  // Insert all child color variants securely
  const variantsToInsert = draft.colors.map((color, idx) => ({
    product_id: prodData.id,
    sku: `${slug.substring(0,3).toUpperCase()}-${color.substring(0,3).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
    color: color,
    price: draft.pricePerMeter,
    stock_quantity: 50,
    min_order_quantity: draft.minOrderQuantity || 1,
    images: imagePreview ? [imagePreview] : []
  }))

  if (variantsToInsert.length > 0) {
    const { error: variantError } = await supabase.from('product_variants').insert(variantsToInsert)
    if (variantError) throw new Error(variantError.message)
  }

  // Insert collections
  if (draft.collectionIds && draft.collectionIds.length > 0) {
    const collectionInserts = draft.collectionIds.map(cId => ({
      product_id: prodData.id,
      collection_id: cId
    }))
    await supabase.from('product_collections').insert(collectionInserts)
  }

  revalidatePath('/admin')
  revalidatePath('/shop')
  revalidatePath('/product/[slug]', 'page')
  revalidateTag('latest-products', 'max')
  return { success: true, slug }
}

export async function adjustInventory(variantId: string, adjustment: number) {
  const supabase = await createClient()
  
  // Verify Admin Role before allowing inventory edits
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) throw new Error('Unauthorized')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')
  
  const { data: current, error: fetchErr } = await supabase
    .from('product_variants')
    .select('stock_quantity')
    .eq('id', variantId)
    .single()
    
  if (fetchErr || !current) throw new Error('Variant not found')
  
  const newStock = Math.max(0, current.stock_quantity + adjustment)
  
  const { error: updateErr } = await supabase
    .from('product_variants')
    .update({ stock_quantity: newStock })
    .eq('id', variantId)
    
  if (updateErr) throw new Error(updateErr.message)
  
  revalidatePath('/admin/inventory')
  return { success: true, newStock }
}


async function assertAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) throw new Error('Unauthorized')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')
}

export interface ProductUpdate {
  title: string
  description: string
  status: string
  categoryId: string
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
}

export async function updateProduct(productId: string, fields: ProductUpdate) {
  const supabase = await createClient()
  await assertAdmin(supabase)

  const { error } = await supabase
    .from('products')
    .update({
      title: fields.title,
      description: fields.description,
      status: fields.status,
      category_id: fields.categoryId || null,
      weave: fields.weave,
      count: fields.count || null,
      construction: fields.construction || null,
      gsm: fields.gsm,
      width: fields.width,
      stretch: fields.stretch,
      origin: fields.origin,
      best_suited_for: fields.bestSuitedFor.split(',').map((s) => s.trim()).filter(Boolean),
      print: fields.print || null
    })
    .eq('id', productId)

  if (error) throw new Error(error.message)

  if (fields.collectionIds) {
    await supabase.from('product_collections').delete().eq('product_id', productId)
    if (fields.collectionIds.length > 0) {
      const collectionInserts = fields.collectionIds.map(cId => ({
        product_id: productId,
        collection_id: cId
      }))
      await supabase.from('product_collections').insert(collectionInserts)
    }
  }

  revalidatePath('/admin/products')
  revalidatePath('/admin/inventory')
  revalidatePath('/shop')
  revalidatePath('/product/[slug]', 'page')
  revalidateTag('latest-products', 'max')
  return { success: true }
}

export async function updateVariant(
  variantId: string,
  fields: { color: string; price: number; stock_quantity: number; min_order_quantity?: number; images?: string[] }
) {
  const supabase = await createClient()
  await assertAdmin(supabase)

  const payload: any = {
    color: fields.color,
    price: fields.price,
    stock_quantity: Math.max(0, Math.floor(fields.stock_quantity)),
  }
  if (fields.min_order_quantity !== undefined) payload.min_order_quantity = Math.max(1, Math.floor(fields.min_order_quantity))
  if (fields.images !== undefined) payload.images = fields.images

  const { error } = await supabase
    .from('product_variants')
    .update(payload)
    .eq('id', variantId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/products')
  revalidatePath('/admin/inventory')
  revalidatePath('/shop')
  revalidatePath('/product/[slug]', 'page')
  revalidateTag('latest-products', 'max')
  return { success: true }
}

export async function updateStoreSettings(formData: FormData) {
  const supabase = await createClient()
  await assertAdmin(supabase)

  const store_name = ((formData.get('store_name') as string) || '').trim()
  const support_email = ((formData.get('support_email') as string) || '').trim()
  const support_phone = ((formData.get('support_phone') as string) || '').trim()

  const { error } = await supabase
    .from('store_settings')
    .upsert({ id: true, store_name, support_email, support_phone, updated_at: new Date().toISOString() })

  if (error) throw new Error(error.message)

  revalidatePath('/admin/settings')
  revalidateTag('store-settings', 'max')
  redirect('/admin/settings?saved=1')
}


export async function addVariant(
  productId: string,
  fields: { color: string; price: number; stock_quantity: number; min_order_quantity?: number; images?: string[] }
) {
  const supabase = await createClient()
  await assertAdmin(supabase)

  const { data: prod } = await supabase.from('products').select('slug').eq('id', productId).single()
  const base = (prod?.slug || 'prod').substring(0, 3).toUpperCase()
  const colorPart = (fields.color || 'VAR').substring(0, 3).toUpperCase()
  const sku = `${base}-${colorPart}-${Math.floor(Math.random() * 10000)}`

  const { data, error } = await supabase
    .from('product_variants')
    .insert({
      product_id: productId,
      sku,
      color: fields.color || 'Default',
      price: fields.price,
      stock_quantity: Math.max(0, Math.floor(fields.stock_quantity)),
      min_order_quantity: Math.max(1, Math.floor(fields.min_order_quantity || 1)),
      images: fields.images ?? [],
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/admin/products')
  revalidatePath('/admin/inventory')
  revalidatePath('/shop')
  revalidatePath('/product/[slug]', 'page')
  revalidateTag('latest-products', 'max')
  return { success: true, variant: data }
}


export async function setUserRole(userId: string, role: 'admin' | 'retail') {
  const supabase = await createClient()
  await assertAdmin(supabase)
  if (role !== 'admin' && role !== 'retail') throw new Error('Invalid role')

  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/customers')
  return { success: true }
}

export interface CategoryUpdate {
  name: string
  slug: string
  is_featured: boolean
}

export async function updateCategory(id: string, fields: CategoryUpdate) {
  const supabase = await createClient()
  await assertAdmin(supabase)

  const slug = (fields.slug || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  if (!fields.name?.trim() || !slug) throw new Error('Name and slug are required')

  const { error } = await supabase
    .from('categories')
    .update({ name: fields.name.trim(), slug, is_featured: !!fields.is_featured })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/categories')
  revalidatePath('/shop')
  revalidatePath('/product/[slug]', 'page')
  return { success: true }
}

export async function updateCollection(id: string, fields: { title: string, slug: string, is_active: boolean }) {
  const supabase = await createClient()
  await assertAdmin(supabase)

  const slug = (fields.slug || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  if (!fields.title?.trim() || !slug) throw new Error('Title and slug are required')

  const { error } = await supabase
    .from('collections')
    .update({ title: fields.title.trim(), slug, is_active: !!fields.is_active })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/collections')
  revalidatePath('/shop')
  return { success: true }
}

export async function updateSiteContent(formData: FormData) {
  const supabase = await createClient()
  await assertAdmin(supabase)

  const key = ((formData.get('key') as string) || '').trim()
  const title = ((formData.get('title') as string) || '').trim()
  
  if (!key) throw new Error('Missing content key')

  // Collect all fields that are not 'key' or 'title'
  const payload: any = {}
  let hasExtraFields = false
  for (const [k, v] of formData.entries()) {
    if (k !== 'key' && k !== 'title') {
      payload[k] = (v as string).trim()
      hasExtraFields = true
    }
  }

  // If the only field is 'body', store it as a raw string for backwards compatibility,
  // unless we have multiple custom fields, in which case we stringify the whole payload.
  let bodyContent = ''
  if (hasExtraFields) {
    if (Object.keys(payload).length === 1 && payload['body'] !== undefined) {
      bodyContent = payload['body']
    } else {
      bodyContent = JSON.stringify(payload)
    }
  }

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
  const supabase = await createClient()
  await assertAdmin(supabase)

  // Use the service-role client for the integrity check + write so it doesn't
  // depend on RLS nuances. We've already verified the caller is an admin.
  const admin = createAdminClient()

  // Has this product ever been ordered? order_items.variant_id is ON DELETE
  // SET NULL, so a hard delete would silently strip the product from past
  // invoices. If referenced, archive instead (hidden from storefront via the
  // status='active' RLS read policy); otherwise hard-delete (variants cascade).
  const { data: variants } = await admin
    .from('product_variants')
    .select('id')
    .eq('product_id', productId)
  const variantIds = (variants || []).map((v: { id: string }) => v.id)

  let referenced = false
  if (variantIds.length > 0) {
    const { count } = await admin
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .in('variant_id', variantIds)
    referenced = (count || 0) > 0
  }

  if (referenced) {
    const { error } = await admin.from('products').update({ status: 'archived' }).eq('id', productId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await admin.from('products').delete().eq('id', productId)
    if (error) throw new Error(error.message)
  }

  revalidatePath('/admin/products')
  revalidatePath('/admin/inventory')
  revalidatePath('/shop')
  revalidatePath('/product/[slug]', 'page')
  revalidateTag('latest-products', 'max')
  return { success: true, archived: referenced }
}

export async function uploadProductImage(dataUrl: string) {
  const supabase = await createClient()
  await assertAdmin(supabase)

  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw new Error('Invalid image data')
  }
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) throw new Error('Unsupported image format')
  const contentType = match[1]
  const ext = contentType.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg')
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.byteLength > 6 * 1024 * 1024) throw new Error('Image too large (max 6MB)')

  // Service-role upload (admin already verified above). Bypasses Storage RLS.
  const admin = createAdminClient()
  const path = `${globalThis.crypto.randomUUID()}.${ext}`
  const { error } = await admin.storage.from('product-images').upload(path, buffer, {
    contentType,
    upsert: false,
    cacheControl: '31536000',
  })
  if (error) throw new Error(error.message)

  const { data } = admin.storage.from('product-images').getPublicUrl(path)
  return { url: data.publicUrl }
}
