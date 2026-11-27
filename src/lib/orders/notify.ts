import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enqueueOrderEmail, processEmailRow } from '@/lib/email';

/**
 * Tell the customer their order shipped or was delivered: durable queue
 * first, then one immediate send attempt (the cron retries anything left).
 * Used by the owner's status form and by the courier webhook.
 */
export async function notifyOrderStatus(admin: SupabaseClient, orderId: string, status: 'shipped' | 'delivered'): Promise<void> {
  try {
    const { data: ord } = await admin.from('orders').select('id, shipping_address, user_id').eq('id', orderId).single();
    let recipient: string | undefined = (ord?.shipping_address as { email?: string } | null)?.email || undefined;
    if (!recipient && ord?.user_id) {
      const { data: u } = await admin.auth.admin.getUserById(ord.user_id);
      recipient = u?.user?.email || undefined;
    }
    if (!recipient) return;
    const row = await enqueueOrderEmail(admin, {
      orderId,
      recipient,
      kind: status === 'shipped' ? 'order_shipped' : 'order_delivered',
    });
    if (row) {
      try {
        await processEmailRow(admin, row);
      } catch (sendErr) {
        console.error('inline status send failed (will retry via cron):', sendErr);
      }
    }
  } catch (err) {
    console.error('Failed to queue status email:', err);
  }
}
