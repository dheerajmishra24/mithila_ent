import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToStream } from '@react-pdf/renderer';

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
    marginTop: 5,
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 10,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#111',
    paddingVertical: 10,
    marginTop: 20,
  },
  colLeft: { width: '60%' },
  colRight: { width: '40%', textAlign: 'right' },
  boldText: { fontSize: 10, fontWeight: 'bold' },
  text: { fontSize: 10, color: '#333' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#111',
  },
  totalLabel: { fontSize: 12, fontWeight: 'bold', marginRight: 20 },
  totalValue: { fontSize: 12, fontWeight: 'bold' },
});

// Create Document Component
const InvoiceDocument = ({ order, orderItems }: { order: any, orderItems: any[] }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>TAX INVOICE</Text>
        <Text style={styles.subtitle}>Mithila Enterprises</Text>
        <Text style={styles.subtitle}>GSTIN: 07AGUPM2548P1ZH</Text>
        <Text style={styles.subtitle}>Delhi, India</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.colLeft}>
          <Text style={styles.boldText}>Billed To:</Text>
          <Text style={styles.text}>{order.shipping_address?.fullName || 'Customer'}</Text>
          <Text style={styles.text}>{order.shipping_address?.addressLine1}</Text>
          <Text style={styles.text}>{order.shipping_address?.city}, {order.shipping_address?.postalCode}</Text>
        </View>
        <View style={styles.colRight}>
          <Text style={styles.boldText}>Order Details:</Text>
          <Text style={styles.text}>Order ID: {order.id.split('-')[0].toUpperCase()}</Text>
          <Text style={styles.text}>Date: {new Date(order.created_at).toLocaleDateString()}</Text>
        </View>
      </View>

      <View style={styles.rowHeader}>
        <Text style={[styles.boldText, styles.colLeft]}>Description</Text>
        <Text style={[styles.boldText, { width: '15%', textAlign: 'right' }]}>Qty</Text>
        <Text style={[styles.boldText, { width: '25%', textAlign: 'right' }]}>Amount</Text>
      </View>

      {orderItems.map((item, idx) => (
        <View style={styles.row} key={idx}>
          <Text style={[styles.text, styles.colLeft]}>
            {item.product_variants?.products?.title} ({item.product_variants?.color})
          </Text>
          <Text style={[styles.text, { width: '15%', textAlign: 'right' }]}>{item.quantity}</Text>
          <Text style={[styles.text, { width: '25%', textAlign: 'right' }]}>₹{(item.unit_price * item.quantity).toFixed(2)}</Text>
        </View>
      ))}

      <View style={styles.row}>
        <Text style={[styles.text, styles.colLeft]}></Text>
        <Text style={[styles.text, { width: '15%', textAlign: 'right' }]}>Shipping</Text>
        <Text style={[styles.text, { width: '25%', textAlign: 'right' }]}>₹{order.shipping_amount.toFixed(2)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.text, styles.colLeft]}></Text>
        <Text style={[styles.text, { width: '15%', textAlign: 'right' }]}>Tax</Text>
        <Text style={[styles.text, { width: '25%', textAlign: 'right' }]}>₹{order.tax_amount.toFixed(2)}</Text>
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Grand Total:</Text>
        <Text style={styles.totalValue}>₹{order.total_amount.toFixed(2)}</Text>
      </View>
    </Page>
  </Document>
);

export async function generateInvoiceBuffer(order: any, orderItems: any[]): Promise<Buffer> {
  const stream = await renderToStream(<InvoiceDocument order={order} orderItems={orderItems} />);
  
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
