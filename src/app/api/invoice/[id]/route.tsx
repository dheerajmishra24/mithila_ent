import { NextRequest, NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11, color: '#2A2A2A' },
  header: { marginBottom: 24, borderBottom: '2px solid #8B2E2E', paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2A2A2A' },
  subtitle: { fontSize: 11, color: '#666', marginTop: 4 },
  section: { marginTop: 10, flexGrow: 1 },
  row: { flexDirection: 'row', marginBottom: 6 },
  headRow: { flexDirection: 'row', borderBottom: '1px solid #ccc', paddingBottom: 5, marginBottom: 8 },
  total: { marginTop: 16, borderTop: '1px solid #2A2A2A', paddingTop: 10, fontWeight: 'bold', fontSize: 14 },
});

type Line = { description: string; qty: number; amount: number };

const InvoiceDocument = ({
  id, date, billTo, lines, subtotal, tax, shipping, discount, total,
}: {
  id: string;
  date: string;
  billTo: string;
  lines: Line[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Mithila Enterprises</Text>
        <Text style={styles.subtitle}>Tax Invoice  |  Order #{id}</Text>
        <Text style={styles.subtitle}>{date}</Text>
      </View>
      <View style={styles.section}>
        {billTo ? <Text style={{ marginBottom: 14 }}>Bill To: {billTo}</Text> : null}

        <View style={styles.headRow}>
          <Text style={{ width: '60%', fontWeight: 'bold' }}>Description</Text>
          <Text style={{ width: '15%', fontWeight: 'bold', textAlign: 'right' }}>Qty</Text>
          <Text style={{ width: '25%', fontWeight: 'bold', textAlign: 'right' }}>Amount</Text>
        </View>

        {lines.length > 0 ? (
          lines.map((l, i) => (
            <View key={i} style={styles.row}>
              <Text style={{ width: '60%' }}>{l.description}</Text>
              <Text style={{ width: '15%', textAlign: 'right' }}>{l.qty}</Text>
              <Text style={{ width: '25%', textAlign: 'right' }}>INR {l.amount.toFixed(2)}</Text>
            </View>
          ))
        ) : (
          <View style={styles.row}>
            <Text style={{ width: '100%', color: '#888' }}>No line items recorded for this order.</Text>
          </View>
        )}

        <View style={{ marginTop: 16 }}>
          <View style={styles.row}>
            <Text style={{ width: '75%', textAlign: 'right', paddingRight: 8 }}>Subtotal</Text>
            <Text style={{ width: '25%', textAlign: 'right' }}>INR {subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={{ width: '75%', textAlign: 'right', paddingRight: 8 }}>Tax</Text>
            <Text style={{ width: '25%', textAlign: 'right' }}>INR {tax.toFixed(2)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={{ width: '75%', textAlign: 'right', paddingRight: 8 }}>Shipping</Text>
            <Text style={{ width: '25%', textAlign: 'right' }}>INR {shipping.toFixed(2)}</Text>
          </View>
          {discount > 0 ? (
            <View style={styles.row}>
              <Text style={{ width: '75%', textAlign: 'right', paddingRight: 8 }}>Discount</Text>
              <Text style={{ width: '25%', textAlign: 'right' }}>- INR {discount.toFixed(2)}</Text>
            </View>
          ) : null}
          <View style={{ ...styles.row, ...styles.total }}>
            <Text style={{ width: '75%', textAlign: 'right', paddingRight: 8 }}>Total</Text>
            <Text style={{ width: '25%', textAlign: 'right' }}>INR {total.toFixed(2)}</Text>
          </View>
        </View>
      </View>
    </Page>
  </Document>
);

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // RLS restricts SELECT to the order's owner or an admin, so an unauthorized
    // requester simply gets no row (404). No data leaks.
    const { data: order } = await supabase
      .from('orders')
      .select(
        'id, subtotal, tax_amount, shipping_amount, discount_applied, total_amount, created_at, shipping_address, order_items(quantity, unit_price, product_variants(color, products(title)))'
      )
      .eq('id', id)
      .single();

    if (!order) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    const lines: Line[] = (order.order_items || []).map((it: any) => ({
      description:
        (it.product_variants?.products?.title || 'Fabric') +
        (it.product_variants?.color ? ` - ${it.product_variants.color}` : ''),
      qty: it.quantity,
      amount: Number(it.unit_price) * it.quantity,
    }));

    const addr: any = order.shipping_address || {};
    const billTo =
      [addr.firstName, addr.lastName].filter(Boolean).join(' ') || addr.full_name || '';

    const shortId = String(order.id).split('-')[0].toUpperCase();
    const stream = await renderToStream(
      <InvoiceDocument
        id={shortId}
        date={new Date(order.created_at).toLocaleDateString()}
        billTo={billTo}
        lines={lines}
        subtotal={Number(order.subtotal || 0)}
        tax={Number(order.tax_amount || 0)}
        shipping={Number(order.shipping_amount || 0)}
        discount={Number(order.discount_applied || 0)}
        total={Number(order.total_amount || 0)}
      />
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Response(stream as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${shortId}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF Generation Error:', error);
    return new NextResponse('Error generating PDF', { status: 500 });
  }
}
