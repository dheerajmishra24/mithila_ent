import { createClient } from '@/lib/supabase/server';
import ProductCard from '@/components/ProductCard';
import { MOCK_PRODUCTS } from '@/lib/mock-data';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const query = params.q || '';
  const supabase = await createClient();

  const { data: dbProducts } = await supabase
    .from('products')
    .select('*, product_variants(price, images)')
    .ilike('title', `%${query}%`)
    .eq('status', 'active');

  let products = dbProducts || [];

  return (
    <main className="flex-grow max-w-7xl mx-auto px-4 py-32 w-full min-h-screen">
      <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)] mb-2">Search Results</h1>
      <p className="font-sans text-sm opacity-70 mb-8">Showing results for: <span className="font-bold">&quot;{query}&quot;</span></p>

      {products && products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 border-2 border-dashed border-[var(--charcoal-ink)]/20 rounded-xl opacity-50 max-w-xl mx-auto">
          <p className="font-serif italic text-2xl font-bold mb-2">No fabrics found</p>
          <p className="font-sans text-sm">We couldn&apos;t find anything matching your search. Try different keywords.</p>
        </div>
      )}
    </main>
  );
}
