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

export async function createOrder(cartItems: any[], shippingAddress: any) {
  const supabase = await createClient()
  
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) throw new Error('Must be logged in to create an order')

  let subtotal = 0

  // 1. Transaction Concept: Verify stock and calculate total securely on the server
  for (const item of cartItems) {
    const { data: variant, error } = await supabase
      .from('product_variants')
      .select('price, stock_quantity')
      .eq('id', item.variant_id)
      .single()
      
    if (error || !variant) throw new Error('Variant not found')
    if (variant.stock_quantity < item.quantity) throw new Error(`Insufficient stock for variant ${item.variant_id}`)
    
    subtotal += variant.price * item.quantity
  }
  
  const tax = subtotal * 0.1
  const shipping = 50
  const total = subtotal + tax + shipping

  // 2. Create the Order Record
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      user_id: userData.user.id,
      status: 'pending',
      subtotal,
      tax_amount: tax,
      shipping_amount: shipping,
      total_amount: total,
      shipping_address: shippingAddress
    }).select().single()

  if (orderErr) throw new Error(orderErr.message)

  // 3. Insert Order Items AND Deduct Inventory (Zero-Trust Transaction)
  for (const item of cartItems) {
    const { data: variant } = await supabase
      .from('product_variants')
      .select('price, stock_quantity')
      .eq('id', item.variant_id)
      .single()

    if (variant) {
      // Deduct inventory
      await supabase.from('product_variants')
        .update({ stock_quantity: variant.stock_quantity - item.quantity })
        .eq('id', item.variant_id)
        
      // Insert item
      await supabase.from('order_items')
        .insert({
          order_id: order.id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: variant.price
        })
    }
  }
  
  // 4. Generate and Dispatch Invoice Email
  try {
    const { data: fullOrder } = await supabase
      .from('orders')
      .select('*, order_items(*, product_variants(color, products(title)))')
      .eq('id', order.id)
      .single()

    if (fullOrder && userData.user.email) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const pdfBuffer = await generateInvoiceBuffer(fullOrder, fullOrder.order_items)
      const customerName = shippingAddress?.fullName || 'Customer'
      
      const emailHtml = await render(
        React.createElement(OrderConfirmationEmail, {
          orderId: order.id,
          customerName: customerName,
          totalAmount: total
        })
      )

      await resend.emails.send({
        from: 'Mithila Enterprises <onboarding@resend.dev>',
        to: [userData.user.email],
        subject: 'Order Confirmation & Official Invoice',
        html: emailHtml,
        attachments: [
          {
            filename: `Invoice_${order.id.split('-')[0].toUpperCase()}.pdf`,
            content: pdfBuffer,
          }
        ]
      })
    }
  } catch (emailErr) {
    console.error('Failed to send invoice email:', emailErr)
    // We do not throw to prevent crashing the order checkout flow
  }
  
  revalidatePath('/account/orders')
  revalidatePath('/admin/orders')
  return { success: true, orderId: order.id }
}
