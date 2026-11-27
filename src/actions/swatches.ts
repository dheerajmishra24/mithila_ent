'use server'

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, requireUser } from '@/lib/dal/session'
import { checkApiRateLimit } from '@/lib/ratelimit'
import { enqueueOrderEmail, processEmailRow } from '@/lib/email'
import { plainText, uuid } from '@/lib/validation/common'
import { addressSchema, idempotencyKeySchema } from '@/lib/validation/customer'

// Swatch kits and swatch credit (migration 0052). Customers place a kit
// through create_swatch_order; the owner adjusts balances and kit settings.
// All money logic runs in service_role-only database functions.

const ORDER_ERRORS: Record<string, string> = {
  SWATCHES_DISABLED: 'Swatch kits are not available right now.',
  EMPTY_SWATCH_KIT: 'Choose at least one fabric for your swatch kit.',
  INVALID_SWATCH_KIT: 'Your swatch kit has too many or repeated fabrics.',
  VARIANT_NOT_FOUND: 'One of the fabrics in your kit is no longer available.',
  INVALID_STATE: 'Please choose your state.',
  INVALID_GSTIN: 'Please enter a valid GSTIN, or leave it blank.',
  TOO_MANY_PENDING_ORDERS: 'You already have several unpaid orders. Unpaid orders are cancelled after an hour, so please try again then.',
  TOO_MANY_UNPAID_ORDERS: 'Several of your recent orders were not paid, so new orders are paused for now. Please try again later or contact us.',
  AUTH_REQUIRED: 'Please sign in to order swatches.',
}

const kitSchema = z.array(uuid).min(1).max(20)

export async function createSwatchOrder(variantIdsInput: unknown, shippingInput: unknown, idempotencyKeyInput?: unknown) {
  let user
  try {
    user = await requireUser()
  } catch {
    return { success: false as const, error: 'Please sign in to order swatches.' }
  }
  if (!(await checkApiRateLimit(`create-order:${user.id}`))) {
    return { success: false as const, error: 'Too many order attempts. Please wait a minute and try again.' }
  }

  const ids = kitSchema.safeParse(variantIdsInput)
  if (!ids.success) return { success: false as const, error: ORDER_ERRORS.EMPTY_SWATCH_KIT }
  const address = addressSchema.safeParse(shippingInput)
  if (!address.success) {
    const field = String(address.error.issues[0]?.path[0])
    const messages: Record<string, string> = {
      pinCode: 'Please enter a valid 6-digit PIN code.',
      state: 'Please choose your state.',
      gstin: 'Please enter a valid GSTIN, or leave it blank.',
    }
    return { success: false as const, error: messages[field] ?? 'Please check your shipping address.' }
  }
  const idempotencyKey = idempotencyKeySchema.safeParse(idempotencyKeyInput).data ?? null

  const admin = createAdminClient()
  const { data: orderId, error } = await admin.rpc('create_swatch_order', {
    p_user_id: user.id,
    p_variant_ids: ids.data,
    p_shipping: address.data,
    p_idempotency_key: idempotencyKey,
  })
  if (error || !orderId) {
    const msg = error?.message ?? ''
    const code = Object.keys(ORDER_ERRORS).find((k) => msg.includes(k))
    if (!code) console.error('createSwatchOrder failed:', error)
    return { success: false as const, error: code ? ORDER_ERRORS[code] : 'We could not place your swatch order. Please try again.' }
  }
  const id = String(orderId)

  const supabase = await createClient()
  const { error: piErr } = await supabase.rpc('log_payment_intent', { p_order_id: id })
  if (piErr) console.error('log_payment_intent failed:', piErr)

  try {
    if (user.email) {
      const customerName = [address.data.firstName, address.data.lastName].filter(Boolean).join(' ') || 'Customer'
      const row = await enqueueOrderEmail(admin, { orderId: id, recipient: user.email, kind: 'order_confirmation', payload: { customerName } })
      if (row) {
        try {
          await processEmailRow(admin, row)
        } catch (sendErr) {
          console.error('inline swatch confirmation send failed (will retry via cron):', sendErr)
        }
      }
    }
  } catch (emailErr) {
    console.error('Failed to queue swatch order email:', emailErr)
  }

  revalidatePath('/account/orders')
  revalidatePath('/admin/orders')
  return { success: true as const, orderId: id }
}

