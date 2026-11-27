import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

// Public remnant list. Roll tables are admin-only under RLS, so this reads with
// the service role and returns only what the storefront needs: no roll ids,
// dye-lot codes or stock figures beyond the piece length itself.

export interface RemnantDTO {
  key: string;
  title: string;
  slug: string;
  color: string;
  lengthM: number;
  pricePerM: number;
  image: string | null;
}

export async function listRemnants(limit = 60): Promise<RemnantDTO[]> {
  // The page is pre-rendered at build time (revalidate = 600). A build without
  // the service key (CI, preview) gets an empty list instead of a failed build;
  // the next revalidation on a configured server fills it in.
  let client: ReturnType<typeof createAdminClient>;
  try {
    client = createAdminClient();
  } catch {
    console.warn('listRemnants: service role not configured; showing no remnants');
    return [];
  }
  const { data, error } = await client
    .from('fabric_rolls')
    .select('roll_code, remaining_m, product_variants!inner(color, price, images, products!inner(title, slug, status, sell_unit))')
    .eq('status', 'remnant')
    .gt('remaining_m', 0)
    .eq('product_variants.products.status', 'active')
    .eq('product_variants.products.sell_unit', 'MTR')
    .order('remaining_m', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('listRemnants failed:', error.code);
    return [];
  }
  return (data ?? []).flatMap((row) => {
    const v = (Array.isArray(row.product_variants) ? row.product_variants[0] : row.product_variants) as
      | { color: string | null; price: number; images: string[] | null; products: unknown }
      | null;
    const p = (Array.isArray(v?.products) ? v?.products[0] : v?.products) as { title: string; slug: string } | null;
    // Only whole half-metres can be ordered.
    const lengthM = Math.floor(Number(row.remaining_m) * 2) / 2;
    if (!v || !p || lengthM < 0.5) return [];
    return [{
      key: row.roll_code,
      title: p.title,
      slug: p.slug,
      color: v.color ?? '',
      lengthM,
      pricePerM: Number(v.price),
      image: Array.isArray(v.images) && v.images[0] ? v.images[0] : null,
    }];
  });
}
