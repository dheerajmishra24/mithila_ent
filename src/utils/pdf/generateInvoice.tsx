import React from 'react';
import { Document, Font, Page, Text, View, StyleSheet, renderToStream } from '@react-pdf/renderer';
import { stateName } from '@/lib/gst';
import type { InvoiceContext } from '@/lib/invoice-context';

// Tax invoice under CGST Rule 46. Fields: supplier name, address and GSTIN;
// consecutive invoice number (<= 16 chars) and date; recipient name, address,
// state and GSTIN (if registered); place of supply (state name and code); per
// line description, HSN, quantity with UQC, rate, discount, taxable value, GST
// rate and CGST/SGST/IGST; reverse charge; signatory. Orders not yet paid get
// a PROFORMA heading and no invoice number. Helvetica has no rupee glyph, so
// amounts are printed with "Rs.".

// Keep product names, GSTINs and invoice numbers whole (no auto-hyphenation).
Font.registerHyphenationCallback((word) => [word]);

const C = { ink: '#111111', muted: '#444444', rule: '#d4d4d4' };

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', fontSize: 8, color: C.ink },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  h: { fontFamily: 'Helvetica-Bold', fontSize: 8, marginBottom: 2, textTransform: 'uppercase', color: C.muted },
  b: { fontFamily: 'Helvetica-Bold' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.ink, paddingBottom: 10, marginBottom: 10 },
  parties: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  party: { flex: 1 },
  th: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.ink, paddingVertical: 4, fontFamily: 'Helvetica-Bold' },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: C.rule, paddingVertical: 4 },
  totals: { marginTop: 10, marginLeft: 'auto', width: '45%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  grand: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: C.ink, paddingTop: 4, marginTop: 4, fontFamily: 'Helvetica-Bold', fontSize: 10 },
  foot: { marginTop: 24, flexDirection: 'row', justifyContent: 'space-between' },
  small: { fontSize: 7, color: C.muted },
});

// Column widths (sum 100%).
const W = { n: '4%', desc: '21%', hsn: '8%', qty: '8%', rate: '9%', disc: '8%', taxable: '10%', pct: '7%', cgst: '9%', sgst: '8%', igst: '8%' };
const right = { textAlign: 'right' as const };

