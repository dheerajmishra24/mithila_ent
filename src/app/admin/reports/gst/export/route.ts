import { NextRequest, NextResponse } from 'next/server';
import { AuthError, requireAdmin } from '@/lib/dal/session';
import { gstReport, MONTH_RE } from '@/lib/dal/gst-report';
import { toCsv } from '@/lib/csv';

// CSV download of the monthly GST report. Admin only; every text cell goes
// through toCsv, which neutralises spreadsheet formulas (CSV injection).
const PARTS = new Set(['outward', 'hsn', 'b2b']);

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (err) {
    const status = err instanceof AuthError && err.code === 'FORBIDDEN' ? 403 : 401;
    return new NextResponse(status === 403 ? 'Forbidden' : 'Unauthorized', { status });
  }

  const month = request.nextUrl.searchParams.get('month') ?? '';
  const part = request.nextUrl.searchParams.get('part') ?? '';
  if (!MONTH_RE.test(month) || !PARTS.has(part)) {
    return new NextResponse('Bad request', { status: 400 });
  }

  let csv: string;
  try {
    const r = await gstReport(month);
    if (part === 'outward') {
      csv = toCsv(
        ['Type', 'Place of supply code', 'Place of supply', 'GST rate', 'Invoices', 'Taxable value', 'CGST', 'SGST', 'IGST'],
        r.outward.map((x) => [x.kind, x.placeOfSupply, x.stateName, x.gstRate, x.invoices, x.taxableValue, x.cgst, x.sgst, x.igst])
      );
    } else if (part === 'hsn') {
      csv = toCsv(
        ['HSN', 'UQC', 'GST rate', 'Quantity', 'Taxable value', 'CGST', 'SGST', 'IGST'],
        r.hsn.map((x) => [x.hsnCode, x.uqc, x.gstRate, x.quantity, x.taxableValue, x.cgst, x.sgst, x.igst])
      );
    } else {
      csv = toCsv(
        ['Invoice number', 'Invoice date', 'Buyer GSTIN', 'Place of supply', 'Taxable value', 'CGST', 'SGST', 'IGST'],
        r.b2b.map((x) => [x.invoiceNumber, x.invoiceDate, x.buyerGstin, x.placeOfSupply, x.taxableValue, x.cgst, x.sgst, x.igst])
      );
    }
  } catch (err) {
    console.error('GST export failed:', err instanceof Error ? err.message : err);
    return new NextResponse('Export failed', { status: 500 });
  }

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gst-${part}-${month}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
