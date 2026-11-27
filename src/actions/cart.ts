'use server';

import { createClient } from '@/lib/supabase/server';
import { variantIdListSchema } from '@/lib/validation/customer';

// Refreshes price and MOQ for the variants in the browser cart. Public data
// (the RLS read policy only returns active products); the list is capped and
// must be ids (SEC-12).
export async function syncCartVariants(variantIds: string[]) {
  const parsed = variantIdListSchema.safeParse(variantIds);
  if (!parsed.success || parsed.data.length === 0) return [];
  const ids = [...new Set(parsed.data)];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('product_variants')
    .select('id, price, min_order_quantity, max_cut_m, products(sell_unit)')
    .in('id', ids);

  if (error) {
    console.error('Failed to sync cart variants:', error.message);
    return [];
  }

  // Numeric columns can arrive as strings; normalise to numbers.
  return (data ?? []).map((v) => {
    const product = (Array.isArray(v.products) ? v.products[0] : v.products) as { sell_unit?: string } | null;
    return {
      id: v.id as string,
      price: Number(v.price),
      min_order_quantity: Number(v.min_order_quantity ?? 1),
      max_cut_m: Number(v.max_cut_m ?? 0),
      unit: product?.sell_unit === 'PCS' ? ('PCS' as const) : ('MTR' as const),
    };
  });
}
