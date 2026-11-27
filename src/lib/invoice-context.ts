import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

// Supplier details and the customer's ID for the tax invoice. Customers may
// not read gst_settings or other profiles, so callers first authorise the
// order with their own client and then fetch this with the service role.

export interface InvoiceSupplier {
  legalName: string;
  gstin: string;
  stateCode: string;
  address: string;
}

export interface InvoiceContext {
  supplier: InvoiceSupplier;
  customerCode: string | null;
}

const FALLBACK: InvoiceSupplier = {
  legalName: 'Mithila Enterprises',
  gstin: '07AGUPM2548P1ZH',
  stateCode: '07',
  address: 'Delhi, India',
};

export async function invoiceContext(userId: string | null | undefined): Promise<InvoiceContext> {
  const admin = createAdminClient();
  const [{ data: s }, profile] = await Promise.all([
    admin.from('gst_settings').select('legal_name, supplier_gstin, supplier_state_code, address').eq('id', 1).maybeSingle(),
    userId
      ? admin.from('profiles').select('customer_code').eq('id', userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    supplier: s
      ? { legalName: s.legal_name, gstin: s.supplier_gstin, stateCode: s.supplier_state_code, address: s.address }
      : FALLBACK,
    customerCode: (profile.data as { customer_code?: string } | null)?.customer_code ?? null,
  };
}
