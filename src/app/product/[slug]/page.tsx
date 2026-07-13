import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import ProductBuyBox from './ProductBuyBox';
import { Metadata } from 'next';
import BackgroundPattern from '@/components/vectors/BackgroundPattern';
import { MotionDiv } from '@/components/Motion';
import ProductImage from '@/components/ProductImage';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: dbProduct } = await supabase
    .from('products')
    .select('title, description')
    .eq('slug', slug)
    .single();

  const product = dbProduct;

  if (!product) return { title: 'Product Not Found' };

  return {
    title: `${product.title} | Mithila Enterprises`,
    description: product.description,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  
  // Fetch product and its variants
  const { data: dbProduct } = await supabase
    .from('products')
    .select('*, product_variants(*), categories(name)')
    .eq('slug', slug)
    .single();

  const product = dbProduct;

  if (!product) {
    notFound();
  }

  // For simplicity, we auto-select the first variant if there's no complex variant switcher built yet
  const defaultVariant = product.product_variants[0];

  if (!defaultVariant) {
    return <div className="py-24 text-center">Product is unavailable.</div>;
  }

  return (
    <main className="flex-grow bg-transparent pt-32 pb-24 relative overflow-hidden">
      <BackgroundPattern className="opacity-40" />
      <div className="container mx-auto px-4 md:px-8 max-w-7xl relative z-10">
        {/* Breadcrumb */}
        <div className="font-sans text-xs opacity-70 mb-12 tracking-widest font-bold text-[var(--madder-red)]">
          HOME / SHOP / {(product.categories?.name || product.tags?.[0] || 'FABRIC').toUpperCase()} / {product.title.toUpperCase()}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* Images */}
          <MotionDiv 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-4 sticky top-32"
          >
            <div className="aspect-[3/4] bg-white/60 backdrop-blur-sm rounded-lg overflow-hidden relative shadow-sm border border-[var(--charcoal-ink)]/10">
               <ProductImage
                 src={defaultVariant.images?.[0]}
                 alt={product.title}
                 sizes="(max-width: 1024px) 100vw, 50vw"
                 priority
               />
            </div>
            {/* Thumbnail Gallery Placeholder */}
            {defaultVariant.images.length > 1 && (
              <div className="flex gap-4">
                {defaultVariant.images.slice(1).map((img: string, idx: number) => (
                   <div key={idx} className="w-24 h-32 bg-neutral-100 rounded-md overflow-hidden border border-zinc-100 cursor-pointer hover:opacity-80 transition-opacity">
                      <img src={img} alt="Thumbnail" className="w-full h-full object-cover" />
                   </div>
                ))}
              </div>
            )}
          </MotionDiv>

          {/* Details */}
          <MotionDiv 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col justify-center"
          >
            <h1 className="font-serif italic text-4xl md:text-6xl font-bold text-[var(--charcoal-ink)] mb-4 leading-tight">
              {product.title}
            </h1>
            <p className="font-sans text-2xl text-[var(--charcoal-ink)] font-bold mb-8">
              ₹{defaultVariant.price} <span className="text-sm font-normal opacity-60">/ meter</span>
            </p>

            <div className="space-y-8 text-[var(--charcoal-ink)] opacity-90 font-sans">
              <p className="leading-relaxed text-sm opacity-80 text-justify">
                {product.description || 'This premium textile yields a dense hand-feel and falls with an authoritative, heavy drape. The specific weave density physically blocks wind penetration, making it a highly functional fabric for domestic climates. The surface presents a distinct matte finish.'}
              </p>

              <div className="grid grid-cols-2 gap-y-8 gap-x-4 py-8 border-y border-[var(--charcoal-ink)]/10">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--charcoal-ink)]/50 mb-1">Blend</p>
                  <p className="font-bold text-sm">100% {product.categories?.name || 'Organic Yarn'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--charcoal-ink)]/50 mb-1">Width</p>
                  <p className="font-bold text-sm">{product.width || '54 inches / 137 cm'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--charcoal-ink)]/50 mb-1">Count</p>
                  <p className="font-bold text-sm">{product.count || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--charcoal-ink)]/50 mb-1">Construction</p>
                  <p className="font-bold text-sm">{product.construction || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--charcoal-ink)]/50 mb-1">Weight / GSM</p>
                  <p className="font-bold text-sm">{product.gsm ? `${product.gsm} GSM` : '320 GSM (Heavyweight)'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--charcoal-ink)]/50 mb-1">Stretch</p>
                  <p className="font-bold text-sm">{product.stretch || '0% Mechanical Stretch'}</p>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--charcoal-ink)]/50 mb-1">Origin</p>
                  <p className="font-bold text-sm">{product.origin || 'Mithila Artisanal Cluster, India'}</p>
                </div>
              </div>
              
              <div className="pt-2">
                 <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--charcoal-ink)]/50 mb-3">Best Suited For</p>
                 <ul className="list-disc pl-4 space-y-2 text-sm font-bold opacity-90">
                   {(product.best_suited_for || ['Tailored overcoats and structural outerwear', 'Unlined summer blazers', 'Dense upholstery and domestic home goods']).map((item: string, idx: number) => (
                     <li key={idx}>{item}</li>
                   ))}
                 </ul>
              </div>

            </div>

            <div className="mt-8">
              <ProductBuyBox productId={product.id} title={product.title} variants={product.product_variants} />
            </div>

            {/* Accordion Placeholders for Details */}
            <div className="mt-12">
              <details className="group border-b border-[var(--charcoal-ink)]/10 py-5 cursor-pointer">
                <summary className="font-sans text-sm font-bold uppercase tracking-wider flex justify-between items-center text-[var(--charcoal-ink)] outline-none">
                  Care Instructions
                  <span className="group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="pt-4 font-sans text-xs opacity-70 leading-relaxed text-justify">
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Wash gently by hand in cold water using a mild, pH-neutral detergent.</li>
                    <li>Do not wring or twist the wet fabric.</li>
                    <li>Dry flat in the shade to preserve the integrity of the natural dyes.</li>
                    <li>Iron on the reverse side while slightly damp for a crisp finish.</li>
                  </ul>
                </div>
              </details>
              <details className="group border-b border-[var(--charcoal-ink)]/10 py-5 cursor-pointer">
                <summary className="font-sans text-sm font-bold uppercase tracking-wider flex justify-between items-center text-[var(--charcoal-ink)] outline-none">
                  Shipping & Returns
                  <span className="group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="pt-4 font-sans text-xs opacity-70 leading-relaxed text-justify">
                  Dispatch within 48 hours. Returns accepted within 7 days of delivery if the fabric is uncut and unwashed. Custom Jamdani orders may take up to 3 weeks for dispatch.
                </div>
              </details>
            </div>
          </MotionDiv>
        </div>
      </div>
    </main>
  );
}
