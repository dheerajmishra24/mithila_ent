'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import React from 'react'
import { Resend } from 'resend'
import { render } from '@react-email/components'
import { OrderConfirmationEmail } from '@/components/emails/OrderConfirmationEmail'
import { generateInvoiceBuffer } from '@/utils/pdf/generateInvoice'

export async function updateOrderStatus(orderId: string, status: string, trackingNumber?: string) {
  const supabase = await createClient()

  // Verify Admin
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) throw new Error('Unauthorized')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')

  const updateData: any = { status }
  if (trackingNumber) {
    updateData.tracking_status = trackingNumber
  }

  const { error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/orders')
  revalidatePath('/account/orders')
  return { success: true }
}

export async function createOrder(cartItems: any[], shippingAddress: any, discountCode?: string, idempotencyKey?: string) {
  const supabase = await createClient()

  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) {
    return { success: false, error: 'Please sign in to complete your order.' }
  }

  // Normalize cart items. The Zustand cart stores the variant id as `id`
  // (see src/store/useCart.ts), so accept either `variant_id` or `id`.
  const items = (cartItems || [])
    .map((item) => ({
      variant_id: item?.variant_id ?? item?.id,
      quantity: Number(item?.quantity) || 0,
    }))
    .filter((item) => item.variant_id && item.quantity > 0)

  if (items.length === 0) {
    return { success: false, error: 'Your cart is empty.' }
  }

  // Create the order atomically on the DB: prices are read server-side, stock
  // rows are locked FOR UPDATE, and the whole thing is one transaction that
  // rolls back on any failure. See supabase/migrations/0007_create_order_atomic.sql.
  const { data: orderId, error } = await supabase.rpc('create_order_atomic', {
    p_items: items,
    p_shipping: shippingAddress ?? {},
    p_discount_code: discountCode && discountCode.trim() ? discountCode.trim() : null,
    p_idempotency_key: idempotencyKey || null,
  })

  if (error || !orderId) {
    const msg = error?.message || ''
    if (msg.includes('INSUFFICIENT_STOCK')) {
      return { success: false, error: 'Sorry, one or more items just went out of stock.' }
    }
    if (msg.includes('VARIANT_NOT_FOUND')) {
      return { success: false, error: 'One or more items in your cart are no longer available.' }
    }
    if (msg.includes('AUTH_REQUIRED')) {
      return { success: false, error: 'Please sign in to complete your order.' }
    }
    if (msg.includes('EMPTY_CART')) {
      return { success: false, error: 'Your cart is empty.' }
    }
    if (msg.includes('INVALID_DISCOUNT')) {
      return { success: false, error: 'That discount code is not valid or has expired.' }
    }
    console.error('createOrder failed:', error)
    return { success: false, error: 'We could not process your order. Please try again.' }
  }

  const orderIdStr = String(orderId)

  // Record a payment intent so every order has an entry in the payment log.
  const { error: piErr } = await supabase.rpc('log_payment_intent', { p_order_id: orderIdStr })
  if (piErr) console.error('log_payment_intent failed:', piErr)

  // Generate and dispatch the invoice email (best-effort; never blocks the order).
  try {
    const { data: fullOrder } = await supabase
      .from('orders')
      .select('*, order_items(*, product_variants(color, products(title)))')
      .eq('id', orderIdStr)
      .single()

    if (fullOrder && userData.user.email) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const pdfBuffer = await generateInvoiceBuffer(fullOrder, fullOrder.order_items)
      const customerName =
        shippingAddress?.fullName ||
        [shippingAddress?.firstName, shippingAddress?.lastName].filter(Boolean).join(' ') ||
        'Customer'

      const emailHtml = await render(
        React.createElement(OrderConfirmationEmail, {
          orderId: orderIdStr,
          customerName: customerName,
          totalAmount: Number(fullOrder.total_amount),
        })
      )

      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'Mithila Enterprises <onboarding@resend.dev>',
        to: [userData.user.email],
        subject: 'Order Confirmation & Official Invoice',
        html: emailHtml,
        attachments: [
          {
            filename: `Invoice_${orderIdStr.split('-')[0].toUpperCase()}.pdf`,
            content: pdfBuffer,
          },
        ],
      })
    }
  } catch (emailErr) {
    console.error('Failed to send invoice email:', emailErr)
    // We do not throw to prevent crashing the order checkout flow
  }

  revalidatePath('/account/orders')
  revalidatePath('/admin/orders')
  return { success: true, orderId: orderIdStr }
}


export async function previewDiscount(code: string, subtotal: number) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('validate_discount', {
    p_code: code || '',
    p_subtotal: subtotal,
  })

  if (error || !data) {
    return { valid: false as const, error: 'Could not validate code.' }
  }

  const res = data as any
  if (!res.valid) {
    return { valid: false as const, error: res.error || 'Invalid code.' }
  }

  let label = ''
  if (res.type === 'percentage') label = `${Number(res.value)}% off`
  else if (res.type === 'fixed_amount') label = `₹${Number(res.value)} off`
  else if (res.type === 'free_shipping') label = 'Free shipping'

  return {
    valid: true as const,
    code: String(res.code),
    type: String(res.type),
    discountAmount: Number(res.discountAmount),
    label,
  }
}


export async function requestCancellation(orderId: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) return { success: false, error: 'Please sign in.' }

  const { data, error } = await supabase.rpc('request_order_cancellation', { p_order_id: orderId })
  const res = data as any
  if (error || !res?.ok) {
    const code = res?.error || error?.message || ''
    if (code.includes('NOT_CANCELLABLE')) {
      return { success: false, error: 'This order can no longer be cancelled.' }
    }
    return { success: false, error: 'Could not request cancellation.' }
  }

  revalidatePath('/account/orders')
  revalidatePath('/admin/orders')
  return { success: true }
}

export async function cancelOrder(orderId: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) throw new Error('Unauthorized')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')

  const { data, error } = await supabase.rpc('cancel_order_restock', { p_order_id: orderId })
  if (error || !(data as any)?.ok) throw new Error('Failed to cancel order')

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/account/orders')
  return { success: true }
}
