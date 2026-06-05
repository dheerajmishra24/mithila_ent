import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { MOCK_VARIANTS } from '@/lib/mock-data';
import BackgroundPattern from '@/components/vectors/BackgroundPattern';
import { MotionDiv, MotionLink } from '@/components/Motion';

import MobileFilterSheet from '@/components/MobileFilterSheet';

export const revalidate = 3600; // ISR cache for 1 hour

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string, style?: string }> }) {
  const params = await searchParams;
  const category = params.category?.toLowerCase();
  const style = params.style?.toLowerCase();
  
  const supabase = await createClient();
  const { data: dbVariants, error } = await supabase
    .from('product_variants')
    .select('*, products(title, slug, weave, is_featured, tags)');
    
  if (error) {
    console.warn("Supabase fetch failed (expected if no DB configured), falling back to mock data.");
  }

  // Use actual database data
  let variants = dbVariants || [];

  // Apply category filtering
  if (category) {
    variants = variants.filter(v => v.products?.tags?.includes(category));
  }
  // Apply style filtering (plain/printed)
  if (style) {
    variants = variants.filter(v => v.products?.tags?.includes(style));
  }

  const categoryDescriptions: Record<string, string> = {
    linen: "Pure linen holds tension and breathes. The long flax fibers provide high tensile strength and distinct surface slubs. This textile naturally resists heat retention and molds to the wearer over time.",
    cotton: "Woven cotton relies on a medium-weight structure for daily utility. The porous nature of the fiber allows consistent airflow while maintaining a crisp press. It provides a reliable foundation for both structured and relaxed garments.",
    viscose: "Viscose offers a specific fluid weight that drapes close to the body. The semi-synthetic fiber structure yields a cold, smooth hand-feel. It absorbs moisture quickly and resists static buildup.",
    flannel: "Brushed flannel relies on surface abrasion to create heat-trapping nap. This mechanical process raises the fibers to form an insulating thermal layer. The resulting textile is thick, soft, and highly efficient at blocking cold air.",
    corduroy: "Corduroy utilizes raised parallel ridges known as wales. These woven cords add substantial weight and structural rigidity to the cloth. The valleys between the ridges trap warm air to maintain consistent body temperatures.",
    twill: "The diagonal weave of twill forces yarns to pack tightly together. This density creates an incredibly strong surface that resists tearing and abrasion. The heavy construction naturally blocks wind and provides an authoritative drape.",
    suede: "Micro-fiber suede replicates the matte texture of leather through densely packed synthetic fibers. The surface is brushed to create a soft, non-reflective pile. This weight provides structural warmth and high resistance to wear.",
    velvet: "Velvet construction relies on an upright yarn pile that absorbs light. The dense surface traps insulating air layers against the skin. The fabric weight pulls garments straight down to create a heavy, luxurious fall.",
    wool: "Virgin wool fibers contain natural crimps that physically hold warm air. The keratin structure repels external moisture while retaining internal heat. It provides the highest warmth-to-weight ratio for severe cold weather.",
    fleece: "Thermal fleece utilizes a synthetic loft to mimic wool insulation. The brushed surface creates thousands of air pockets that hold body heat. It provides immediate tactile warmth while remaining highly breathable and quick-drying.",
    tweed: "Tweed combines heavily spun wool yarns into a rough, protective matrix. The tight, irregular weave physically repels moisture and biting winds. This heavyweight textile holds rigid shape and provides long-lasting environmental defense.",
    plain: "Solid color textiles dyed precisely for deep saturation and consistent color matching. The monochromatic finish highlights the structural weave of the chosen yardage.",
    printed: "Patterned yardage utilizing specialized dye-sublimation for sharp, wash-resistant graphics. The structural integrity and hand-feel of the base textile remain completely unaltered."
  };

  const currentDesc = category ? categoryDescriptions[category] || "Browse our complete catalog of premium woven yardage and seasonal textiles." : "Browse our complete catalog of premium woven yardage and seasonal textiles.";

  const categoriesList = [
    { name: 'All Fabrics', slug: '' },
    { name: 'Pure Linen', slug: 'linen' },
    { name: 'Woven Cotton', slug: 'cotton' },
    { name: 'Fluid Viscose', slug: 'viscose' },
    { name: 'Brushed Flannel', slug: 'flannel' },
    { name: 'Wale Corduroy', slug: 'corduroy' },
    { name: 'Diagonal Twill', slug: 'twill' },
    { name: 'Faux Suede', slug: 'suede' },
    { name: 'Pile Velvet', slug: 'velvet' },
    { name: 'Virgin Wool', slug: 'wool' },
    { name: 'Thermal Fleece', slug: 'fleece' },
    { name: 'Heritage Tweed', slug: 'tweed' }
  ];

  return (
    <main className="flex-grow bg-[var(--unbleached-cotton)] pt-24 md:pt-32 pb-24 relative overflow-x-hidden w-full">
      <BackgroundPattern className="opacity-40" />
      <div className="container mx-auto px-4 md:px-8 max-w-screen-2xl relative z-10">
        
        {/* Page Header */}
        <MotionDiv 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 md:mb-12 space-y-4 max-w-4xl"
        >
          <span className="text-xs uppercase font-bold tracking-widest text-[var(--madder-red)]">Premium Collections</span>
          <h1 className="font-serif italic text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-[var(--charcoal-ink)] tracking-tight">
            {category ? `${category.charAt(0).toUpperCase() + category.slice(1)} Registry` : 'Fabric Registry'}
          </h1>
          <p className="font-sans text-sm md:text-base opacity-80 max-w-3xl leading-relaxed text-justify">
            {currentDesc}
          </p>
        </MotionDiv>
        
        {/* Mobile Filter Sheet Component */}
        <MobileFilterSheet currentCategory={category} currentStyle={style} categoriesList={categoriesList} />

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 relative w-full items-start">
          
          {/* Desktop Left Sidebar (w-1/4) - Hidden on mobile/tablet */}
          <div className="hidden lg:block w-1/4 sticky top-32 max-h-[calc(100vh-128px)] overflow-y-auto pr-6 custom-scrollbar pb-12">
            
            <div className="mb-10">
              <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-[var(--charcoal-ink)] mb-4 border-b border-[var(--charcoal-ink)]/10 pb-2">Fabric Style</h3>
              <div className="flex flex-col gap-2 font-sans text-sm">
                <Link href={`/shop?category=${category || ''}&style=`} className={`px-4 py-2.5 rounded transition-colors font-bold ${!style ? 'bg-[var(--charcoal-ink)] text-white' : 'hover:bg-[var(--charcoal-ink)]/5 text-[var(--charcoal-ink)]'}`}>All Styles</Link>
                <Link href={`/shop?category=${category || ''}&style=plain`} className={`px-4 py-2.5 rounded transition-colors font-bold ${style === 'plain' ? 'bg-[var(--charcoal-ink)] text-white' : 'hover:bg-[var(--charcoal-ink)]/5 text-[var(--charcoal-ink)]'}`}>Plain Weave</Link>
                <Link href={`/shop?category=${category || ''}&style=printed`} className={`px-4 py-2.5 rounded transition-colors font-bold ${style === 'printed' ? 'bg-[var(--charcoal-ink)] text-white' : 'hover:bg-[var(--charcoal-ink)]/5 text-[var(--charcoal-ink)]'}`}>Printed & Patterned</Link>
              </div>
            </div>

            <div>
              <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-[var(--charcoal-ink)] mb-4 border-b border-[var(--charcoal-ink)]/10 pb-2">Weave Category</h3>
              <div className="flex flex-col gap-1 font-sans text-sm">
                {categoriesList.map(cat => {
                  const isActive = (category === cat.slug) || (!category && cat.slug === '');
                  return (
                    <Link 
                      key={cat.slug}
                      href={`/shop?category=${cat.slug}&style=${style || ''}`} 
                      className={`px-4 py-3 rounded-lg font-bold transition-colors border ${
                        isActive 
                        ? 'bg-[var(--indigo-dye)] text-white border-[var(--indigo-dye)] shadow-sm' 
                        : 'border-transparent hover:border-[var(--charcoal-ink)]/10 hover:bg-[var(--charcoal-ink)]/5 text-[var(--charcoal-ink)]'
                      }`}
                    >
                      {cat.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Product Grid Area (w-full or w-3/4 on desktop) */}
          <div className="w-full lg:w-3/4">
            {/* The Fluid Grid: grid-cols-1 on mobile, md:grid-cols-2 on tablet, xl:grid-cols-4 on massive screens */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 md:gap-8 lg:gap-10">
              {variants.length > 0 ? (
                variants.map((variant, index) => (
                  <MotionLink 
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.5, delay: (index % 4) * 0.1 }}
                    key={variant.id} 
                    href={`/product/${variant.products?.slug}`} 
                    className="polaroid-card group flex flex-col w-full bg-[var(--charcoal-ink)]/5 border border-[var(--charcoal-ink)]/10 backdrop-blur-sm"
                  >
                    {/* Fixed aspect ratio container for imagery */}
                    <div className="aspect-[3/4] bg-neutral-100 rounded-lg overflow-hidden border border-[var(--charcoal-ink)]/5 relative mb-4">
                      {variant.images && variant.images[0] ? (
                        <img 
                          src={variant.images[0]} 
                          alt={variant.products?.title || 'Product'} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        />
                      ) : (
                        <div className="w-full h-full bg-neutral-200"></div>
                      )}
                      {variant.products?.is_featured && (
                        <span className="absolute top-4 left-4 bg-[var(--madder-red)] text-white text-[9px] font-bold px-3 py-1.5 uppercase tracking-wider rounded-md shadow-sm">
                          Featured
                        </span>
                      )}
                    </div>
                    
                    <div className="px-2 pb-2 space-y-1">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500">{variant.products?.weave} Weave</span>
                      <h3 className="font-serif italic font-bold text-lg md:text-xl text-[var(--charcoal-ink)] mt-1 leading-tight">{variant.products?.title}</h3>
                      <p className="font-sans text-xs text-zinc-500 pt-1">{variant.color} colorway</p>
                      <p className="font-sans font-bold text-sm md:text-base text-[var(--indigo-dye)] mt-2">₹{variant.price} / meter</p>
                    </div>
                  </MotionLink>
                ))
              ) : (
                <div className="col-span-full py-24 text-center opacity-70 sonic-bento-card bg-[var(--charcoal-ink)]/5 p-8 border border-[var(--charcoal-ink)]/10 backdrop-blur-sm">
                   <p className="font-serif italic text-2xl font-bold text-[var(--charcoal-ink)]">No Fabrics Found</p>
                   <p className="font-sans mt-2 text-sm text-[var(--charcoal-ink)]/80">Our weavers are operating the looms to restore these swatches soon.</p>
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </main>
  );
}