const n = (v: unknown) => Number(v ?? 0);
const rs = (v: unknown) => n(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (v: unknown) => {
  const x = n(v);
  return Number.isInteger(x) ? String(x) : x.toFixed(2);
};

type Line = {
  description: string; hsn: string; quantity: number; uqc: string; rate: number; discount: number;
  taxable: number; pct: number | null; cgst: number; sgst: number; igst: number;
};

function lines(items: any[]): Line[] {
  return items.map((it) => {
    const title = `${it.is_swatch ? 'Swatch: ' : ''}${it.product_variants?.products?.title ?? 'Item'}`;
    const color = it.product_variants?.color ? ` (${it.product_variants.color})` : '';
    const dye = it.dye_lot ? `, dye lot ${it.dye_lot}` : '';
    const gross = Math.round(n(it.unit_price) * n(it.quantity) * 100) / 100;
    if (it.taxable_value != null) {
      return {
        description: `${title}${color}${dye}`, hsn: it.hsn_code ?? '-', quantity: n(it.quantity), uqc: it.uqc ?? 'MTR',
        rate: n(it.unit_price), discount: n(it.discount_share), taxable: n(it.taxable_value), pct: n(it.gst_rate),
        cgst: n(it.cgst), sgst: n(it.sgst), igst: n(it.igst),
      };
    }
    // Orders placed before per-line GST snapshots (migration 0051): the
    // order-level tax_amount is shown in the totals instead of a split.
    return {
      description: `${title}${color}${dye}`, hsn: '-', quantity: n(it.quantity), uqc: it.uqc ?? 'MTR',
      rate: n(it.unit_price), discount: 0, taxable: gross, pct: null,
      cgst: 0, sgst: 0, igst: 0,
    };
  });
}

const InvoiceDocument = ({ order, orderItems, ctx }: { order: any; orderItems: any[]; ctx: InvoiceContext }) => {
  const a = order.shipping_address ?? {};
  const name = [a.firstName, a.lastName].filter(Boolean).join(' ') || a.fullName || 'Customer';
  const isTaxInvoice = Boolean(order.invoice_number);
  const posCode: string | null = order.place_of_supply ?? null;
  const posName = stateName(posCode) ?? a.state ?? '';
  const supplierState = stateName(ctx.supplier.stateCode) ?? '';
  const rows = lines(orderItems.filter((it) => it.status !== 'cancelled' || isTaxInvoice));
  const legacy = rows.some((r) => r.pct === null);
  const sum = (k: keyof Line) => rows.reduce((t, r) => t + n(r[k]), 0);
  const date = new Date(order.invoice_date ?? order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

  return (
    <Document title={isTaxInvoice ? `Tax invoice ${order.invoice_number}` : 'Proforma invoice'} author={ctx.supplier.legalName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.rowTop}>
          <View>
            <Text style={styles.title}>{isTaxInvoice ? 'TAX INVOICE' : 'PROFORMA INVOICE'}</Text>
            <Text style={[styles.b, { fontSize: 11, marginTop: 6 }]}>{ctx.supplier.legalName}</Text>
            <Text>{ctx.supplier.address}</Text>
            <Text>GSTIN: {ctx.supplier.gstin}   State: {supplierState} ({ctx.supplier.stateCode})</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text>Invoice No: <Text style={styles.b}>{order.invoice_number ?? 'Not issued (awaiting payment)'}</Text></Text>
            <Text>Invoice Date: {date}</Text>
            <Text>Order Ref: {String(order.id).split('-')[0].toUpperCase()}</Text>
            {ctx.customerCode ? <Text>Customer ID: {ctx.customerCode}</Text> : null}
            <Text>Reverse charge: No</Text>
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.h}>Billed to / Ship to</Text>
            <Text style={styles.b}>{name}</Text>
            <Text>{[a.address1 || a.addressLine1, a.address2].filter(Boolean).join(', ')}</Text>
            <Text>{[a.city, posName].filter(Boolean).join(', ')} {a.pinCode || a.postalCode || ''}</Text>
            {order.buyer_gstin ? <Text>GSTIN: {order.buyer_gstin}</Text> : <Text>Unregistered (B2C)</Text>}
          </View>
          <View style={styles.party}>
            <Text style={styles.h}>Place of supply</Text>
            <Text>{posName}{posCode ? ` (${posCode})` : ''}</Text>
            <Text style={[styles.small, { marginTop: 4 }]}>
              {posCode && posCode === ctx.supplier.stateCode ? 'Intra-state supply: CGST + SGST' : 'Inter-state supply: IGST'}
            </Text>
          </View>
        </View>

        <View style={styles.th}>
          <Text style={{ width: W.n }}>#</Text>
          <Text style={{ width: W.desc }}>Description</Text>
          <Text style={{ width: W.hsn }}>HSN</Text>
          <Text style={[{ width: W.qty }, right]}>Qty</Text>
          <Text style={[{ width: W.rate }, right]}>Rate</Text>
          <Text style={[{ width: W.disc }, right]}>Discount</Text>
          <Text style={[{ width: W.taxable }, right]}>Taxable</Text>
          <Text style={[{ width: W.pct }, right]}>GST%</Text>
          <Text style={[{ width: W.cgst }, right]}>CGST</Text>
          <Text style={[{ width: W.sgst }, right]}>SGST</Text>
          <Text style={[{ width: W.igst }, right]}>IGST</Text>
        </View>
        {rows.map((r, i) => (
          <View style={styles.tr} key={i} wrap={false}>
            <Text style={{ width: W.n }}>{i + 1}</Text>
            <Text style={{ width: W.desc, paddingRight: 4 }}>{r.description}</Text>
            <Text style={{ width: W.hsn }}>{r.hsn}</Text>
            <Text style={[{ width: W.qty }, right]}>{qty(r.quantity)} {r.uqc}</Text>
            <Text style={[{ width: W.rate }, right]}>{rs(r.rate)}</Text>
            <Text style={[{ width: W.disc }, right]}>{rs(r.discount)}</Text>
            <Text style={[{ width: W.taxable }, right]}>{rs(r.taxable)}</Text>
            <Text style={[{ width: W.pct }, right]}>{r.pct === null ? '-' : `${qty(r.pct)}%`}</Text>
            <Text style={[{ width: W.cgst }, right]}>{rs(r.cgst)}</Text>
            <Text style={[{ width: W.sgst }, right]}>{rs(r.sgst)}</Text>
            <Text style={[{ width: W.igst }, right]}>{rs(r.igst)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}><Text>Taxable value</Text><Text>Rs. {rs(legacy ? n(order.subtotal) - n(order.discount_applied) : sum('taxable'))}</Text></View>
          {legacy ? (
            <View style={styles.totalRow}><Text>GST</Text><Text>Rs. {rs(order.tax_amount)}</Text></View>
          ) : (
            <>
              <View style={styles.totalRow}><Text>CGST</Text><Text>Rs. {rs(sum('cgst'))}</Text></View>
              <View style={styles.totalRow}><Text>SGST</Text><Text>Rs. {rs(sum('sgst'))}</Text></View>
              <View style={styles.totalRow}><Text>IGST</Text><Text>Rs. {rs(sum('igst'))}</Text></View>
            </>
          )}
          <View style={styles.totalRow}>
            <Text>Shipping</Text>
            <Text>{order.order_kind === 'swatch' ? 'Included' : `Rs. ${rs(order.shipping_amount)}`}</Text>
          </View>
          <View style={styles.grand}><Text>Total</Text><Text>Rs. {rs(order.total_amount)}</Text></View>
          {n(order.credit_applied) > 0 && (
            <>
              <View style={[styles.totalRow, { marginTop: 4 }]}><Text>Paid with swatch credit</Text><Text>Rs. {rs(order.credit_applied)}</Text></View>
              <View style={styles.totalRow}><Text>Paid online</Text><Text>Rs. {rs(order.amount_due)}</Text></View>
            </>
          )}
        </View>

        <View style={styles.foot}>
          <Text style={styles.small}>
            Computer-generated invoice. HSN codes as per the product master.{'\n'}
            Lines cancelled after this invoice are adjusted by a credit note.
          </Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.b}>For {ctx.supplier.legalName}</Text>
            <Text style={{ marginTop: 18 }}>Authorised Signatory</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export async function generateInvoiceBuffer(order: any, orderItems: any[], ctx?: InvoiceContext): Promise<Buffer> {
  const context: InvoiceContext = ctx ?? {
    supplier: { legalName: 'Mithila Enterprises', gstin: '07AGUPM2548P1ZH', stateCode: '07', address: 'Delhi, India' },
    customerCode: null,
  };
  const stream = await renderToStream(<InvoiceDocument order={order} orderItems={orderItems} ctx={context} />);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
