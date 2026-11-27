import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateInvoiceBuffer } from '@/utils/pdf/generateInvoice';
import { invoiceContext } from '@/lib/invoice-context';
import { uuid } from '@/lib/validation/common';

// Customer/owner invoice download. Uses the same document as the e-mailed
// invoice (TAX INVOICE heading, supplier GSTIN) so the two can never differ.
// The RLS client restricts SELECT to the order's owner or an admin, so anyone
// else gets no row and a 404.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) {
    return new NextResponse('Invoice not found', { status: 404 });
  }
  try {
    const supabase = await createClient();
    const { data: order } = await supabase
      .from('orders')
      .select('*, order_items(*, product_variants(color, products(title)))')
      .eq('id', id)
      .maybeSingle();
    if (!order) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    // Supplier details and customer ID are read with the service role only
    // after the RLS query above has proved the caller may see this order.
    const ctx = await invoiceContext(order.user_id);
    const pdf = await generateInvoiceBuffer(order, order.order_items || [], ctx);
    const shortId = order.invoice_number
      ? String(order.invoice_number).replace(/\//g, '-')
      : String(order.id).split('-')[0].toUpperCase();
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${shortId}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('PDF Generation Error:', error instanceof Error ? error.message : error);
    return new NextResponse('Error generating PDF', { status: 500 });
  }
}
