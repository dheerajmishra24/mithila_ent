import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { fabricData } from '@/lib/fabric-data';

export const revalidate = 3600;

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  
  // First find category
  const { data: category } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!category) {
    notFound();
  }

  // Then fetch products
  const { data: variants } = await supabase
    .from('product_variants')
    .select('*, products!inner(title, slug, weave, is_featured, category_id)')
    .eq('products.category_id', category.id);

  // Safely get fabric data (returns undefined if not present yet)
  const fabricInfo = fabricData ? fabricData[slug] : undefined;

  return (
    <main className="flex-grow bg-transparent">
      {/* 1. EDITORIAL HERO SECTION */}
      <section className="w-full relative min-h-[60vh] md:min-h-[75vh] flex items-center pt-32 pb-24 overflow-hidden">
        <div className="container mx-auto px-6 md:px-8 relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-16 lg:gap-24">
            
            {/* Text Content */}
            <div className="flex-1 w-full max-w-2xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-[2px] w-12 bg-[var(--turmeric)]" />
                <span className="text-[var(--charcoal-ink)]/80 font-sans uppercase text-xs tracking-[0.4em] font-bold">
                  The Material Archive
                </span>
              </div>
              
              <h1 className="font-serif italic text-6xl md:text-8xl lg:text-[7.5rem] text-[var(--charcoal-ink)] mb-8 tracking-tight leading-[0.9]">
                {category.name}
              </h1>
              
              <p className="font-sans text-lg md:text-xl text-zinc-700 leading-relaxed font-light max-w-xl">
                {fabricInfo ? fabricInfo.heroDescription : `Explore our premium collection of ${category.name.toLowerCase()} fabrics, woven with care and inspired by heritage.`}
              </p>
            </div>

            {/* Featured Image */}
            <div className="flex-1 w-full flex justify-center md:justify-end">
              <div className="relative w-full max-w-lg aspect-[4/5] rounded-t-full rounded-b-xl overflow-hidden shadow-2xl shadow-[var(--charcoal-ink)]/20 border-8 border-white/40">
                <Image 
                  src={`/images/fabrics/${slug}.png`} 
                  alt={category.name} 
                  fill 
                  className="object-cover hover:scale-110 transition-transform duration-[2000ms] ease-out" 
                  sizes="(max-width: 768px) 100vw, 50vw" 
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                <div className="absolute inset-0 border border-white/20 rounded-t-full rounded-b-xl pointer-events-none" />
              </div>
            </div>
            
          </div>
        </div>
      </section>

      {/* 2. ENCYCLOPEDIA CONTENT */}
      {fabricInfo && (
        <section className="py-24 border-t border-[var(--charcoal-ink)]/10">
          <div className="container mx-auto px-6 md:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24">
              
              {/* Left Column: Fast Facts */}
              <div className="lg:col-span-4 space-y-12">
                <div className="sonic-bento-card bg-[var(--charcoal-ink)]/5 p-8 border-l-4 border-[var(--charcoal-ink)] shadow-md">
                  <h4 className="font-serif italic font-bold text-2xl text-[var(--charcoal-ink)] mb-4">Origins</h4>
                  <p className="font-sans text-sm text-[var(--charcoal-ink)]/80 leading-relaxed text-justify">
                    {fabricInfo.whereItsMade}
                  </p>
                </div>

                <div className="space-y-6">
                  <h4 className="font-sans font-bold text-sm uppercase tracking-[0.2em] text-[var(--charcoal-ink)] border-b border-[var(--charcoal-ink)]/10 pb-4">Key Benefits</h4>
                  <ul className="space-y-5">
                    {fabricInfo.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-4 group">
                        <span className="text-[var(--madder-red)] mt-0.5 group-hover:rotate-90 transition-transform duration-300">✦</span>
                        <span className="font-sans text-sm font-bold text-[var(--charcoal-ink)] leading-snug">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-6">
                  <h4 className="font-sans font-bold text-sm uppercase tracking-[0.2em] text-[var(--charcoal-ink)] border-b border-[var(--charcoal-ink)]/10 pb-4">Applications</h4>
                  <div className="flex flex-wrap gap-2">
                    {fabricInfo.useCases.map((useCase, idx) => (
                      <span key={idx} className="px-4 py-2 bg-[var(--charcoal-ink)]/5 border border-[var(--charcoal-ink)]/10 text-[var(--charcoal-ink)] text-xs font-bold uppercase tracking-wider rounded shadow-sm">
                        {useCase}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Deep Dive */}
              <div className="lg:col-span-8 max-w-3xl">
                
                <h2 className="text-3xl md:text-4xl font-serif italic font-bold text-[var(--charcoal-ink)] border-b border-[var(--charcoal-ink)]/10 pb-6 mb-8">A Brief History</h2>
                <p className="font-sans text-lg text-[var(--charcoal-ink)]/80 leading-relaxed text-justify mb-16 first-letter:text-6xl first-letter:font-serif first-letter:italic first-letter:mr-2 first-letter:float-left first-letter:text-[var(--charcoal-ink)]">
                  {fabricInfo.history}
                </p>

                <h2 className="text-3xl md:text-4xl font-serif italic font-bold text-[var(--charcoal-ink)] border-b border-[var(--charcoal-ink)]/10 pb-6 mb-8">Crafting the Cloth</h2>
                <p className="font-sans text-lg text-[var(--charcoal-ink)]/80 leading-relaxed text-justify mb-20">
                  {fabricInfo.howItsMade}
                </p>

                <div className="bg-[#1c1917] text-[#f7f3cc] p-10 md:p-16 rounded-[2rem] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#f59e0b]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#dc2626]/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />
                  <span className="text-[#f59e0b] font-sans uppercase text-[10px] tracking-[0.3em] font-bold block mb-4 relative z-10">The Market View</span>
                  <h2 className="text-3xl md:text-4xl font-serif italic font-bold text-[#f7f3cc] mb-8 relative z-10 leading-tight">Modern Fashion Trends</h2>
                  <p className="font-sans text-[#f7f3cc]/80 text-lg md:text-xl leading-relaxed text-justify relative z-10">
                    {fabricInfo.fashionTrends}
                  </p>
                </div>

              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. PRODUCT GRID */}
      <section className="py-24 bg-[var(--charcoal-ink)]/5 border-t border-[var(--charcoal-ink)]/10">
        <div className="container mx-auto px-6 md:px-8">
          <div className="flex justify-between items-end mb-12">
            <div>
              <span className="text-[var(--madder-red)] font-sans uppercase text-xs tracking-[0.2em] font-bold block mb-2">Available Inventory</span>
              <h2 className="font-serif italic text-3xl md:text-4xl font-bold text-[var(--charcoal-ink)]">Shop {category.name}</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
            {variants && variants.length > 0 ? (
              variants.map((variant) => (
                <Link key={variant.id} href={`/product/${variant.products?.slug}`} className="polaroid-card group flex flex-col w-full bg-[var(--unbleached-cotton)] border border-[var(--charcoal-ink)]/10 shadow-sm hover:shadow-[4px_4px_0_var(--charcoal-ink)] transition-shadow">
                  <div className="aspect-[3/4] bg-neutral-200 mb-4 overflow-hidden rounded-md relative border border-[var(--charcoal-ink)]/5">
                    {variant.images && variant.images[0] ? (
                      <Image src={variant.images[0]} fill alt={variant.products?.title || 'Product'} className="object-cover group-hover:scale-105 transition-transform duration-700" sizes="(max-width: 768px) 100vw, 25vw" />
                    ) : (
                      <div className="w-full h-full bg-neutral-300"></div>
                    )}
                    {variant.products?.is_featured && (
                      <span className="absolute top-4 left-4 bg-[var(--madder-red)] text-white text-[9px] font-bold px-3 py-1.5 uppercase tracking-wider rounded-md shadow-sm">
                        Featured
                      </span>
                    )}
                  </div>
                  <div className="px-2 pb-2">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-700">{variant.products?.weave} Weave</span>
                    <h3 className="font-serif font-bold text-lg text-[var(--charcoal-ink)] mt-1 group-hover:text-[var(--madder-red)] transition-colors">{variant.products?.title}</h3>
                    <p className="font-sans text-xs opacity-70 mt-1">{variant.color} colorway</p>
                    <p className="font-sans font-bold text-[var(--charcoal-ink)] mt-3">₹{variant.price} / meter</p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-full py-24 text-center sonic-bento-card bg-[var(--unbleached-cotton)] border border-[var(--charcoal-ink)]/10 shadow-lg">
                <div className="w-16 h-16 mx-auto relative mb-6">
                  <Image src="/images/logo.png" alt="Mithila Enterprises Logo" fill className="object-contain" />
                </div>
                 <p className="font-serif italic text-4xl font-bold text-[var(--charcoal-ink)] mb-4">Curating {category.name}</p>
                 <p className="font-sans text-lg text-[var(--charcoal-ink)]/70 max-w-lg mx-auto leading-relaxed">Our weavers are currently preparing the newest collection of {category.name.toLowerCase()} fabrics. Check back soon for fresh inventory.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
