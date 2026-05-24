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
      q: "What makes your fabrics stand out?",
      a: "Every fabric swatch is loomed by master artisans using unbleached raw organic cotton and linen, then hand-detailed with natural pigments (derived from flowers, seeds, and charcoal ink) inspired by the ancient Madhubani art."
    },
    {
      q: "Are your fabrics compatible with all designs?",
      a: "Absolutely. Our pigments are derived strictly from organic botanical sources—like turmeric for yellow, indigo plants for blue, and madder root for deep red—completely free of synthetic chemicals or heavy metals."
    },
    {
      q: "How long does the weaving process take?",
      a: "We specialize in partnership orders for boutique brands and fashion collectors. Standard weaves take 2-3 weeks, while custom Jamdani layouts can take 4-6 weeks to loom, dry, and cure."
    },
    {
      q: "Are the fabrics waterproof or pre-washed?",
      a: "All organic fabrics are pre-washed and natural-shrunk. They are highly breathable and retain their pigment structure. We recommend gentle hand washing in cold water."
    },
    {
      q: "Do you offer a warranty on organic vegetable dyes?",
      a: "Yes. We offer a lifetime heritage support on dye settings. If properly maintained (dry in shade, pH-neutral detergents), our botanical pigments retain their brilliance for generations."
    }
  ];

  const blogs = [
    {
      title: "Wireless Looms: The Evolution of Shuttle Weaving",
      date: "Feb 1, 2026",
      desc: "Stay updated with the latest trends in organic weaving, handloom innovations, and expert tips to enhance your fabric durability.",
      img: "https://images.unsplash.com/photo-1598425237654-4c05bf607590?q=80&w=400&auto=format&fit=crop"
    },
    {
      title: "Indigo Dyeing and Beyond: Organic Pigment Fermentation",
      date: "Feb 4, 2026",
      desc: "Delving deep into traditional vat indigo fermentation methods and vegetable-based natural dye preservation techniques.",
      img: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=400&auto=format&fit=crop"
    },
    {
      title: "Eco-Friendly Handloom Solutions for Modern Brands",
      date: "Feb 7, 2026",
      desc: "How boutique designers are leveraging organic GOTS certified cotton and fair-trade artisans to build sustainable luxury lines.",
      img: "https://images.unsplash.com/photo-1583391733958-d25e07fac662?q=80&w=400&auto=format&fit=crop"
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
    <main className="flex-grow w-full bg-[var(--unbleached-cotton)] text-zinc-900 pt-32 pb-24 font-sans overflow-x-hidden relative">
      
      {/* 1. HERO SECTION */}
      <section className="relative w-full max-w-7xl mx-auto px-6 py-16 md:py-24 overflow-hidden rounded-3xl">
        <BackgroundPattern className="opacity-60" />
        
        {/* Professional Authentic Mandala */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ ease: "linear", duration: 200, repeat: Infinity }}
          className="absolute -right-[20%] -top-[40%] w-[800px] h-[800px] opacity-25 pointer-events-none z-0 mix-blend-multiply"
        >
          <Image src="/images/madhubani_mandala.png" alt="Authentic Madhubani Mandala" fill className="object-contain" priority />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
          
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
            
            <AnimatedTitle text="Loomed by Hand. Crafted for Life." />

            <motion.h4 
              variants={fadeUpItem}
              className="text-lg md:text-xl font-medium text-zinc-800 leading-snug"
            >
              Feel the distinct crispness of pure linen and the comforting weight of raw cotton against your skin. Every thread holds the tension of the wooden loom, offering a structural integrity that machine-made fabrics simply cannot replicate.
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

          {/* Hero Right Visual (Vibrant bright cotton fabric showcase with floating keyframes) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              y: [0, -12, 0],
              transition: {
                y: {
                  repeat: Infinity,
                  duration: 5,
                  ease: "easeInOut"
                },
                opacity: { duration: 0.8 },
                scale: { type: "spring", bounce: 0.15, duration: 0.8 }
              }
            }}
            className="relative flex justify-center lg:justify-end"
          >
            <div className="relative w-full max-w-[450px] aspect-[4/5] overflow-hidden rounded-2xl border border-[var(--charcoal-ink)]/10 bg-[var(--charcoal-ink)]/5 p-3 shadow-md hover:scale-[1.02] transition-transform duration-500 cursor-pointer">
              <Image 
                src="/images/madhubani_peacock.png" 
                alt="Professional Madhubani Peacock Mural" 
                fill
                className="object-cover object-center rounded-xl" 
                priority
              />
            </div>
          </motion.div>

        </div>
      </section>

      {/* PROFESSIONAL BORDER DIVIDER */}
      <div className="w-full relative z-20 flex justify-center py-8 bg-[var(--unbleached-cotton)] h-24 md:h-32">
        <Image src="/images/madhubani_border.png" alt="Madhubani Border" fill className="object-cover opacity-90 mix-blend-multiply" />
      </div>

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

      {/* 3. DOUBLE COLUMN FEATURES / OVERVIEW */}
      <section className="w-full py-24 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={scrollRevealVariants}
            className="space-y-6"
          >
            <span className="text-[var(--madder-red)] font-sans text-xs uppercase tracking-wider font-semibold">Our latest innovation</span>
            <h2 className="font-serif italic text-3xl md:text-5xl font-bold leading-tight text-[var(--charcoal-ink)]">
              Our latest fabrics combine superior handloom thread density with unmatched organic durability
            </h2>
            <h4 className="font-sans text-base md:text-lg text-zinc-600 font-medium">
              Designed for modern living, this organic weave blends premium comfort with intuitive styling.
            </h4>
            <p className="font-sans text-sm text-zinc-500 leading-relaxed text-justify">
              Every piece of fabric is custom loomed by rural Bihar artisans using traditional warp-weft crossings. This manual control forms a high-density matrix of cotton slubs, bringing rich material texture, longevity, and breathability.
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerGridContainer}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          >
            {/* The Perfect Sound, Anywhere & Smart. Sleek. Powerful copy mapping */}
            <motion.div 
              variants={gridItemVariants}
              whileHover={{ y: -3 }}
              className="sonic-bento-card p-6 flex flex-col justify-between h-80 bg-[var(--charcoal-ink)]/5 border border-[var(--charcoal-ink)]/10"
            >
              <div>
                <span className="text-[var(--madder-red)] font-sans uppercase text-[10px] tracking-wider font-bold">The Perfect Swatch, Anywhere</span>
                <h4 className="font-serif italic font-bold text-lg mt-3 text-[var(--charcoal-ink)]">Satin Weaves</h4>
                <p className="font-sans text-xs text-zinc-500 leading-relaxed mt-2 text-justify">
                  Our organic linen is designed to fill your space with rich, high-fidelity texture—whether you are designing a high-fashion apparel line or decorating your home.
                </p>
              </div>
              <div className="w-full h-24 overflow-hidden rounded-xl border border-zinc-50 mt-4">
                <img src="https://images.unsplash.com/photo-1598425237654-4c05bf607590?q=80&w=300&auto=format&fit=crop" className="w-full h-full object-cover" alt="Satin weaves" />
              </div>
            </motion.div>

            <motion.div 
              variants={gridItemVariants}
              whileHover={{ y: -3 }}
              className="sonic-bento-card p-6 flex flex-col justify-between h-80 bg-[var(--charcoal-ink)]/5 border border-[var(--charcoal-ink)]/10"
            >
              <div>
                <span className="text-[var(--turmeric)] font-sans uppercase text-[10px] tracking-wider font-bold">Smart. Sleek. Powerful.</span>
                <h4 className="font-serif italic font-bold text-lg mt-3 text-[var(--charcoal-ink)]">Jamdani Weaves</h4>
                <p className="font-sans text-xs text-zinc-500 leading-relaxed mt-2 text-justify">
                  Designed for modern living, this organic weave blends premium material softness with intuitive care instructions and raw handloomed structural grace.
                </p>
              </div>
              <div className="w-full h-24 overflow-hidden rounded-xl border border-zinc-50 mt-4">
                <img src="https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=300&auto=format&fit=crop" className="w-full h-full object-cover" alt="Jamdani weaves" />
              </div>
            </motion.div>
          </motion.div>

        </div>
      </section>

      {/* 4. "WHY US" & BENTO STATS GRID (1-to-1 content alignment) */}
      <section className="w-full py-24 bg-[var(--unbleached-cotton)] border-y border-[var(--charcoal-ink)]/10">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-[var(--madder-red)] font-sans text-xs uppercase tracking-wider font-semibold">The Mithila Difference</span>
            <h2 className="font-serif italic text-3xl md:text-4xl font-bold text-[var(--charcoal-ink)]">What makes authentic Indian handloom unique?</h2>
          </div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerGridContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {[
              { stat: "01", title: "The Weave Architecture", desc: "Master artisans in Mithila, India, interlock warp and weft yarns with calculated manual precision, creating microscopic air pockets that ensure maximum breathability in humid climates." },
              { stat: "02", title: "The Botanical Dyes", desc: "We exclusively use natural extracts—fermented indigo, madder root, and turmeric—which bind to natural fibers deeply, aging into a distinguished patina rather than fading." },
              { stat: "03", title: "The Structural Integrity", desc: "Unlike mass-produced textiles that thin after washing, hand-spun cotton and linen fibers swell and soften, gaining strength and drape with every cycle." }
            ].map((item, idx) => (
              <motion.div 
                key={idx}
                variants={gridItemVariants}
                whileHover={{ y: -4 }}
                className="sonic-bento-card p-8 flex flex-col justify-between h-auto min-h-[16rem] bg-[var(--charcoal-ink)]/5 border border-[var(--charcoal-ink)]/10"
              >
                <span className="font-serif italic text-4xl font-bold text-[var(--charcoal-ink)] opacity-20 leading-none mb-4">
                  {item.stat}
                </span>
                <div>
                  <h4 className="font-sans font-bold text-base text-[var(--charcoal-ink)] mb-2">{item.title}</h4>
                  <p className="font-sans text-xs text-[var(--charcoal-ink)]/70 leading-relaxed text-justify">{item.desc}</p>
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
              <img 
                src="https://images.unsplash.com/photo-1583391733958-d25e07fac662?q=80&w=600&auto=format&fit=crop" 
                alt="Intricate Handloom fabric curations" 
                className="w-full h-full object-cover rounded-xl" 
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
      <div className="w-full relative z-20 flex justify-center py-12 bg-[var(--unbleached-cotton)] h-32 md:h-40">
        <Image src="/images/madhubani_border.png" alt="Madhubani Border" fill className="object-cover opacity-90 mix-blend-multiply" />
      </div>

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
