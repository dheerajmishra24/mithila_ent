"use client";

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import Image from 'next/image';
import BackgroundPattern from '@/components/vectors/BackgroundPattern';

// Animation spring configurations matching Sonic's elite motion curves
const springTransition = { type: "spring" as const, bounce: 0.15, duration: 0.8 };

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05
    }
  }
};

const fadeUpItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: springTransition }
};

// Scroll Reveal variants for viewport elements
const scrollRevealVariants = {
  hidden: { opacity: 0, y: 35 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { type: "spring" as const, bounce: 0.1, duration: 0.8 } 
  }
};

const staggerGridContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
    }
  }
};

const gridItemVariants = {
  hidden: { opacity: 0, y: 25 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { type: "spring" as const, bounce: 0.15, duration: 0.8 } 
  }
};

// Premium Text Reveal Line Mask
function AnimatedTitle({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <h1 className="font-serif italic text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] text-zinc-900 overflow-hidden flex flex-wrap gap-x-3">
      {words.map((word, idx) => (
        <span key={idx} className="block overflow-hidden relative">
          <motion.span
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{ type: "spring", bounce: 0.1, duration: 0.8, delay: idx * 0.05 }}
            className="block"
          >
            {word}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

export default function Home() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "What is the difference between plain and printed viscose for summer?",
      a: "Plain viscose provides a monochromatic, high-density drape that absorbs heat and resists static. Printed viscose undergoes a dye-sublimation process that bonds color directly into the fibers. The structural breathability and fluid weight remain identical across both variations."
    },
    {
      q: "Which winter fabric is warmest: wool, fleece, or tweed?",
      a: "Virgin wool provides the highest warmth-to-weight ratio due to natural fiber crimps that trap air. Thermal fleece offers immediate tactile warmth and retains heat even when wet. Tweed relies on a heavily spun, irregular matrix to physically block wind and moisture, making it best for harsh environmental defense."
    },
    {
      q: "How do I care for premium velvet and suede fabrics?",
      a: "Premium velvet requires professional dry cleaning to prevent pile crushing and maintain light absorption properties. Micro-fiber suede resists surface abrasion and can be spot-cleaned with a damp cloth. Neither fabric should be exposed to direct, high-heat ironing."
    },
    {
      q: "Do you offer wholesale fabric purchasing for designers?",
      a: "Yes. We supply premium yardage at tiered wholesale rates for domestic artisans and design houses. Wholesale accounts require a valid tax identification number and a minimum order quantity of 50 yards per textile variant."
    }
  ];

  const blogs = [
    {
      title: "Wireless Looms: The Evolution of Shuttle Weaving",
      date: "Feb 1, 2026",
      desc: "Stay updated with the latest trends in organic weaving, handloom innovations, and expert tips to enhance your fabric durability.",
      img: "/images/about/loom.png"
    },
    {
      title: "Indigo Dyeing and Beyond: Organic Pigment Fermentation",
      date: "Feb 4, 2026",
      desc: "Delving deep into traditional vat indigo fermentation methods and vegetable-based natural dye preservation techniques.",
      img: "/images/about/dyes.png"
    },
    {
      title: "Eco-Friendly Handloom Solutions for Modern Brands",
      date: "Feb 7, 2026",
      desc: "How boutique designers are leveraging organic GOTS certified cotton and fair-trade artisans to build sustainable luxury lines.",
      img: "/images/about/fibers.png"
    }
  ];

  const brandTags = [
    "🌾 100% GOTS Certified Cotton",
    "🎨 Fermented Indigo Dyes",
    "🧵 Hand-Shuttle Looms",
    "🏡 Fair-Trade Artisan Guilds",
    "🍃 Zero Chemical Curing",
    "🕊️ Sustainable Livelihoods",
    "✨ Heritage Madhubani Linens"
  ];

  return (
    <main className="flex-grow w-full bg-[var(--unbleached-cotton)] text-zinc-900 pt-8 pb-24 font-sans overflow-x-hidden relative">
      
      {/* 1. HERO SECTION */}
      <section className="relative w-full max-w-7xl mx-auto px-6 py-8 md:py-12 rounded-3xl">
        <BackgroundPattern className="opacity-60" />
        
        {/* Professional Authentic Mandala (temporarily removed per request) */}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center relative z-10">
          
          {/* Hero Left Content */}
          <motion.div 
            initial="hidden"
            animate="show"
            variants={staggerContainer}
            className="space-y-6 text-left max-w-xl"
          >
            <motion.span 
              variants={fadeUpItem}
              className="inline-block px-3 py-1 rounded-full border border-[var(--charcoal-ink)]/20 bg-[var(--charcoal-ink)]/5 text-[var(--charcoal-ink)] text-xs font-semibold uppercase tracking-wider shadow-sm"
            >
              Artisanal Heritage Revival
            </motion.span>
            
            <AnimatedTitle text="Premium Textiles Engineered for Living." />

            <motion.h4 
              variants={fadeUpItem}
              className="text-lg md:text-xl font-medium text-zinc-800 leading-snug"
            >
              We source and supply heavyweight winter wools and breathable summer linens for domestic designers. Our year-round catalog guarantees exact drape, structural integrity, and long-lasting fabric memory.
            </motion.h4>
            
            <motion.div 
              variants={fadeUpItem}
              className="flex flex-wrap gap-4 pt-2"
            >
              <Link 
                href="/shop" 
                className="px-6 py-3.5 bg-black hover:bg-zinc-800 text-white font-sans text-xs uppercase font-bold tracking-widest rounded-lg transition-all duration-300 shadow-sm"
              >
                Buy now
              </Link>
            </motion.div>
          </motion.div>

          {/* Hero Right Visual (Peacock SVG showcase) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              y: [0, -15, 0],
              transition: {
                y: { repeat: Infinity, duration: 6, ease: "easeInOut" },
                opacity: { duration: 0.8 },
                scale: { type: "spring", bounce: 0.15, duration: 0.8 }
              }
            }}
            className="hidden lg:flex relative justify-center lg:justify-end w-full"
          >
            <div className="relative w-full max-w-[550px] aspect-square hover:scale-[1.03] transition-transform duration-700 cursor-pointer mix-blend-multiply drop-shadow-sm">
              <Image 
                src="/images/peacock hero.svg" 
                alt="Professional Madhubani Peacock" 
                fill
                className="object-contain object-center" 
                priority
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* PROFESSIONAL BORDER DIVIDER */}
      <div 
        className="w-full relative z-20 h-24 md:h-32 opacity-90 mix-blend-multiply"
        style={{ backgroundImage: 'url(/images/madhubani_border.png)', backgroundRepeat: 'repeat-x', backgroundSize: 'contain', backgroundPosition: 'center' }}
      />

      {/* 2. INFINITE SCROLLING CERTIFICATION TICKER */}
      <section className="w-full py-8 bg-[var(--unbleached-cotton)] border-y border-[var(--charcoal-ink)]/10 overflow-hidden relative">
        <BackgroundPattern className="opacity-10" />
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[var(--unbleached-cotton)] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[var(--unbleached-cotton)] to-transparent z-10 pointer-events-none" />
        
        <div className="container mx-auto px-6 max-w-7xl mb-4">
          <h3 className="font-sans font-bold text-[10px] uppercase tracking-widest text-zinc-400 text-center">
            Trusted by Thousands, Engineered for Excellence
          </h3>
        </div>

        <div className="flex whitespace-nowrap overflow-hidden relative mt-4">
          {/* Loop items infinitely using Framer Motion */}
          <motion.div 
            animate={{ x: [0, -1200] }}
            transition={{ ease: "linear", duration: 30, repeat: Infinity }}
            className="flex gap-16 whitespace-nowrap font-serif italic text-base text-zinc-500 font-bold opacity-80"
          >
            {/* Double the array for seamless endless marquee looping */}
            {[...brandTags, ...brandTags].map((tag, idx) => (
              <span key={idx} className="flex items-center gap-2">
                {tag}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 3. THE SCIENCE OF THE SEASON */}
      <section className="w-full py-24 px-6 max-w-7xl mx-auto">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={scrollRevealVariants}
          className="text-center max-w-3xl mx-auto mb-16 space-y-3"
        >
          <span className="text-[var(--madder-red)] font-sans text-xs uppercase tracking-wider font-semibold">Climate Engineering</span>
          <h2 className="font-serif italic text-3xl md:text-5xl font-bold leading-tight text-[var(--charcoal-ink)]">
            Fabric Functionality
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-12 lg:gap-16 mt-12">
          
          {/* Spring / Summer Card */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={scrollRevealVariants}
            className="relative flex flex-col group"
          >
            {/* Image Layer */}
            <div className="w-full h-72 md:h-[22rem] relative rounded-2xl overflow-hidden shadow-lg z-10 border border-[var(--charcoal-ink)]/10">
              <Image 
                src="/images/fabrics/linen.png" 
                fill 
                className="object-cover transition-transform duration-1000 group-hover:scale-105" 
                alt="Spring/Summer Fabric Weave" 
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--charcoal-ink)]/20 mix-blend-multiply transition-opacity duration-500 group-hover:opacity-0" />
            </div>

            {/* Overlapping Text Layer */}
            <div className="bg-white/95 backdrop-blur-xl p-8 md:p-10 border border-[var(--charcoal-ink)]/10 shadow-2xl rounded-2xl z-20 -mt-20 mx-4 md:mx-8 relative transition-transform duration-500 group-hover:-translate-y-2">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-2 h-2 rounded-full bg-[var(--madder-red)] animate-pulse" />
                <h4 className="font-serif italic font-bold text-2xl text-[var(--charcoal-ink)]">Spring / Summer</h4>
              </div>
              <p className="font-sans text-xs md:text-sm text-zinc-600 leading-relaxed text-justify">
                Warm climates demand fabrics that physically expel heat. Our linen, cotton, and viscose textiles are engineered with open weave structures that maximize air circulation. Natural fibers absorb body moisture and pull it to the fabric surface for rapid evaporation. This constant airflow prevents heat trapping and maintains a dry, structured drape in high humidity.
              </p>
            </div>
          </motion.div>

          {/* Autumn / Winter Card */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={scrollRevealVariants}
            className="relative flex flex-col group md:mt-16"
          >
            {/* Image Layer */}
            <div className="w-full h-72 md:h-[22rem] relative rounded-2xl overflow-hidden shadow-lg z-10 border border-[var(--charcoal-ink)]/10">
              <Image 
                src="/images/fabrics/wool.png" 
                fill 
                className="object-cover transition-transform duration-1000 group-hover:scale-105" 
                alt="Autumn/Winter Fabric Weave" 
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--charcoal-ink)]/20 mix-blend-multiply transition-opacity duration-500 group-hover:opacity-0" />
            </div>

            {/* Overlapping Text Layer */}
            <div className="bg-[var(--charcoal-ink)]/95 backdrop-blur-xl p-8 md:p-10 border border-[var(--charcoal-ink)]/20 shadow-2xl rounded-2xl z-20 -mt-20 mx-4 md:mx-8 relative transition-transform duration-500 group-hover:-translate-y-2">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-2 h-2 rounded-full bg-[var(--turmeric)] animate-pulse" />
                <h4 className="font-serif italic font-bold text-2xl text-white">Autumn / Winter</h4>
              </div>
              <p className="font-sans text-xs md:text-sm text-zinc-300 leading-relaxed text-justify">
                Cold weather requires textiles that actively build thermal barriers. Dense weaves found in our flannel, corduroy, twill, suede, velvet, wool, fleece, and tweed collections physically trap body heat within micro-pockets of air. The heavy weight and raised surface piles block wind penetration. This structural density ensures superior insulation and tactile warmth for domestic winters.
              </p>
            </div>
          </motion.div>

        </div>
      </section>

      {/* 4. SHOP BY CATEGORY GRID */}
      <section className="w-full py-24 bg-[var(--unbleached-cotton)] border-y border-[var(--charcoal-ink)]/10">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-[var(--madder-red)] font-sans text-xs uppercase tracking-wider font-semibold">The Navigation Grid</span>
            <h2 className="font-serif italic text-3xl md:text-4xl font-bold text-[var(--charcoal-ink)]">Shop by Category</h2>
          </div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerGridContainer}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {[
              { title: "Premium Pure Linen", desc: "Breathable summer linen by the yard designed for structured warm-weather tailoring.", slug: "linen" },
              { title: "Organic Woven Cotton", desc: "Medium-weight cotton offering superior moisture wicking and crisp garment construction.", slug: "cotton" },
              { title: "Fluid Drape Viscose", desc: "High-density viscose fabric yielding a smooth, cooling finish for fluid silhouettes.", slug: "viscose" },
              { title: "Brushed Winter Flannel", desc: "Double-brushed cotton flannel engineered for maximum heat retention and tactile softness.", slug: "flannel" },
              { title: "Heavyweight Wale Corduroy", desc: "Durable ribbed corduroy providing deep textural ridges and robust cold-weather insulation.", slug: "corduroy" },
              { title: "Diagonal Weave Twill", desc: "Tightly bound twill fabric ensuring exceptional tear resistance and structured fall.", slug: "twill" },
              { title: "Supple Faux Suede", desc: "Dense micro-fiber suede offering a luxurious matte finish and substantial hand-feel.", slug: "suede" },
              { title: "Plush Pile Velvet", desc: "Heavy pile velvet woven for light absorption, intense color depth, and tactile warmth.", slug: "velvet" },
              { title: "Insulating Pure Wool", desc: "Dense virgin wool textiles guaranteeing maximum thermal insulation and wind resistance.", slug: "wool" },
              { title: "Thermal Polar Fleece", desc: "High-loft fleece fabric structured to trap body heat without adding excess weight.", slug: "fleece" },
              { title: "Heritage Woven Tweed", desc: "Heavily textured wool tweed crafted for structured outerwear and regional weather defense.", slug: "tweed" }
            ].map((cat, idx) => (
              <motion.div 
                key={idx}
                variants={gridItemVariants}
                whileHover={{ y: -4 }}
                className="sonic-bento-card relative group p-0 flex flex-col overflow-hidden min-h-[18rem] bg-[var(--charcoal-ink)]/5 border border-[var(--charcoal-ink)]/10 hover:border-[var(--madder-red)]/50 transition-colors"
              >
                {/* Image Section */}
                <div className="h-44 w-full relative overflow-hidden bg-[var(--unbleached-cotton)]">
                  <Image 
                    src={`/images/fabrics/${cat.slug}.png`} 
                    alt={cat.title} 
                    fill 
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105" 
                  />
                  {/* Subtle gradient overlay to merge image with card body */}
                  <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[var(--charcoal-ink)]/10 to-transparent"></div>
                </div>
                
                {/* Text Section */}
                <div className="p-6 flex flex-col justify-between flex-grow">
                  <div>
                    <h4 className="font-serif italic font-bold text-lg text-[var(--charcoal-ink)] mb-2 group-hover:text-[var(--madder-red)] transition-colors">{cat.title}</h4>
                    <p className="font-sans text-xs text-[var(--charcoal-ink)]/70 leading-relaxed text-justify">{cat.desc}</p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-[var(--charcoal-ink)]/10 flex justify-between items-center z-20 relative">
                    <Link href={`/shop?category=${cat.slug}&style=plain`} className="font-sans text-[10px] uppercase font-bold tracking-widest text-[var(--charcoal-ink)]/80 hover:text-[var(--madder-red)] transition-colors px-3 py-1.5 bg-white/60 hover:bg-white rounded shadow-sm backdrop-blur-md">Plain</Link>
                    <Link href={`/shop?category=${cat.slug}&style=printed`} className="font-sans text-[10px] uppercase font-bold tracking-widest text-[var(--charcoal-ink)]/80 hover:text-[var(--madder-red)] transition-colors px-3 py-1.5 bg-white/60 hover:bg-white rounded shadow-sm backdrop-blur-md">Printed</Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 5. SPOTLIGHT FEATURE ("Timeless Elegance" & "In reality" mapping) */}
      <section className="w-full py-24 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", bounce: 0.1, duration: 1 }}
            className="relative flex justify-center lg:justify-start"
          >
            <div className="relative w-full max-w-[500px] aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--charcoal-ink)]/10 bg-[var(--charcoal-ink)]/5 p-3 shadow-sm hover:scale-[1.01] transition-transform duration-500">
              <Image 
                src="/images/fabrics/suede.png" 
                alt="Intricate Handloom fabric curations" 
                fill
                className="object-cover rounded-xl" 
              />
            </div>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={scrollRevealVariants}
            className="space-y-6"
          >
            <span className="text-[var(--madder-red)] font-sans text-xs uppercase tracking-wider font-semibold">Fabric Physics</span>
            <h2 className="font-serif italic text-3xl md:text-5xl font-bold text-[var(--charcoal-ink)]">Quiet Luxury</h2>
            <h4 className="font-sans text-base md:text-lg text-[var(--charcoal-ink)]/80 font-medium">
              We bring you textiles that feel substantial, breathe effortlessly, and age with grace.
            </h4>
            <p className="font-sans text-sm text-[var(--charcoal-ink)]/70 leading-relaxed text-justify">
              Our handloomed collections act as a natural insulator—drawing heat away from the body in summer and trapping warmth during winter. Because the yarns remain untouched by aggressive industrial chemicals, the natural fibers retain their structural memory.
            </p>
          </motion.div>

        </div>
      </section>

      {/* 6. FAQ ACCORDION ("Everything You Need to Know...") */}
      <section id="faq" className="w-full max-w-4xl mx-auto py-24 px-6">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={scrollRevealVariants}
          className="text-center mb-16 space-y-3"
        >
          <span className="text-purple-600 font-sans text-xs uppercase tracking-wider font-semibold font-bold">Welcome to Beyond FAQ!</span>
          <h2 className="font-serif italic text-3xl md:text-4xl font-bold text-zinc-950">Everything You Need to Know About Our Fabrics</h2>
        </motion.div>

        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerGridContainer}
          className="space-y-4"
        >
          {faqs.map((faq, index) => {
            const isOpen = activeFaq === index;
            return (
              <motion.div 
                key={index} 
                variants={gridItemVariants}
                className="sonic-bento-card overflow-hidden bg-[var(--charcoal-ink)]/5 border border-[var(--charcoal-ink)]/10"
              >
                <button
                  onClick={() => setActiveFaq(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left font-serif text-lg md:text-xl font-bold italic text-zinc-900 focus:outline-none"
                >
                  <span>{faq.q}</span>
                  <span className="text-2xl transform transition-transform duration-300 ml-4 font-sans text-zinc-400">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="px-6 pb-6 pt-2 font-sans text-sm text-zinc-600 border-t border-[var(--charcoal-ink)]/10 bg-[var(--charcoal-ink)]/5 leading-relaxed">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* 7. INSIGHTS / WEAVERS' BLOG GRID */}
      <section className="w-full py-24 bg-[var(--unbleached-cotton)] border-y border-[var(--charcoal-ink)]/10 relative">
        <BackgroundPattern className="opacity-10" />
        <div className="container mx-auto px-6 max-w-7xl relative z-10">
          <div className="flex flex-col items-center">
            <motion.span 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={scrollRevealVariants}
              className="text-xs font-semibold uppercase tracking-wider text-[var(--madder-red)] mb-3"
            >
              Blogs
            </motion.span>
            <motion.h2 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={scrollRevealVariants}
              className="font-serif italic text-3xl md:text-5xl font-bold mb-4 text-center text-[var(--charcoal-ink)]"
            >
              Sound Insights
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={scrollRevealVariants}
              className="text-zinc-500 font-sans text-sm max-w-md text-center mb-16 leading-relaxed"
            >
              Stay updated with the latest trends in organic weaving, handloom innovations, and expert care tips to enhance your heritage fabrics.
            </motion.p>
            
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerGridContainer}
              className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full"
            >
              {blogs.map((blog, idx) => (
                <motion.div 
                  key={idx} 
                  variants={gridItemVariants}
                  className="sonic-bento-card group flex flex-col w-full max-w-sm mx-auto bg-[var(--charcoal-ink)]/5 border border-[var(--charcoal-ink)]/10 p-4"
                >
                  <div className="aspect-[4/3] bg-neutral-100 rounded-lg overflow-hidden border border-[var(--charcoal-ink)]/5 relative mb-4">
                    <img src={blog.img} alt={blog.title} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                  </div>
                  <div className="px-1 space-y-2 flex-grow flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 font-semibold">{blog.date}</span>
                      <h3 className="font-serif italic font-bold text-lg text-[var(--charcoal-ink)] mt-1 line-clamp-2 group-hover:text-[var(--madder-red)] transition-colors leading-snug">{blog.title}</h3>
                      <p className="font-sans text-xs text-zinc-500 mt-2 line-clamp-3 leading-relaxed">{blog.desc}</p>
                    </div>
                    <Link href="/shop" className="text-xs font-bold text-[var(--madder-red)] hover:text-[var(--charcoal-ink)] transition-colors uppercase tracking-wider block mt-4 pt-2 border-t border-zinc-50">
                      Read Article &rarr;
                    </Link>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* PROFESSIONAL BORDER DIVIDER */}
      <div 
        className="w-full relative z-20 h-32 md:h-40 opacity-90 mix-blend-multiply mt-12 mb-12"
        style={{ backgroundImage: 'url(/images/madhubani_border.png)', backgroundRepeat: 'repeat-x', backgroundSize: 'contain', backgroundPosition: 'center' }}
      />

      {/* 8. CTA BANNER ("Bring every room together") */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={scrollRevealVariants}
        className="relative w-full max-w-5xl mx-auto px-6 pt-24 pb-12"
      >
        <div className="bg-[var(--indigo-dye)] text-[var(--unbleached-cotton)] rounded-2xl p-8 md:p-16 shadow-lg relative overflow-hidden">
          <BackgroundPattern className="opacity-10 stroke-[var(--unbleached-cotton)] mix-blend-overlay" />
          <div className="relative z-10 max-w-2xl space-y-6">
            <span className="text-xs uppercase font-bold tracking-widest text-[var(--turmeric)] opacity-90">Bring every room together</span>
            <h2 className="font-serif italic text-3xl md:text-5xl font-bold leading-tight text-white">
              Get yours - 15% off
            </h2>
            <p className="font-sans text-sm md:text-base opacity-90 leading-relaxed text-[var(--unbleached-cotton)]">
              Experience our latest handloom cotton innovation, delivering exceptional material softness, unbeatable durability, and modern minimalist design.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Link 
                href="/shop" 
                className="px-6 py-3 bg-[var(--madder-red)] text-white hover:bg-[var(--turmeric)] hover:text-[var(--charcoal-ink)] font-sans text-xs uppercase font-bold tracking-widest rounded-lg transition-colors shadow-sm hover:scale-[1.02]"
              >
                Buy now
              </Link>
            </div>
          </div>

        </div>
      </motion.section>

    </main>
  );
}
