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

const slideInLeftVariants = {
  hidden: { opacity: 0, x: -80 },
  visible: { 
    opacity: 1, 
    x: 0, 
    transition: { type: "spring" as const, bounce: 0.1, duration: 1.2 } 
  }
};

const slideInRightVariants = {
  hidden: { opacity: 0, x: 80 },
  visible: { 
    opacity: 1, 
    x: 0, 
    transition: { type: "spring" as const, bounce: 0.1, duration: 1.2 } 
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
    <h1 className="font-serif italic text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] text-zinc-900 flex flex-wrap gap-x-3">
      {words.map((word, idx) => (
        <span key={idx} className="block overflow-hidden relative pb-4 -mb-4 pr-2 -mr-2">
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

export default function HomeClient({ 
  hero, 
  features,
  cta,
  latest 
}: { 
  hero: { title?: string; body?: string; subtitle?: string; button_text?: string; button_link?: string }; 
  features: { title?: string; body?: string; subtitle?: string }; 
  cta: { title?: string; body?: string; subtitle?: string; button_text?: string; button_link?: string }; 
  latest?: any[] 
}) {
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
      img: "/images/about/loom.png",
      slug: "wireless-looms-evolution-of-shuttle-weaving"
    },
    {
      title: "Indigo Dyeing and Beyond: Organic Pigment Fermentation",
      date: "Feb 4, 2026",
      desc: "Delving deep into traditional vat indigo fermentation methods and vegetable-based natural dye preservation techniques.",
      img: "/images/about/dyes.png",
      slug: "indigo-dyeing-organic-pigment-fermentation"
    },
    {
      title: "Eco-Friendly Handloom Solutions for Modern Brands",
      date: "Feb 7, 2026",
      desc: "How boutique designers are leveraging organic GOTS certified cotton and fair-trade artisans to build sustainable luxury lines.",
      img: "/images/about/fibers.png",
      slug: "eco-friendly-handloom-solutions-modern-brands"
    }
  ];

  const brandTags = [
    "100% GOTS Certified Cotton",
    "Hand-Shuttle Looms",
    "Fair-Trade Artisan Guilds",
    "Zero Chemical Curing",
    "Sustainable Livelihoods",
    "100% Pure Linen",
    "Blended Linen",
    "Superior Cottons",
    "Premium Viscose",
    "Lustrous Rayons"
  ];

  return (
    <main className="flex-grow w-full bg-transparent text-zinc-900 pt-20 md:pt-24 lg:pt-24 pb-24 font-sans overflow-x-hidden relative">
      
      {/* 1. HERO SECTION */}
      <section className="relative w-full max-w-7xl mx-auto px-6 pt-4 pb-8 md:pt-6 md:pb-12 rounded-3xl">
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
              {hero.subtitle || "Artisanal Heritage Revival"}
            </motion.span>
            
            <AnimatedTitle text={hero.title || "Premium Textiles Engineered for Living."} />

            <motion.h4 
              variants={fadeUpItem}
              className="text-lg md:text-xl font-medium text-zinc-800 leading-snug"
            >
              {hero.body || "We source and supply heavyweight winter wools and breathable summer linens for domestic designers. Our year-round catalog guarantees exact drape, structural integrity, and long-lasting fabric memory."}
            </motion.h4>
            
            <motion.div 
              variants={fadeUpItem}
              className="flex flex-wrap gap-4 pt-2"
            >
              <Link 
                href={hero.button_link || "/shop"} 
                className="px-6 py-3.5 bg-black hover:bg-zinc-800 text-white font-sans text-xs uppercase font-bold tracking-widest rounded-lg transition-all duration-300 shadow-sm"
              >
                {hero.button_text || "Buy now"}
              </Link>
            </motion.div>
          </motion.div>

          {/* Hero Right Visual (Mandala showcase) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, rotate: 0 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              rotate: 360,
              transition: {
                rotate: { repeat: Infinity, duration: 30, ease: "linear" },
                opacity: { duration: 0.8 },
                scale: { type: "spring", bounce: 0.15, duration: 0.8 }
              }
            }}
            className="hidden lg:flex relative justify-center lg:justify-end w-full"
          >
            <div className="relative w-full max-w-[550px] aspect-square hover:scale-[1.03] transition-transform duration-700 cursor-pointer mix-blend-multiply drop-shadow-sm">
              <Image 
                src="/images/madhubani_mandala.png" 
                alt="Heritage Madhubani Mandala" 
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
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
      <section className="w-full py-8 bg-[#f7f3cc] border-y border-zinc-900/10 overflow-hidden relative">
        <BackgroundPattern className="opacity-10" />
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#f7f3cc] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#f7f3cc] to-transparent z-10 pointer-events-none" />
        
        <div className="container mx-auto px-6 max-w-7xl mb-4">
          <h3 className="font-sans font-bold text-[10px] uppercase tracking-widest text-[var(--charcoal-ink)]/60 text-center">
            Trusted by Thousands, Engineered for Excellence
          </h3>
        </div>

        <div className="flex whitespace-nowrap overflow-hidden relative mt-4">
          {/* Loop items infinitely using Framer Motion */}
          <motion.div 
            animate={{ x: [0, -1200] }}
            transition={{ ease: "linear", duration: 30, repeat: Infinity }}
            className="flex gap-16 whitespace-nowrap font-serif italic text-base text-[var(--charcoal-ink)] font-bold opacity-90"
          >
            {/* Double the array for seamless endless marquee looping */}
            {[...brandTags, ...brandTags].map((tag, idx) => (
              <span key={idx} className="flex items-center gap-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--madder-red)]">
                  <path d="M12 2L2 12l10 10 10-10L12 2z" />
                  <path d="M12 6L6 12l6 6 6-6L12 6z" />
                  <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                </svg>
                <span className="uppercase tracking-widest text-sm">{tag}</span>
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
          <span className="text-[var(--madder-red)] font-sans text-xs uppercase tracking-wider font-semibold">
            {features.subtitle || "Climate Engineering"}
          </span>
          <h2 className="font-serif italic text-3xl md:text-5xl font-bold leading-tight text-[var(--charcoal-ink)]">
            {features?.title || "Fabric Functionality"}
          </h2>
          {features?.body && (
            <p className="font-sans text-sm md:text-base text-zinc-700 leading-relaxed mt-4">
              {features.body}
            </p>
          )}
        </motion.div>
        
        <div className="flex flex-col gap-32 mt-20 max-w-6xl mx-auto relative">
            {/* Spring Row */}
            <div className="relative flex flex-col lg:flex-row items-center group">
              <motion.div 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={slideInLeftVariants}
                className="w-full lg:w-3/5 h-[24rem] md:h-[28rem] relative rounded-[2rem] overflow-hidden shadow-2xl z-10"
              >
                <Image src="/images/fabrics/spring_weave.png" fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover transition-transform duration-[2000ms] group-hover:scale-110" alt="Spring Transition" priority />
              </motion.div>
              
              <motion.div 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={slideInRightVariants}
                className="w-full lg:w-1/2 lg:-ml-24 mt-[-4rem] lg:mt-0 z-20 bg-white p-10 md:p-14 border border-[var(--charcoal-ink)]/10 shadow-2xl rounded-3xl"
              >
                <div className="flex items-center gap-4 mb-4">
                  <span className="w-2 h-2 rounded-full bg-[var(--turmeric)] animate-pulse" />
                  <h4 className="font-serif italic font-bold text-3xl text-[var(--charcoal-ink)]">Spring Transition</h4>
                </div>
                <p className="font-sans text-sm text-zinc-700 leading-relaxed text-justify">
                  Spring requires versatile transitional fabrics. Our light cottons and fine twill weaves provide just enough structure to ward off cool morning breezes while remaining highly breathable as the day warms up. The ideal balance of crispness and comfort, engineered to gracefully navigate fluctuating diurnal temperatures.
                </p>
              </motion.div>
            </div>

            {/* Summer Row */}
            <div className="relative flex flex-col lg:flex-row-reverse items-center group">
              <motion.div 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={slideInRightVariants}
                className="w-full lg:w-3/5 h-[24rem] md:h-[28rem] relative rounded-[2rem] overflow-hidden shadow-2xl z-10"
              >
                <Image src="/images/fabrics/summer_weave.png" fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover transition-transform duration-[2000ms] group-hover:scale-110" alt="Summer Airflow" />
              </motion.div>
              
              <motion.div 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={slideInLeftVariants}
                className="w-full lg:w-1/2 lg:-mr-24 mt-[-4rem] lg:mt-0 z-20 bg-[#1c1917] p-10 md:p-14 border border-white/10 shadow-2xl rounded-3xl"
              >
                <div className="flex items-center gap-4 mb-4">
                  <span className="w-2 h-2 rounded-full bg-[var(--madder-red)] animate-pulse" />
                  <h4 className="font-serif italic font-bold text-3xl text-white">Summer Airflow</h4>
                </div>
                <p className="font-sans text-sm text-zinc-300 leading-relaxed text-justify">
                  Extreme heat demands maximum airflow. Our pure linens and viscose textiles are engineered with open weave structures that physically expel heat and wick moisture away from the body. Designed for weightless draping and rapid evaporation in high humidity, maintaining a dry, structured drape.
                </p>
              </motion.div>
            </div>

            {/* Autumn Row */}
            <div className="relative flex flex-col lg:flex-row items-center group">
              <motion.div 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={slideInLeftVariants}
                className="w-full lg:w-3/5 h-[24rem] md:h-[28rem] relative rounded-[2rem] overflow-hidden shadow-2xl z-10"
              >
                <Image src="/images/fabrics/autumn_weave.png" fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover transition-transform duration-[2000ms] group-hover:scale-110" alt="Autumn Insulation" />
              </motion.div>
              
              <motion.div 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={slideInRightVariants}
                className="w-full lg:w-1/2 lg:-ml-24 mt-[-4rem] lg:mt-0 z-20 bg-white p-10 md:p-14 border border-[var(--charcoal-ink)]/10 shadow-2xl rounded-3xl"
              >
                <div className="flex items-center gap-4 mb-4">
                  <span className="w-2 h-2 rounded-full bg-[var(--turmeric)] animate-pulse" />
                  <h4 className="font-serif italic font-bold text-3xl text-[var(--charcoal-ink)]">Autumn Insulation</h4>
                </div>
                <p className="font-sans text-sm text-zinc-700 leading-relaxed text-justify">
                  As temperatures drop, tactile warmth becomes essential. The raised surface piles of our flannel, corduroy, and suede fabrics act as a windbreak, trapping a light layer of insulating air against the body without the heavy bulk of winter gear. Rich textures that emulate the changing colors of the earth.
                </p>
              </motion.div>
            </div>

            {/* Winter Row */}
            <div className="relative flex flex-col lg:flex-row-reverse items-center group">
              <motion.div 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={slideInRightVariants}
                className="w-full lg:w-3/5 h-[24rem] md:h-[28rem] relative rounded-[2rem] overflow-hidden shadow-2xl z-10"
              >
                <Image src="/images/fabrics/winter_weave.png" fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover transition-transform duration-[2000ms] group-hover:scale-110" alt="Winter Barriers" />
              </motion.div>
              
              <motion.div 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={slideInLeftVariants}
                className="w-full lg:w-1/2 lg:-mr-24 mt-[-4rem] lg:mt-0 z-20 bg-[#1c1917] p-10 md:p-14 border border-white/10 shadow-2xl rounded-3xl"
              >
                <div className="flex items-center gap-4 mb-4">
                  <span className="w-2 h-2 rounded-full bg-[var(--madder-red)] animate-pulse" />
                  <h4 className="font-serif italic font-bold text-3xl text-white">Winter Barriers</h4>
                </div>
                <p className="font-sans text-sm text-zinc-300 leading-relaxed text-justify">
                  Cold weather requires extreme thermal barriers. The dense, intricate structures found in our heavy wool, fleece, and tweed collections physically trap body heat within micro-pockets. Heavyweight density blocks wind penetration for superior insulation against the harshest elements.
                </p>
              </motion.div>
            </div>

          </div>
      </section>

      {/* 4. SHOP BY CATEGORY GRID */}
      <section className="w-full py-24 bg-transparent border-y border-zinc-900/10">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-[var(--madder-red)] font-sans text-xs uppercase tracking-wider font-semibold">The Navigation Grid</span>
            <h2 className="font-serif italic text-3xl md:text-4xl font-bold text-[var(--charcoal-ink)]">Our Range of Fabrics</h2>
          </div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerGridContainer}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {[
              { title: "Linen", desc: "Breathable summer linen by the yard designed for structured warm-weather tailoring.", slug: "linen" },
              { title: "Cotton", desc: "Medium-weight cotton offering superior moisture wicking and crisp garment construction.", slug: "cotton" },
              { title: "Viscose", desc: "High-density viscose fabric yielding a smooth, cooling finish for fluid silhouettes.", slug: "viscose" },
              { title: "Flannel", desc: "Double-brushed cotton flannel engineered for maximum heat retention and tactile softness.", slug: "flannel" },
              { title: "Corduroy", desc: "Durable ribbed corduroy providing deep textural ridges and robust cold-weather insulation.", slug: "corduroy" },
              { title: "Twill", desc: "Tightly bound twill fabric ensuring exceptional tear resistance and structured fall.", slug: "twill" },
              { title: "Suede", desc: "Dense micro-fiber suede offering a luxurious matte finish and substantial hand-feel.", slug: "suede" },
              { title: "Velvet", desc: "Heavy pile velvet woven for light absorption, intense color depth, and tactile warmth.", slug: "velvet" },
              { title: "Wool", desc: "Dense virgin wool textiles guaranteeing maximum thermal insulation and wind resistance.", slug: "wool" },
              { title: "Fleece", desc: "High-loft fleece fabric structured to trap body heat without adding excess weight.", slug: "fleece" },
              { title: "Tweed", desc: "Heavily textured wool tweed crafted for structured outerwear and regional weather defense.", slug: "tweed" }
            ].map((cat, idx) => (
              <Link key={idx} href={`/category/${cat.slug}`} className="block h-full">
              <motion.div
                variants={gridItemVariants}
                whileHover={{ y: -4 }}
                className="sonic-bento-card relative group p-0 flex flex-col h-full overflow-hidden min-h-[18rem] bg-[#f7f3cc] border border-zinc-900/10 hover:border-red-600/50 transition-colors"
              >
                {/* Image Section */}
                <div className="h-44 w-full relative overflow-hidden bg-[var(--unbleached-cotton)]">
                  <Image 
                    src={`/images/fabrics/${cat.slug}.png`} 
                    alt={cat.title} 
                    fill 
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105" 
                  />
                  {/* Subtle gradient overlay to merge image with card body */}
                  <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-zinc-900/10 to-transparent"></div>
                </div>
                
                {/* Text Section */}
                <div className="p-6 flex flex-col justify-between flex-grow">
                  <div>
                    <h4 className="font-serif italic font-bold text-lg text-[var(--charcoal-ink)] mb-2 group-hover:text-[var(--madder-red)] transition-colors">{cat.title}</h4>
                    <p className="font-sans text-xs text-[var(--charcoal-ink)]/70 leading-relaxed text-justify">{cat.desc}</p>
                  </div>

                </div>
              </motion.div>
              </Link>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 5. LATEST COLLECTION */}
      <section className="w-full py-24 bg-transparent">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-[var(--madder-red)] font-sans text-xs uppercase tracking-wider font-semibold">Fresh Arrivals</span>
            <h2 className="font-serif italic text-3xl md:text-4xl font-bold text-[var(--charcoal-ink)]">Latest Collection</h2>
          </div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerGridContainer}
            className="w-full relative bg-[#f7f3cc] border border-[#d5cbb1] shadow-md rounded-[12px] min-h-[500px] flex items-center justify-center p-8 md:p-16 mt-8"
          >
            {/* Elegant Background Texture */}
            <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden rounded-[12px]">
              <BackgroundPattern />
            </div>
            
            <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12 lg:gap-20">
              {/* Left Side: Editorial Typography */}
              <div className="flex-1 space-y-6 text-center md:text-left">
                <div className="inline-flex items-center gap-3 border border-[var(--charcoal-ink)]/20 rounded-full px-4 py-1.5 bg-[var(--charcoal-ink)]/5">
                  <span className="w-2 h-2 rounded-full bg-[var(--turmeric)] animate-pulse" />
                  <span className="text-[var(--charcoal-ink)] text-xs font-bold uppercase tracking-[0.2em]">Spring / Summer 2026</span>
                </div>
                
                <h3 className="font-serif font-bold text-5xl md:text-6xl lg:text-7xl text-[var(--charcoal-ink)] leading-[1.05] tracking-tight">
                  Curating <br/>
                  <span className="italic text-[var(--madder-red)]">the Future</span> <br/>
                  of Fabric.
                </h3>
                
                <p className="font-sans text-base md:text-lg text-[var(--charcoal-ink)]/70 max-w-md mx-auto md:mx-0 leading-relaxed pt-6 border-t border-[var(--charcoal-ink)]/10">
                  Our master weavers are currently curating an exclusive range of sustainable, high-density textiles. Expect rich textures, organic dyes, and uncompromising heritage quality.
                </p>
                
                <div className="pt-4">
                   <Link href="/about" className="sonic-btn-primary inline-flex">
                     Read Our Legacy
                   </Link>
                </div>
              </div>
              
              {/* Right Side: Editorial Image/Shape Collage */}
              <div className="flex-1 w-full relative h-[350px] md:h-[500px] flex items-center justify-center mt-10 md:mt-0">
                <div className="absolute w-[80%] h-[90%] bg-zinc-900/5 border border-zinc-900/20 rounded-t-full rotate-[-6deg] transform origin-bottom" />
                <div className="absolute w-[75%] h-[85%] bg-zinc-900/10 border border-zinc-900/30 rounded-t-full rotate-[4deg] transform origin-bottom overflow-hidden shadow-2xl">
                   <Image 
                     src="/images/hero_desktop.png" 
                     fill 
                     sizes="(max-width: 768px) 100vw, 50vw"
                     className="object-cover opacity-90 mix-blend-multiply filter contrast-125 grayscale" 
                     alt="Coming Soon Texture" 
                   />
                </div>
                <div className="absolute inset-0 flex items-center justify-center z-20">
                   <div className="bg-[#f7f3cc] border-2 border-zinc-900 px-10 py-12 shadow-[8px_8px_0_#1c1917] text-center max-w-[220px] transform -rotate-2">
                      <span className="block font-serif italic text-5xl text-[var(--charcoal-ink)] mb-3">SS/26</span>
                      <span className="block font-sans text-[10px] uppercase tracking-[0.3em] font-bold text-[var(--charcoal-ink)] border-t border-[var(--charcoal-ink)]/20 pt-3">In Progress</span>
                   </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 6. INSIGHTS / WEAVERS' BLOG GRID */}
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
              className="text-zinc-700 font-sans text-sm max-w-md text-center mb-16 leading-relaxed"
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
                      <p className="font-sans text-xs text-zinc-700 mt-2 line-clamp-3 leading-relaxed">{blog.desc}</p>
                    </div>
                    <Link href={`/blog/${blog.slug}`} className="text-xs font-bold text-[var(--madder-red)] hover:text-[var(--charcoal-ink)] transition-colors uppercase tracking-wider block mt-4 pt-2 border-t border-zinc-50">
                      Read Article &rarr;
                    </Link>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* 7. FAQ ACCORDION ("Everything You Need to Know...") */}
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
                      <div className="px-6 pb-6 pt-2 font-sans text-sm text-zinc-700 border-t border-[var(--charcoal-ink)]/10 bg-[var(--charcoal-ink)]/5 leading-relaxed">
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
            <span className="text-xs uppercase font-bold tracking-widest text-zinc-400">
              {cta.subtitle || "Bring every room together"}
            </span>
            <h2 className="font-serif italic text-3xl md:text-5xl font-bold leading-tight">
              {cta?.title || "Get yours - 15% off"}
            </h2>
            <p className="font-sans text-sm md:text-base opacity-80 leading-relaxed">
              {cta?.body || "Experience our latest handloom cotton innovation, delivering exceptional material softness, unbeatable durability, and modern minimalist design."}
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Link 
                href={cta.button_link || "/shop"} 
                className="px-6 py-3 bg-[var(--madder-red)] text-white hover:bg-[var(--turmeric)] hover:text-[var(--charcoal-ink)] font-sans text-xs uppercase font-bold tracking-widest rounded-lg transition-colors shadow-sm hover:scale-[1.02]"
              >
                {cta.button_text || "Buy now"}
              </Link>
            </div>
          </div>

        </div>
      </motion.section>

    </main>
  );
}
