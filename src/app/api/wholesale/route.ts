import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { sendWhatsAppNotification } from '@/lib/whatsapp';
import { checkApiRateLimit, clientIp } from '@/lib/ratelimit';
import { isLikelyBot } from '@/lib/bot-check';
import { LIMITS, cleanEmail, cleanText, escapeHtml, optionalText } from '@/lib/form-input';
import { captureLead } from '@/lib/leads/capture';
import { normalisePhone } from '@/lib/leads/parse';
import { webFormLeadFields } from '@/lib/leads/web-form';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_build_only');
const FROM = process.env.EMAIL_FROM || 'Mithila Enterprises <onboarding@resend.dev>';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'mithlaenterprises11@gmail.com';
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP || '+910000000000'; // Replace with real admin number

// SEC-06: public form. Rate limited per IP, every field length-capped and
// validated, every value HTML-escaped before it goes into the owner e-mail.
export async function POST(req: Request) {
  try {
    if (!(await checkApiRateLimit(`wholesale:${clientIp(req)}`))) {
      return NextResponse.json({ error: 'Too many requests. Please try again in a minute.' }, { status: 429 });
    }
    if (await isLikelyBot()) {
      return NextResponse.json({ error: 'Your request could not be verified. Please reload the page and try again.' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const businessName = cleanText(body?.businessName, LIMITS.businessName);
    const email = cleanEmail(body?.email);
    const requirements = cleanText(body?.requirements, LIMITS.message, true);
    const taxId = optionalText(body?.taxId, LIMITS.taxId);
    const phone = optionalText(body?.phone, LIMITS.phone);
    const category = optionalText(body?.category, LIMITS.category);

    if (!businessName || !email || !requirements || taxId === null || phone === null || category === null) {
      return NextResponse.json({ error: 'Please check the form: a field is missing, invalid or too long.' }, { status: 400 });
    }

    // 1. Into the lead pipeline (deduplicated by e-mail / phone; idempotent per submission)
    const saved = await captureLead({
      source: 'wholesale',
      ...webFormLeadFields(req, body),
      company: businessName,
      email,
      phone: phone ? normalisePhone(phone) : null,
      message: requirements,
      detail: { form: 'wholesale', gstin: taxId ?? null, category: category ?? null, phone_as_typed: phone ?? null },
    });
    if (!saved.ok) {
      console.error('Failed to save wholesale application:', saved.error);
      return NextResponse.json({ error: 'Failed to save application' }, { status: 500 });
    }
    if (saved.duplicate) return NextResponse.json({ success: true });

    // 2. Send Email via Resend (all user values escaped)
    const h = {
      businessName: escapeHtml(businessName),
      taxId: escapeHtml(taxId ?? 'N/A'),
      email: escapeHtml(email),
      phone: escapeHtml(phone ?? 'N/A'),
      category: escapeHtml(category ?? 'N/A'),
      requirements: escapeHtml(requirements),
    };
    try {
      await resend.emails.send({
        from: FROM,
        to: SUPPORT_EMAIL,
        replyTo: email,
        subject: `New Wholesale Application: ${businessName}`.slice(0, 150),
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>New Wholesale B2B Application</h2>
            <p><strong>Business Name:</strong> ${h.businessName}</p>
            <p><strong>Tax ID / GST:</strong> ${h.taxId}</p>
            <p><strong>Email:</strong> ${h.email}</p>
            <p><strong>Phone:</strong> ${h.phone}</p>
            <p><strong>Category:</strong> ${h.category}</p>
            <hr />
            <p><strong>Requirements &amp; Volume:</strong></p>
            <p style="white-space: pre-wrap;">${h.requirements}</p>
            <hr />
            <p>Log in to the Admin Dashboard to review.</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Failed to send wholesale email:', emailError instanceof Error ? emailError.message : emailError);
    }

    // 3. Send WhatsApp Notification (plain text)
    await sendWhatsAppNotification(
      ADMIN_WHATSAPP,
      `Wholesale App Alert!\n\nBusiness: ${businessName}\nEmail: ${email}\n\nLogin to dashboard to review.`
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Wholesale API Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
