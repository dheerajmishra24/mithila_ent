import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_build_only');
const FROM = process.env.EMAIL_FROM || 'Mithila Enterprises <onboarding@resend.dev>';

export async function sendSecurityAlertEmail(email: string) {
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Security Alert: Multiple Failed Login Attempts',
      html: `
        <div style="font-family: sans-serif; color: #333; padding: 20px;">
          <h2 style="color: #990000;">Security Alert</h2>
          <p>We detected 5 consecutive failed login attempts on your account.</p>
          <p>For your protection, your account has been temporarily locked for 15 minutes.</p>
          <p>If this was not you, please reset your password immediately or contact support.</p>
        </div>
      `
    });
  } catch (error) {
    console.error('Failed to send security email', error);
  }
}

export async function sendInvoiceEmail(
  email: string, 
  shippingDetails: any, 
  cartItems: any[], 
  subtotal: number, 
  taxAmount: number, 
  total: number,
  paymentId: string
) {
  try {
    // Premium Formal Invoice HTML
    const itemsHtml = cartItems.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.title} (${item.color})</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${item.price.toFixed(2)}</td>
      </tr>
    `).join('');

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Order Confirmation - Mithila Enterprises (${paymentId})`,
      html: `
        <div style="font-family: serif; color: #1a1a1a; padding: 40px; max-width: 600px; margin: 0 auto; background-color: #fcfcfc; border: 1px solid #eee;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="font-style: italic; color: #0f172a; margin: 0;">Mithila Enterprises</h1>
            <p style="font-family: sans-serif; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; margin-top: 5px; color: #64748b;">Premium Textile Registry</p>
          </div>
          
          <p style="font-family: sans-serif; font-size: 14px;">Dear ${shippingDetails.firstName},</p>
          <p style="font-family: sans-serif; font-size: 14px;">Your procurement order has been formally registered and payment was successful.</p>
          
          <h3 style="font-family: sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #0f172a; padding-bottom: 5px; margin-top: 40px;">Invoice Details</h3>
          <p style="font-family: sans-serif; font-size: 12px;"><strong>Transaction ID:</strong> ${paymentId}</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-family: sans-serif; font-size: 13px;">
            <thead>
              <tr>
                <th style="text-align: left; padding: 8px; border-bottom: 2px solid #333;">Textile</th>
                <th style="text-align: center; padding: 8px; border-bottom: 2px solid #333;">Qty</th>
                <th style="text-align: right; padding: 8px; border-bottom: 2px solid #333;">Unit Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div style="margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; font-family: sans-serif; font-size: 13px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span>Subtotal:</span>
              <span style="float: right;">₹${subtotal.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span>Tax (18% GST):</span>
              <span style="float: right;">₹${taxAmount.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; margin-top: 15px; border-top: 2px solid #333; padding-top: 15px;">
              <span>Total Paid:</span>
              <span style="float: right;">₹${total.toFixed(2)}</span>
            </div>
          </div>
          
          <div style="margin-top: 60px; text-align: center; font-family: sans-serif; font-size: 11px; color: #64748b;">
            <p>Shipping to: ${shippingDetails.address1}, ${shippingDetails.city}, ${shippingDetails.state} ${shippingDetails.pinCode}</p>
            <p>Thank you for choosing Mithila Enterprises.</p>
          </div>
        </div>
      `
    });
    console.log('Invoice email dispatched successfully');
  } catch (error) {
    console.error('Failed to send invoice email', error);
  }
}
