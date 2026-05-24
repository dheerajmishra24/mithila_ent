import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { MOCK_VARIANTS } from '@/lib/mock-data';
import BackgroundPattern from '@/components/vectors/BackgroundPattern';

export const revalidate = 3600; // ISR cache for 1 hour

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const params = await searchParams;
  const category = params.category?.toLowerCase();
  
  const supabase = await createClient();
  const { data: dbVariants, error } = await supabase
    .from('product_variants')
    .select('*, products(title, slug, weave, is_featured, tags)');
    
  if (error) {
    console.warn("Supabase fetch failed (expected if no DB configured), falling back to mock data.");
  }

  // Use mock data if database is empty to ensure a fully working prototype
  let variants = dbVariants && dbVariants.length > 0 ? dbVariants : MOCK_VARIANTS;

  // Apply category filtering
  if (category) {
    variants = variants.filter(v => v.products?.tags?.includes(category));
  }

  return (
    <main className="flex-grow bg-[var(--unbleached-cotton)] pt-32 pb-24 relative overflow-hidden">
      <BackgroundPattern className="opacity-40" />
      <div className="container mx-auto px-4 md:px-8 max-w-7xl relative z-10">
        
        {/* Page Header */}
        <div className="mb-12 space-y-4">
          <span className="text-xs uppercase font-bold tracking-widest text-[var(--madder-red)]">Premium Collections</span>
          <h1 className="font-serif italic text-4xl md:text-5xl font-bold text-[var(--charcoal-ink)]">
            {category ? `${category.charAt(0).toUpperCase() + category.slice(1)} Registry` : 'Our Fabric Registry'}
          </h1>
          <p className="font-sans text-sm opacity-80 max-w-3xl leading-relaxed text-justify">
            {category === 'cotton' 
              ? "Experience the grounding weight and unmatched airflow of authentic handloom cotton yardage. Sourced directly from multi-generational weaving clusters in India, our pure cotton fabric possesses a subtle, organic slub texture that breathes effortlessly during peak summer heat. Because the yarns remain untouched by aggressive industrial chemicals, the natural fibers retain their structural memory. With every wash, the weave relaxes, softening beautifully while maintaining its durable, structured drape. Ideal for bespoke shirting, structured tunics, and heirloom-quality home textiles."
              : category === 'linen'
              ? "Our artisanal textile wholesale linen offers a crisp, dry hand-feel and exceptional thermal regulation. Handwoven by master craftspeople in Mithila, this pure linen yardage acts as a natural insulator—drawing heat away from the body in summer and trapping warmth during winter. The distinct structural ridges of the hand-spun flax fibers catch the light, offering a muted, sophisticated luster. Over time, the stiff initial drape surrenders, yielding a fluid, butter-soft textile that drapes precisely to the form without losing its foundational strength."
              : "Browse through our organically loomed fabric swatches. Each swatch is hand-selected and dyed in natural plant pigments. Every thread holds the tension of the wooden loom, offering a structural integrity that machine-made fabrics simply cannot replicate."}
          </p>
        </div>
        
        {/* Clean Filter Sidebar/Header */}
        <div className="flex flex-wrap gap-3 mb-16 border-b border-[var(--charcoal-ink)]/10 pb-6 font-sans text-xs">
          <Link href="/shop" className={`px-5 py-2.5 uppercase font-bold tracking-wider rounded-lg shadow-sm transition-colors ${!category ? 'bg-[var(--indigo-dye)] text-white' : 'border border-[var(--charcoal-ink)]/10 hover:border-[var(--madder-red)] text-[var(--charcoal-ink)] bg-[var(--charcoal-ink)]/5 backdrop-blur-sm'}`}>
            All Fabrics
          </Link>
          <Link href="/shop?category=cotton" className={`px-5 py-2.5 uppercase font-bold tracking-wider rounded-lg transition-colors ${category === 'cotton' ? 'bg-[var(--indigo-dye)] text-white shadow-sm' : 'border border-[var(--charcoal-ink)]/10 hover:border-[var(--madder-red)] text-[var(--charcoal-ink)] bg-[var(--charcoal-ink)]/5 backdrop-blur-sm'}`}>
            Cotton Weaves
          </Link>
          <Link href="/shop?category=linen" className={`px-5 py-2.5 uppercase font-bold tracking-wider rounded-lg transition-colors ${category === 'linen' ? 'bg-[var(--indigo-dye)] text-white shadow-sm' : 'border border-[var(--charcoal-ink)]/10 hover:border-[var(--madder-red)] text-[var(--charcoal-ink)] bg-[var(--charcoal-ink)]/5 backdrop-blur-sm'}`}>
            Pure Linen
          </Link>
          <Link href="/shop?category=stitched" className={`px-5 py-2.5 uppercase font-bold tracking-wider rounded-lg transition-colors ${category === 'stitched' ? 'bg-[var(--indigo-dye)] text-white shadow-sm' : 'border border-[var(--charcoal-ink)]/10 hover:border-[var(--madder-red)] text-[var(--charcoal-ink)] bg-[var(--charcoal-ink)]/5 backdrop-blur-sm'}`}>
            Stitched Tunic Wear
          </Link>
        </div>

        {/* Polaroid Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-10">
          {variants.length > 0 ? (
            variants.map((variant) => (
              <Link key={variant.id} href={`/product/${variant.products?.slug}`} className="polaroid-card group flex flex-col w-full max-w-sm mx-auto bg-[var(--charcoal-ink)]/5 border border-[var(--charcoal-ink)]/10 backdrop-blur-sm">
                <div className="aspect-[3/4] bg-neutral-100 rounded-lg overflow-hidden border border-[var(--charcoal-ink)]/5 relative mb-4">
                  {variant.images && variant.images[0] ? (
                    <img src={variant.images[0]} alt={variant.products?.title || 'Product'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-neutral-200"></div>
                  )}
                  {variant.products?.is_featured && (
                    <span className="absolute top-4 left-4 bg-[var(--madder-red)] text-white text-[9px] font-bold px-3 py-1.5 uppercase tracking-wider rounded-md shadow-sm">
                      Featured
                    </span>
                  )}
                </div>
                
                <div className="px-1 space-y-1">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">{variant.products?.weave} Weave</span>
                  <h3 className="font-serif italic font-bold text-lg text-[var(--charcoal-ink)] mt-1">{variant.products?.title}</h3>
                  <p className="font-sans text-xs text-zinc-500">{variant.color} colorway</p>
                  <p className="font-sans font-bold text-sm text-[var(--indigo-dye)] mt-2">₹{variant.price} / meter</p>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full py-24 text-center opacity-70 sonic-bento-card bg-[var(--charcoal-ink)]/5 p-8 border border-[var(--charcoal-ink)]/10 backdrop-blur-sm">
               <p className="font-serif italic text-2xl font-bold text-[var(--charcoal-ink)]">No Fabrics Found</p>
               <p className="font-sans mt-2 text-sm text-[var(--charcoal-ink)]/80">Our weavers are operating the looms to restore these swatches soon.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

