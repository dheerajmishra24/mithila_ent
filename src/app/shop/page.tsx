import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import BackgroundPattern from '@/components/vectors/BackgroundPattern';
import { MotionDiv, MotionLink } from '@/components/Motion';
import ProductImage from '@/components/ProductImage';

import MobileFilterSheet from '@/components/MobileFilterSheet';
import SortDropdown from '@/components/SortDropdown';

import { getSiteContentMap } from '@/lib/content';

export const revalidate = 3600; // ISR cache for 1 hour

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string, style?: string, color?: string, gsm?: string, construction?: string, count?: string, price?: string, sort?: string, collection?: string }> }) {
  const contentMap = await getSiteContentMap();
  const header = contentMap['shop_header'] || { title: '', body: '' };
  
  const params = await searchParams;
  const category = params.category?.toLowerCase();
  const collection = params.collection;
  const style = params.style?.toLowerCase();
  const color = params.color;
  const gsmFilter = params.gsm;
  const construction = params.construction;
  const count = params.count;
  const priceFilter = params.price;
  const sort = params.sort;
  
  const supabase = await createClient();
  let query = supabase
    .from('product_variants')
    .select('*, products!inner(title, slug, weave, count, construction, gsm, is_featured, tags, categories!inner(name, slug))');
    
  if (category) {
    // fallback if no relation works, but products!inner(categories!inner()) allows this:
    query = query.eq('products.categories.slug', category);
  }
  if (collection) {
    const { data: pcData } = await supabase.from('collections')
      .select('id, product_collections(product_id)')
      .eq('slug', collection)
      .single();
      
    const productIds = pcData?.product_collections?.map((pc: any) => pc.product_id) || [];
    if (productIds.length > 0) {
      query = query.in('product_id', productIds);
    } else {
      query = query.in('product_id', ['00000000-0000-0000-0000-000000000000']);
    }
  }
  if (style) {
    query = query.contains('products.tags', [style]);
  }
  if (color) {
    query = query.eq('color', color);
  }
  if (construction) {
    query = query.eq('products.construction', construction);
  }
  if (count) {
    query = query.eq('products.count', count);
  }
  
  if (gsmFilter === 'light') {
    query = query.lt('products.gsm', 150);
  } else if (gsmFilter === 'medium') {
    query = query.gte('products.gsm', 150).lte('products.gsm', 250);
  } else if (gsmFilter === 'heavy') {
    query = query.gt('products.gsm', 250);
  }

  if (priceFilter === 'budget') {
    query = query.lt('price', 1000);
  } else if (priceFilter === 'standard') {
    query = query.gte('price', 1000).lte('price', 2000);
  } else if (priceFilter === 'premium') {
    query = query.gt('price', 2000);
  }

  if (sort === 'price_asc') {
    query = query.order('price', { ascending: true });
  } else if (sort === 'price_desc') {
    query = query.order('price', { ascending: false });
  } else {
    // Default sorting - we can't easily order by foreign table column in PostgREST unless we do some tricks. 
    // We'll leave it default and sort featured in memory or rely on default ID sort.
  }

  const { data: dbVariants, error } = await query;
    
  if (error) {
    console.warn("Supabase fetch failed (expected if no DB configured), falling back to mock data.");
  }

  const variants = (dbVariants && dbVariants.length > 0) ? dbVariants : [];

  if (!sort) {
    variants.sort((a: any, b: any) => (b.products?.is_featured ? 1 : 0) - (a.products?.is_featured ? 1 : 0));
  }

  // Filter options derived from live inventory
  const allColors = Array.from(new Set(variants.map((v: any) => v.color).filter(Boolean))) as string[];
  const allConstructions = Array.from(new Set(variants.map((v: any) => v.products?.construction).filter(Boolean))) as string[];
  const allCounts = Array.from(new Set(variants.map((v: any) => v.products?.count).filter(Boolean))) as string[];

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
    { name: 'Linen', slug: 'linen' },
    { name: 'Cotton', slug: 'cotton' },
    { name: 'Viscose', slug: 'viscose' },
    { name: 'Flannel', slug: 'flannel' },
    { name: 'Corduroy', slug: 'corduroy' },
    { name: 'Twill', slug: 'twill' },
    { name: 'Suede', slug: 'suede' },
    { name: 'Velvet', slug: 'velvet' },
    { name: 'Wool', slug: 'wool' },
    { name: 'Fleece', slug: 'fleece' },
    { name: 'Tweed', slug: 'tweed' },
  ];

  const { data: dbCollections } = await supabase.from('collections').select('title, slug').eq('is_active', true).order('title');
  const collectionsList = dbCollections || [];

  const getFilterUrl = (key: string, value: string | null) => {
    const q = new URLSearchParams();
    if (category) q.set('category', category);
    if (collection) q.set('collection', collection);
    if (style) q.set('style', style);
    if (color) q.set('color', color);
    if (gsmFilter) q.set('gsm', gsmFilter);
    if (construction) q.set('construction', construction);
    if (count) q.set('count', count);
    if (priceFilter) q.set('price', priceFilter);
    if (sort) q.set('sort', sort);

    if (value === null || value === '') {
      q.delete(key);
    } else {
      q.set(key, value);
    }
    return `/shop?${q.toString()}`;
  };

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
            {header.title || (category ? `${category.charAt(0).toUpperCase() + category.slice(1)} Registry` : 'Fabric Registry')}
          </h1>
          <p className="font-sans text-sm md:text-base opacity-80 max-w-3xl leading-relaxed text-justify">
            {header.body || currentDesc}
          </p>
        </MotionDiv>
        
        {/* Mobile Filter Sheet Component */}
        <MobileFilterSheet 
          currentCategory={category} 
          currentStyle={style} 
          currentColor={color}
          currentGsm={gsmFilter}
          currentConstruction={construction}
          currentCount={count}
          currentPrice={priceFilter}
          categoriesList={categoriesList} 
          allColors={allColors}
          allConstructions={allConstructions}
          allCounts={allCounts}
        />

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 relative w-full items-start">
          
          {/* Desktop Left Sidebar (w-1/4) - Hidden on mobile/tablet */}
          <div className="hidden lg:block w-1/4 sticky top-32 max-h-[calc(100vh-128px)] overflow-y-auto pr-6 custom-scrollbar pb-12 space-y-10">
            
            {/* Fabric Style */}
            <div>
              <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-[var(--charcoal-ink)] mb-4 border-b border-[var(--charcoal-ink)]/10 pb-2">Fabric Print</h3>
              <div className="flex flex-col gap-2 font-sans text-sm">
                <Link href={getFilterUrl('style', null)} className={`px-4 py-2.5 rounded transition-colors font-bold ${!style ? 'bg-[var(--charcoal-ink)] text-white' : 'hover:bg-[var(--charcoal-ink)]/5 text-[var(--charcoal-ink)]'}`}>All Styles</Link>
                <Link href={getFilterUrl('style', 'plain')} className={`px-4 py-2.5 rounded transition-colors font-bold ${style === 'plain' ? 'bg-[var(--charcoal-ink)] text-white' : 'hover:bg-[var(--charcoal-ink)]/5 text-[var(--charcoal-ink)]'}`}>Plain Weave</Link>
                <Link href={getFilterUrl('style', 'printed')} className={`px-4 py-2.5 rounded transition-colors font-bold ${style === 'printed' ? 'bg-[var(--charcoal-ink)] text-white' : 'hover:bg-[var(--charcoal-ink)]/5 text-[var(--charcoal-ink)]'}`}>Printed & Patterned</Link>
              </div>
            </div>

            {/* Weave Category */}
            <div>
              <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-[var(--charcoal-ink)] mb-4 border-b border-[var(--charcoal-ink)]/10 pb-2">Category</h3>
              <div className="flex flex-col gap-1 font-sans text-sm">
                {categoriesList.map(cat => {
                  const isActive = (category === cat.slug) || (!category && cat.slug === '');
                  return (
                    <Link 
                      key={cat.slug}
                      href={getFilterUrl('category', cat.slug)} 
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

            {/* Curated Collections */}
            {collectionsList.length > 0 && (
              <div>
                <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-[var(--charcoal-ink)] mb-4 border-b border-[var(--charcoal-ink)]/10 pb-2">Collections</h3>
                <div className="flex flex-col gap-1 font-sans text-sm">
                  <Link 
                    href={getFilterUrl('collection', null)} 
                    className={`px-4 py-2 rounded transition-colors font-bold ${!collection ? 'text-[var(--madder-red)]' : 'text-[var(--charcoal-ink)] hover:bg-[var(--charcoal-ink)]/5'}`}
                  >
                    All Items
                  </Link>
                  {collectionsList.map(coll => (
                    <Link 
                      key={coll.slug}
                      href={getFilterUrl('collection', coll.slug)} 
                      className={`px-4 py-2 rounded transition-colors font-bold ${collection === coll.slug ? 'text-[var(--madder-red)]' : 'text-[var(--charcoal-ink)] hover:bg-[var(--charcoal-ink)]/5'}`}
                    >
                      {coll.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Weight (GSM) */}
            <div>
              <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-[var(--charcoal-ink)] mb-4 border-b border-[var(--charcoal-ink)]/10 pb-2">Weight (GSM)</h3>
              <div className="flex flex-col gap-2 font-sans text-sm">
                <Link href={getFilterUrl('gsm', null)} className={`px-4 py-2.5 rounded transition-colors font-bold ${!gsmFilter ? 'bg-[var(--charcoal-ink)] text-white' : 'hover:bg-[var(--charcoal-ink)]/5 text-[var(--charcoal-ink)]'}`}>All Weights</Link>
                <Link href={getFilterUrl('gsm', 'light')} className={`px-4 py-2.5 rounded transition-colors font-bold ${gsmFilter === 'light' ? 'bg-[var(--charcoal-ink)] text-white' : 'hover:bg-[var(--charcoal-ink)]/5 text-[var(--charcoal-ink)]'}`}>Lightweight (&lt;150)</Link>
                <Link href={getFilterUrl('gsm', 'medium')} className={`px-4 py-2.5 rounded transition-colors font-bold ${gsmFilter === 'medium' ? 'bg-[var(--charcoal-ink)] text-white' : 'hover:bg-[var(--charcoal-ink)]/5 text-[var(--charcoal-ink)]'}`}>Medium (150-250)</Link>
                <Link href={getFilterUrl('gsm', 'heavy')} className={`px-4 py-2.5 rounded transition-colors font-bold ${gsmFilter === 'heavy' ? 'bg-[var(--charcoal-ink)] text-white' : 'hover:bg-[var(--charcoal-ink)]/5 text-[var(--charcoal-ink)]'}`}>Heavyweight (&gt;250)</Link>
              </div>
            </div>

            {/* Price */}
            <div>
              <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-[var(--charcoal-ink)] mb-4 border-b border-[var(--charcoal-ink)]/10 pb-2">Price Range</h3>
              <div className="flex flex-col gap-2 font-sans text-sm">
                <Link href={getFilterUrl('price', null)} className={`px-4 py-2.5 rounded transition-colors font-bold ${!priceFilter ? 'bg-[var(--charcoal-ink)] text-white' : 'hover:bg-[var(--charcoal-ink)]/5 text-[var(--charcoal-ink)]'}`}>All Prices</Link>
                <Link href={getFilterUrl('price', 'budget')} className={`px-4 py-2.5 rounded transition-colors font-bold ${priceFilter === 'budget' ? 'bg-[var(--charcoal-ink)] text-white' : 'hover:bg-[var(--charcoal-ink)]/5 text-[var(--charcoal-ink)]'}`}>Under ₹1000</Link>
                <Link href={getFilterUrl('price', 'standard')} className={`px-4 py-2.5 rounded transition-colors font-bold ${priceFilter === 'standard' ? 'bg-[var(--charcoal-ink)] text-white' : 'hover:bg-[var(--charcoal-ink)]/5 text-[var(--charcoal-ink)]'}`}>₹1000 - ₹2000</Link>
                <Link href={getFilterUrl('price', 'premium')} className={`px-4 py-2.5 rounded transition-colors font-bold ${priceFilter === 'premium' ? 'bg-[var(--charcoal-ink)] text-white' : 'hover:bg-[var(--charcoal-ink)]/5 text-[var(--charcoal-ink)]'}`}>Over ₹2000</Link>
              </div>
            </div>

            {/* Colors */}
            <div>
              <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-[var(--charcoal-ink)] mb-4 border-b border-[var(--charcoal-ink)]/10 pb-2">Color</h3>
              <div className="flex flex-col gap-1 font-sans text-sm">
                <Link href={getFilterUrl('color', null)} className={`px-4 py-2 rounded transition-colors font-bold ${!color ? 'text-[var(--madder-red)]' : 'text-[var(--charcoal-ink)] hover:bg-[var(--charcoal-ink)]/5'}`}>All Colors</Link>
                {allColors.map(c => (
                  <Link key={c} href={getFilterUrl('color', c)} className={`px-4 py-2 rounded transition-colors font-bold ${color === c ? 'text-[var(--madder-red)]' : 'text-[var(--charcoal-ink)] hover:bg-[var(--charcoal-ink)]/5'}`}>{c}</Link>
                ))}
              </div>
            </div>

            {/* Construction */}
            <div>
              <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-[var(--charcoal-ink)] mb-4 border-b border-[var(--charcoal-ink)]/10 pb-2">Construction</h3>
              <div className="flex flex-col gap-1 font-sans text-sm">
                <Link href={getFilterUrl('construction', null)} className={`px-4 py-2 rounded transition-colors font-bold ${!construction ? 'text-[var(--madder-red)]' : 'text-[var(--charcoal-ink)] hover:bg-[var(--charcoal-ink)]/5'}`}>All Constructions</Link>
                {allConstructions.map(c => (
                  <Link key={c} href={getFilterUrl('construction', c)} className={`px-4 py-2 rounded transition-colors font-bold ${construction === c ? 'text-[var(--madder-red)]' : 'text-[var(--charcoal-ink)] hover:bg-[var(--charcoal-ink)]/5'}`}>{c}</Link>
                ))}
              </div>
            </div>

            {/* Count */}
            <div>
              <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-[var(--charcoal-ink)] mb-4 border-b border-[var(--charcoal-ink)]/10 pb-2">Thread Count</h3>
              <div className="flex flex-col gap-1 font-sans text-sm">
                <Link href={getFilterUrl('count', null)} className={`px-4 py-2 rounded transition-colors font-bold ${!count ? 'text-[var(--madder-red)]' : 'text-[var(--charcoal-ink)] hover:bg-[var(--charcoal-ink)]/5'}`}>All Counts</Link>
                {allCounts.map(c => (
                  <Link key={c} href={getFilterUrl('count', c)} className={`px-4 py-2 rounded transition-colors font-bold ${count === c ? 'text-[var(--madder-red)]' : 'text-[var(--charcoal-ink)] hover:bg-[var(--charcoal-ink)]/5'}`}>{c}</Link>
                ))}
              </div>
            </div>

          </div>

          {/* Product Grid Area (w-full or w-3/4 on desktop) */}
          <div className="w-full lg:w-3/4 flex flex-col gap-6">
            {/* Header / Sort Row */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--charcoal-ink)]/5 p-4 rounded-lg border border-[var(--charcoal-ink)]/10">
              <span className="font-sans text-sm font-bold text-[var(--charcoal-ink)] uppercase tracking-wider">
                {variants.length} {variants.length === 1 ? 'Fabric' : 'Fabrics'} Found
              </span>
              <div className="flex items-center gap-3">
                <span className="font-sans text-xs font-bold text-[var(--charcoal-ink)]/60 uppercase tracking-widest">Sort By</span>
                <SortDropdown currentSort={sort || 'featured'} />
              </div>
            </div>

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
                      <ProductImage
                        src={variant.images?.[0]}
                        alt={variant.products?.title || 'Product'}
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                        className="group-hover:scale-105 transition-transform duration-500"
                      />
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
                   <p className="font-serif italic text-2xl font-bold text-[var(--charcoal-ink)]">Coming Soon!</p>
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

