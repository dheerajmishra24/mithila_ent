import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { sendWhatsAppNotification } from '@/lib/whatsapp';
import { checkApiRateLimit, clientIp } from '@/lib/ratelimit';
import { isLikelyBot } from '@/lib/bot-check';
import { LIMITS, cleanEmail, cleanText, escapeHtml, optionalText } from '@/lib/form-input';
import { captureLead } from '@/lib/leads/capture';
import { webFormLeadFields } from '@/lib/leads/web-form';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_build_only');
const FROM = process.env.EMAIL_FROM || 'Mithila Enterprises <onboarding@resend.dev>';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'mithlaenterprises11@gmail.com';
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP || '+910000000000'; // Replace with real admin number

// SEC-06: public form. Rate limited per IP, every field length-capped and
// validated, every value HTML-escaped before it goes into the owner e-mail.
export async function POST(req: Request) {
  try {
    if (!(await checkApiRateLimit(`contact:${clientIp(req)}`))) {
      return NextResponse.json({ error: 'Too many requests. Please try again in a minute.' }, { status: 429 });
    }
    if (await isLikelyBot()) {
      return NextResponse.json({ error: 'Your request could not be verified. Please reload the page and try again.' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const firstName = cleanText(body?.firstName, LIMITS.name);
    const lastName = cleanText(body?.lastName, LIMITS.name);
    const email = cleanEmail(body?.email);
    const location = optionalText(body?.location, LIMITS.location);
    const message = cleanText(body?.message, LIMITS.message, true);

    if (!firstName || !lastName || !email || !message || location === null) {
      return NextResponse.json({ error: 'Please check the form: a field is missing, invalid or too long.' }, { status: 400 });
    }

    // 1. Into the lead pipeline (deduplicated by e-mail; idempotent per submission)
    const saved = await captureLead({
      source: 'contact',
      ...webFormLeadFields(req, body),
      full_name: `${firstName} ${lastName}`,
      email,
      city: location ?? null,
      message,
      detail: { form: 'contact', first_name: firstName, last_name: lastName },
    });
    if (!saved.ok) {
      console.error('Failed to save contact inquiry:', saved.error);
      return NextResponse.json({ error: 'Failed to save inquiry' }, { status: 500 });
    }
    if (saved.duplicate) return NextResponse.json({ success: true });

    // 2. Send Email via Resend (all user values escaped)
    const h = {
      name: escapeHtml(`${firstName} ${lastName}`),
      email: escapeHtml(email),
      location: escapeHtml(location ?? 'N/A'),
      message: escapeHtml(message),
    };
    try {
      await resend.emails.send({
        from: FROM,
        to: SUPPORT_EMAIL,
        replyTo: email,
        subject: `New Contact Inquiry from ${firstName} ${lastName}`.slice(0, 150),
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>New Contact Inquiry</h2>
            <p><strong>Name:</strong> ${h.name}</p>
            <p><strong>Email:</strong> ${h.email}</p>
            <p><strong>Location:</strong> ${h.location}</p>
            <hr />
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap;">${h.message}</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Failed to send contact email:', emailError instanceof Error ? emailError.message : emailError);
      // The inquiry is saved, so an e-mail failure does not fail the request.
    }

    // 3. Send WhatsApp Notification (plain text)
    await sendWhatsAppNotification(
      ADMIN_WHATSAPP,
      `New Contact Inquiry!\n\nName: ${firstName} ${lastName}\nEmail: ${email}\n\nMessage: ${message.substring(0, 100)}...`
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Contact API Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
