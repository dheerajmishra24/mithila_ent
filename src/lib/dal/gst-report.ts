import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { stateName } from '@/lib/gst';

// Monthly GST liability for the owner and the CA: outward supplies by place of
// supply and rate (GSTR-1 / GSTR-3B 3.1), the HSN summary (GSTR-1 Table 12),
// and the B2B invoice list (GSTR-1 Table 4). Callers must authorise the admin
// first (requireAdminPage / requireAdmin); the report functions are granted to
// service_role only.

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function currentMonthIst(): string {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  return ist.toISOString().slice(0, 7);
}

export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export interface OutwardRow {
  kind: 'supply' | 'cancelled_after_invoice';
  placeOfSupply: string;
  stateName: string;
  gstRate: number;
  invoices: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface HsnRow {
  hsnCode: string;
  uqc: string;
  gstRate: number;
  quantity: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface B2bRow {
  invoiceNumber: string;
  invoiceDate: string;
  buyerGstin: string;
  placeOfSupply: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface GstReport {
  month: string;
  from: string;
  to: string;
  outward: OutwardRow[];
  hsn: HsnRow[];
  b2b: B2bRow[];
  totals: { taxableValue: number; cgst: number; sgst: number; igst: number };
  missingHsn: number;
}

const num = (v: unknown) => Number(v ?? 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export async function gstReport(month: string): Promise<GstReport> {
  if (!MONTH_RE.test(month)) throw new Error('INVALID_MONTH');
  const { from, to } = monthBounds(month);
  const admin = createAdminClient();

  const startIst = `${from}T00:00:00+05:30`;
  const endIst = new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86400000).toISOString();

  const [outward, hsn, b2b] = await Promise.all([
    admin.rpc('gst_outward_summary', { p_from: from, p_to: to }),
    admin.rpc('gst_hsn_summary', { p_from: from, p_to: to }),
    admin
      .from('orders')
      .select('invoice_number, invoice_date, buyer_gstin, place_of_supply, taxable_value, cgst_total, sgst_total, igst_total')
      .not('buyer_gstin', 'is', null)
      .not('invoice_number', 'is', null)
      .gte('invoice_date', startIst)
      .lt('invoice_date', endIst)
      .order('invoice_number'),
  ]);
  if (outward.error || hsn.error || b2b.error) {
    throw new Error('GST_REPORT_FAILED');
  }

  const outwardRows: OutwardRow[] = (outward.data ?? []).map((r: any) => ({
    kind: r.kind,
    placeOfSupply: r.place_of_supply ?? '',
    stateName: stateName(r.place_of_supply) ?? 'Unknown',
    gstRate: num(r.gst_rate),
    invoices: num(r.invoices),
    taxableValue: num(r.taxable_value),
    cgst: num(r.cgst),
    sgst: num(r.sgst),
    igst: num(r.igst),
  }));
  const hsnRows: HsnRow[] = (hsn.data ?? []).map((r: any) => ({
    hsnCode: r.hsn_code,
    uqc: r.uqc ?? '',
    gstRate: num(r.gst_rate),
    quantity: num(r.quantity),
    taxableValue: num(r.taxable_value),
    cgst: num(r.cgst),
    sgst: num(r.sgst),
    igst: num(r.igst),
  }));
  const b2bRows: B2bRow[] = (b2b.data ?? []).map((r: any) => ({
    invoiceNumber: r.invoice_number,
    invoiceDate: r.invoice_date,
    buyerGstin: r.buyer_gstin,
    placeOfSupply: r.place_of_supply ?? '',
    taxableValue: num(r.taxable_value),
    cgst: num(r.cgst_total),
    sgst: num(r.sgst_total),
    igst: num(r.igst_total),
  }));

  // Net liability: supplies minus lines cancelled after their invoice (those
  // rows carry negative values from the database).
  const totals = outwardRows.reduce(
    (t, r) => ({
      taxableValue: r2(t.taxableValue + r.taxableValue),
      cgst: r2(t.cgst + r.cgst),
      sgst: r2(t.sgst + r.sgst),
      igst: r2(t.igst + r.igst),
    }),
    { taxableValue: 0, cgst: 0, sgst: 0, igst: 0 }
  );

  return {
    month, from, to,
    outward: outwardRows,
    hsn: hsnRows,
    b2b: b2bRows,
    totals,
    missingHsn: hsnRows.filter((r) => r.hsnCode === 'MISSING').length,
  };
}
