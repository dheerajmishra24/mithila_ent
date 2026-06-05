'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ProductDraft {
  title: string
  description: string
  weaveDensity: string
  gsm: number
  width: string
  stretch: string
  origin: string
  bestSuitedFor: string
  pricePerMeter: number
  colors: string[]
  categoryId: string
}

export async function createProduct(draft: ProductDraft, imagePreview: string | null) {
  const supabase = await createClient()
  
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
    gsm: draft.gsm,
    width: draft.width,
    stretch: draft.stretch,
    origin: draft.origin,
    best_suited_for: draft.bestSuitedFor.split(',').map(s => s.trim()).filter(Boolean),
    status: 'active'
  }).select().single()

  if (prodError) throw new Error(prodError.message)

  // Insert all child color variants securely
  const variantsToInsert = draft.colors.map((color, idx) => ({
    product_id: prodData.id,
    sku: `${slug.substring(0,3).toUpperCase()}-${color.substring(0,3).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
    color: color,
    price: draft.pricePerMeter,
    stock_quantity: 50,
    images: imagePreview ? [imagePreview] : []
  }))

  if (variantsToInsert.length > 0) {
    const { error: variantError } = await supabase.from('product_variants').insert(variantsToInsert)
    if (variantError) throw new Error(variantError.message)
  }

  revalidatePath('/admin')
  revalidatePath('/shop')
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
