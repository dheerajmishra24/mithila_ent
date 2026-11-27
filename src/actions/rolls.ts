'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/dal/session'
import { plainText, uuid } from '@/lib/validation/common'

// Roll inventory (migration 0050). Every action checks requireAdmin(), parses
// its input with Zod, then calls a service_role-only database function that
// locks the variant and roll rows and writes a roll_events audit row.

export type RollActionState = { ok?: string; error?: string } | undefined

const metres = z.coerce.number().finite().gt(0).max(10_000)
  .refine((n) => Math.round(n * 100) === n * 100, 'Use at most two decimals')
const metresOrZero = z.coerce.number().finite().min(0).max(10_000)
  .refine((n) => Math.round(n * 100) === n * 100, 'Use at most two decimals')
const dyeLot = plainText(40, { min: 1 })
const note = plainText(200).optional()

const ERRORS: Record<string, string> = {
  INVALID_LENGTH: 'Enter a length between 0.01 m and 10,000 m.',
  EXCEEDS_ROLL_LENGTH: 'The remaining length cannot be more than the roll was received at.',
  VARIANT_NOT_FOUND: 'That variant no longer exists.',
  NOT_METRE_PRODUCT: 'This product is sold by the piece. Use stock adjustment instead.',
  ROLL_NOT_FOUND: 'That roll no longer exists.',
  ROLL_HAS_OPEN_CUTS: 'Cuts are still allocated to this roll. Cut or release them first.',
  CUT_NOT_FOUND: 'That cut no longer exists.',
  CUT_RELEASED: 'That cut was released (order cancelled), so there is nothing to cut.',
  ORDER_NOT_PAID: 'Only paid orders can be cut.',
}

function friendly(message: string): string {
  const code = Object.keys(ERRORS).find((k) => message.includes(k))
  return code ? ERRORS[code] : 'Something went wrong. Please try again.'
}

function fail(e: unknown): RollActionState {
  if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? 'Invalid input' }
  return { error: 'Something went wrong. Please try again.' }
}

export async function receiveRoll(_prev: RollActionState, form: FormData): Promise<RollActionState> {
  const me = await requireAdmin()
  try {
    const input = z.object({ variantId: uuid, totalM: metres, dyeLot, shade: note })
      .parse({
        variantId: form.get('variantId'),
        totalM: form.get('totalM'),
        dyeLot: form.get('dyeLot'),
        shade: form.get('shade') || undefined,
      })
    const { error } = await createAdminClient().rpc('admin_receive_roll', {
      p_variant_id: input.variantId,
      p_total_m: input.totalM,
      p_dye_lot: input.dyeLot,
      p_shade_note: input.shade ?? null,
      p_actor: me.id,
    })
    if (error) {
      console.warn('admin_receive_roll failed:', error.code)
      return { error: friendly(error.message) }
    }
    revalidatePath(`/admin/inventory/${input.variantId}`)
    revalidatePath('/admin/inventory')
    return { ok: `Received ${input.totalM} m, dye lot ${input.dyeLot.toUpperCase()}.` }
  } catch (e) {
    return fail(e)
  }
}

export async function setRollRemaining(_prev: RollActionState, form: FormData): Promise<RollActionState> {
  const me = await requireAdmin()
  try {
    const input = z.object({ variantId: uuid, rollId: uuid, remainingM: metresOrZero, note })
      .parse({
        variantId: form.get('variantId'),
        rollId: form.get('rollId'),
        remainingM: form.get('remainingM'),
        note: form.get('note') || undefined,
      })
    const { error } = await createAdminClient().rpc('admin_set_roll_remaining', {
      p_roll_id: input.rollId,
      p_remaining_m: input.remainingM,
      p_note: input.note ?? null,
      p_actor: me.id,
    })
    if (error) {
      console.warn('admin_set_roll_remaining failed:', error.code)
      return { error: friendly(error.message) }
    }
    revalidatePath(`/admin/inventory/${input.variantId}`)
    revalidatePath('/admin/inventory')
    return { ok: `Stocktake saved: ${input.remainingM} m on the roll.` }
  } catch (e) {
    return fail(e)
  }
}

export async function retireRoll(_prev: RollActionState, form: FormData): Promise<RollActionState> {
  const me = await requireAdmin()
  try {
    const input = z.object({ variantId: uuid, rollId: uuid, note })
      .parse({ variantId: form.get('variantId'), rollId: form.get('rollId'), note: form.get('note') || undefined })
    const { error } = await createAdminClient().rpc('admin_retire_roll', {
      p_roll_id: input.rollId,
      p_note: input.note ?? null,
      p_actor: me.id,
    })
    if (error) {
      console.warn('admin_retire_roll failed:', error.code)
      return { error: friendly(error.message) }
    }
    revalidatePath(`/admin/inventory/${input.variantId}`)
    revalidatePath('/admin/inventory')
    return { ok: 'Roll retired.' }
  } catch (e) {
    return fail(e)
  }
}

export async function markCut(_prev: RollActionState, form: FormData): Promise<RollActionState> {
  const me = await requireAdmin()
  try {
    const cutId = uuid.parse(form.get('cutId'))
    const { error } = await createAdminClient().rpc('mark_order_item_cut', { p_cut_id: cutId, p_actor: me.id })
    if (error) {
      console.warn('mark_order_item_cut failed:', error.code)
      return { error: friendly(error.message) }
    }
    revalidatePath('/admin/cut-sheet')
    return { ok: 'Marked as cut.' }
  } catch (e) {
    return fail(e)
  }
}
