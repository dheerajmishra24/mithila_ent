import { Resend } from 'resend';
import React from 'react';
import { render } from '@react-email/components';
import { OrderConfirmationEmail } from '@/components/emails/OrderConfirmationEmail';
import { generateInvoiceBuffer } from '@/utils/pdf/generateInvoice';
import { invoiceContext } from '@/lib/invoice-context';
import type { SupabaseClient } from '@supabase/supabase-js';
import { escapeHtml } from '@/lib/form-input';

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

/**
 * Tells an owner-portal account that its two-step sign-in changed (a method
 * added or removed), so a change they did not make is noticed. `what` is
 * fixed text chosen by the caller, never user input.
 */
export async function sendTwoStepNoticeEmail(email: string, what: string) {
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Security notice: owner portal sign-in changed',
      html: `
        <div style="font-family: sans-serif; color: #333; padding: 20px;">
          <h2 style="color: #990000;">Owner portal sign-in changed</h2>
          <p>${escapeHtml(what)}</p>
          <p>If this was not you, change your password now and contact your developer to remove the method.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('Failed to send two-step notice email', error);
  }
}

/**
 * Operational alert to the owner inbox (SUPPORT_EMAIL), e.g. "Meta lead
 * access stopped working". Text is fixed by the caller, never user input.
 */
export async function sendOwnerAlertEmail(subject: string, lines: string[]) {
  const to = process.env.SUPPORT_EMAIL;
  if (!to) return;
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: subject.slice(0, 150),
      html: `
        <div style="font-family: sans-serif; color: #333; padding: 20px;">
          <h2 style="color: #990000;">${escapeHtml(subject)}</h2>
          ${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}
        </div>
      `,
    });
  } catch (error) {
    console.error('Failed to send owner alert email', error);
  }
}

// ---------------------------------------------------------------------------
// Durable email queue (pending_emails) — confirmation/invoice + status emails.
// Enqueue a job, then send it best-effort inline; the cron worker retries any
// job left pending with exponential backoff. See supabase/migrations/0020.
// ---------------------------------------------------------------------------

export type EmailKind = 'order_confirmation' | 'order_shipped' | 'order_delivered' | 'order_cancelled';

const MAX_BATCH = 25;

export async function enqueueOrderEmail(
  admin: SupabaseClient,
  args: { orderId: string; recipient: string; kind: EmailKind; payload?: Record<string, any> }
) {
  const { data, error } = await admin
    .from('pending_emails')
    .insert({
      order_id: args.orderId,
      recipient: args.recipient,
      kind: args.kind,
      payload: args.payload ?? {},
    })
    .select('*')
    .single();
  if (error) {
    console.error('enqueueOrderEmail failed:', error);
    return null;
  }
  return data as any;
}

type Built = { subject: string; html: string; attachments?: { filename: string; content: Buffer }[] };

async function buildEmail(admin: SupabaseClient, row: any): Promise<Built | null> {
  const { data: order } = await admin
    .from('orders')
    .select('*, order_items(*, product_variants(color, products(title)))')
    .eq('id', row.order_id)
    .single();
  if (!order) return null;

  const payload = row.payload || {};
  const addr: any = order.shipping_address || {};
  const shortId = String(order.id).split('-')[0].toUpperCase();
  const customerName =
    payload.customerName ||
    [addr.firstName, addr.lastName].filter(Boolean).join(' ') ||
    addr.fullName ||
    'Customer';

  if (row.kind === 'order_confirmation') {
    const html = await render(
      React.createElement(OrderConfirmationEmail, {
        orderId: String(order.id),
        customerName,
        totalAmount: Number(order.total_amount),
      })
    );
    const pdf = await generateInvoiceBuffer(order, order.order_items || [], await invoiceContext(order.user_id));
    return {
      subject: 'Order Confirmation & Official Invoice',
      html,
      attachments: [{ filename: `Invoice_${shortId}.pdf`, content: pdf }],
    };
  }

  const status =
    row.kind === 'order_shipped' ? 'shipped' : row.kind === 'order_delivered' ? 'delivered' : 'cancelled';
  const heading =
    status === 'shipped'
      ? 'Your order is on its way'
      : status === 'delivered'
        ? 'Your order has been delivered'
        : 'Your order has been cancelled';
  const tracking =
    status === 'shipped' && order.tracking_status
      ? `<p style="margin:8px 0">Tracking reference: <strong>${escapeHtml(String(order.tracking_status))}</strong></p>`
      : '';
  const refundNote =
    status === 'cancelled' ? '<p style="margin:8px 0">Any amount paid will be refunded per our policy.</p>' : '';
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#2A2A2A;line-height:1.5">
    <h2 style="color:#8B2E2E;margin:0 0 4px">Mithila Enterprises</h2>
    <h3 style="margin:0 0 16px">${heading}</h3>
    <p style="margin:8px 0">Dear ${escapeHtml(String(customerName))},</p>
    <p style="margin:8px 0">Your order <strong>#${shortId}</strong> is now <strong>${status}</strong>.</p>
    ${tracking}${refundNote}
    <p style="margin:16px 0 0">Thank you for shopping with us.</p>
  </body></html>`;
  const subject =
    status === 'shipped'
      ? `Your order #${shortId} has shipped`
      : status === 'delivered'
        ? `Your order #${shortId} was delivered`
        : `Your order #${shortId} was cancelled`;
  return { subject, html };
}