/** Balance shown at checkout. Customers read their own row only (RLS). */
export async function mySwatchCreditBalance(): Promise<number> {
  let user
  try {
    user = await requireUser()
  } catch {
    return 0
  }
  const supabase = await createClient()
  const { data } = await supabase.from('swatch_credit_accounts').select('balance').eq('user_id', user.id).maybeSingle()
  return Number(data?.balance ?? 0)
}

// ---- Owner tools -------------------------------------------------------------

export type SwatchAdminState = { ok?: string; error?: string } | undefined

const ADMIN_ERRORS: Record<string, string> = {
  INSUFFICIENT_CREDIT: 'That would take the balance below zero.',
  INVALID_AMOUNT: 'Enter a non-zero amount up to ₹1,00,000.',
  NOTE_REQUIRED: 'Add a short reason (at least 3 characters).',
  USER_NOT_FOUND: 'That customer no longer exists.',
}

const adjustSchema = z.object({
  userId: uuid,
  amount: z.coerce.number().finite().refine((n) => n !== 0 && Math.abs(n) <= 100000, 'Enter a non-zero amount up to ₹1,00,000.')
    .refine((n) => Math.round(n * 100) === n * 100, 'Use at most two decimals.'),
  note: plainText(200, { min: 3 }),
})

export async function adjustSwatchCredit(_prev: SwatchAdminState, form: FormData): Promise<SwatchAdminState> {
  let me
  try {
    me = await requireAdmin()
  } catch {
    return { error: 'Not authorised.' }
  }
  const parsed = adjustSchema.safeParse({ userId: form.get('userId'), amount: form.get('amount'), note: form.get('note') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { error } = await createAdminClient().rpc('admin_adjust_swatch_credit', {
    p_user_id: parsed.data.userId,
    p_amount: parsed.data.amount,
    p_note: parsed.data.note,
    p_actor: me.id,
    p_key: crypto.randomUUID(),
  })
  if (error) {
    const code = Object.keys(ADMIN_ERRORS).find((k) => error.message.includes(k))
    if (!code) console.error('adjustSwatchCredit failed:', error)
    return { error: code ? ADMIN_ERRORS[code] : 'Something went wrong. Please try again.' }
  }
  revalidatePath('/admin/customers')
  return { ok: `Credit ${parsed.data.amount > 0 ? 'added' : 'removed'}: ₹${Math.abs(parsed.data.amount).toFixed(2)}` }
}

const settingsSchema = z.object({
  enabled: z.boolean(),
  kitPrice: z.coerce.number().finite().min(1).max(10000)
    .refine((n) => Math.round(n * 100) === n * 100, 'Use at most two decimals.'),
  maxSwatches: z.coerce.number().int().min(1).max(20),
})

export async function updateSwatchSettings(_prev: SwatchAdminState, form: FormData): Promise<SwatchAdminState> {
  try {
    await requireAdmin()
  } catch {
    return { error: 'Not authorised.' }
  }
  const parsed = settingsSchema.safeParse({
    enabled: form.get('enabled') === 'on',
    kitPrice: form.get('kitPrice'),
    maxSwatches: form.get('maxSwatches'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const { error } = await createAdminClient()
    .from('swatch_settings')
    .update({ enabled: parsed.data.enabled, kit_price: parsed.data.kitPrice, max_swatches: parsed.data.maxSwatches, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) {
    console.error('updateSwatchSettings failed:', error)
    return { error: 'Could not save the swatch settings.' }
  }
  revalidatePath('/admin/settings')
  revalidatePath('/swatches')
  return { ok: 'Swatch settings saved.' }
}