function backoffISO(attempts: number): string {
  const minutes = Math.min(Math.pow(2, attempts), 60); // 2, 4, 8, 16, 32, 60...
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

// Atomically claim a job (so inline + cron can't double-send), build, send, and
// either mark sent or schedule a backed-off retry. Returns the outcome.
export async function processEmailRow(
  admin: SupabaseClient,
  row: any
): Promise<'sent' | 'skipped' | 'retry' | 'failed'> {
  const { data: claimed } = await admin
    .from('pending_emails')
    .update({ status: 'sending', attempts: (row.attempts || 0) + 1 })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('id, attempts, max_attempts')
    .single();
  if (!claimed) return 'skipped'; // another worker already took it

  try {
    if (!row.recipient) throw new Error('NO_RECIPIENT');
    // Hard bounce or spam complaint reported by Resend (migration 0055):
    // stop here, without retries, so the sending domain's reputation holds.
    const { data: held } = await admin
      .from('email_suppressions')
      .select('reason')
      .eq('email', String(row.recipient).trim().toLowerCase())
      .maybeSingle();
    if (held) {
      await admin
        .from('pending_emails')
        .update({ status: 'failed', last_error: `Not sent: address on hold (${held.reason})` })
        .eq('id', row.id);
      return 'failed';
    }
    const built = await buildEmail(admin, row);
    if (!built) throw new Error('ORDER_NOT_FOUND');

    const sendRes: any = await resend.emails.send({
      from: FROM,
      to: [row.recipient],
      subject: built.subject,
      html: built.html,
      attachments: built.attachments,
    });
    if (sendRes?.error) throw new Error(sendRes.error?.message || 'RESEND_ERROR');

    await admin
      .from('pending_emails')
      .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
      .eq('id', row.id);
    return 'sent';
  } catch (err: any) {
    const attempts = (claimed as any).attempts as number;
    const max = (claimed as any).max_attempts as number;
    const dead = attempts >= max;
    await admin
      .from('pending_emails')
      .update({
        status: dead ? 'failed' : 'pending',
        last_error: String(err?.message || err).slice(0, 500),
        next_attempt_at: backoffISO(attempts),
      })
      .eq('id', row.id);
    console.error(`processEmailRow ${dead ? 'FAILED' : 'retry'} (${row.kind}):`, err?.message || err);
    return dead ? 'failed' : 'retry';
  }
}

// Drain all due jobs — used by the cron worker.
export async function sendDueEmails(admin: SupabaseClient, limit = MAX_BATCH) {
  const { data: rows, error } = await admin
    .from('pending_emails')
    .select('*')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('sendDueEmails query failed:', error);
    return { processed: 0, sent: 0 };
  }
  let sent = 0;
  for (const row of rows || []) {
    const r = await processEmailRow(admin, row);
    if (r === 'sent') sent++;
  }
  return { processed: (rows || []).length, sent };
}
