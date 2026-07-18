"use client";

import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import BackgroundPattern from '@/components/vectors/BackgroundPattern';
import Image from 'next/image';

export default function AboutClient({ 
  intro,
  mission,
  heritage
}: { 
  intro: { title?: string; body?: string };
  mission: { title?: string; body?: string };
  heritage: { title?: string; body?: string };
}) {
  const { scrollYProgress } = useScroll();
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, -100]);

  const weavers = [
    {
      name: "Smt. Devaki Devi",
      role: "Lead Master Weaver",
      village: "Ranti Village, Mithila",
      bio: "Devaki is a third-generation handloom weaver specialized in the intricate 'Bharni' color-fill border style. She has been weaving and training local weavers for over 35 years.",
      img: "/images/weavers/devaki.png"
    },
    {
      name: "Shri. Ramchandra Paswan",
      role: "Indigo Dye Master",
      village: "Jitwarpur Village",
      bio: "Ramchandra manages our natural vegetable dye baths. He has mastered the art of fermenting wild indigo leaves to create our trademark meditative deep indigo blue shades.",
      img: "/images/weavers/ramchandra.png"
    },
    {
      name: "Smt. Shanti Devi",
      role: "Fine Line Artistry Specialist",
      village: "Ranti Village",
      bio: "Shanti specializes in 'Kachni' fine line calligraphy. She manually paints highly detailed bird, fish, and lotus motifs onto our handloomed canvas pieces using organic soot ink.",
      img: "/images/weavers/shanti.png"
    }
  ];

  return (
    <main className="flex-grow w-full bg-transparent text-[var(--charcoal-ink)] pt-32 pb-24 font-sans relative overflow-hidden">
      <BackgroundPattern className="opacity-40" />
      <div className="container mx-auto px-6 max-w-6xl relative z-10">
        
        {/* Page Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[var(--madder-red)] font-sans text-xs uppercase tracking-widest font-bold"
          >
            {mission.title || "Our Mission & Sourcing"}
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-serif italic text-5xl md:text-7xl font-bold tracking-tight"
          >
            {intro.title || 'The Heritage'}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-sans text-sm md:text-lg text-zinc-500 leading-relaxed max-w-lg mx-auto"
          >
            {intro.body || 'We supply the raw materials. You engineer the final form.'}
          </motion.p>
        </div>

        {/* Layered Heritage Section with Parallax */}
        <section className="relative w-full mb-12 md:mb-8">
          <div className="relative w-full md:w-[70%] h-[400px] md:h-[600px] rounded-2xl overflow-hidden shadow-2xl border border-[var(--charcoal-ink)]/10 z-10">
            <Image src="/images/about/loom.png" alt="Antique Wooden Shuttle Loom" fill sizes="(max-width: 768px) 100vw, 70vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--charcoal-ink)]/50 to-transparent mix-blend-multiply" />
          </div>
          
          <motion.div 
            style={{ y: yParallax }}
            className="relative z-20 w-[90%] md:w-[50%] mx-auto md:mr-0 -mt-20 md:-mt-80 bg-white/95 backdrop-blur-2xl p-8 md:p-12 border border-[var(--charcoal-ink)]/10 shadow-[0_30px_60px_rgba(0,0,0,0.1)] rounded-2xl"
          >
            <span className="w-12 h-[2px] bg-[var(--madder-red)] mb-6 block" />
            <span className="text-[var(--turmeric)] font-sans uppercase text-[10px] tracking-wider font-bold block mb-2 opacity-90">The Weave Quality</span>
            <h3 className="font-serif text-3xl md:text-4xl italic font-bold text-[var(--charcoal-ink)] mb-6">
              {heritage.title || "Material Physics"}
            </h3>
            <p className="font-sans text-sm leading-relaxed text-zinc-600 text-justify mb-4 whitespace-pre-wrap">
              {heritage.body || "We source, engineer, and supply premium textiles for domestic designers, individual creators and export companies. Our entire catalog is built on material physics rather than marketing trends. We focus strictly on the structural integrity, weave density, and tactile properties of our fabrics.\n\nEvery yard of linen, cotton, and wool undergoes rigorous tension and abrasion testing to ensure longevity. We bypass standard chemical finishing processes to preserve the natural memory of the raw fibers. This guarantees that garments constructed from our yardage hold their shape and adapt to the wearer over years of continued use."}
            </p>
            <div className="border-t border-zinc-100 pt-6 mt-8 flex flex-wrap gap-6 font-sans text-[10px] font-bold uppercase tracking-widest text-[var(--charcoal-ink)]/50">
              <span>🌾 100% Hand-Woven</span>
              <span>🎨 Natural Pigment Dyes</span>
            </div>
          </motion.div>
        </section>

        {/* Our Journey Section */}
        <section className="mb-32">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
            <span className="text-[var(--madder-red)] font-sans uppercase text-xs tracking-wider font-semibold">The Legacy</span>
            <h2 className="font-serif italic text-4xl md:text-5xl font-bold text-[var(--charcoal-ink)]">Our Journey</h2>
            <p className="font-sans text-sm mt-4 leading-relaxed" style={{ color: 'lab(2 0.16 -0.58)' }}>
              From our humble beginnings in Delhi to catering pan-India, our commitment to quality textiles has remained unwavering for over four decades.
            </p>
          </div>

          <div className="relative w-full max-w-4xl mx-auto font-sans">
            {/* Timeline Line */}
            <div className="absolute left-[20px] md:left-[50%] top-0 bottom-0 w-[2px] bg-[var(--charcoal-ink)]/10" />

            <div className="space-y-12 relative">
              {/* 1979 */}
              <div className="flex flex-col md:flex-row items-start md:items-center w-full">
                <div className="hidden md:block w-1/2 pr-12 text-right">
                  <h3 className="font-serif italic text-2xl font-bold text-[var(--charcoal-ink)]">1979</h3>
                  <span className="text-xs uppercase tracking-widest text-[var(--madder-red)] font-bold">The Foundation</span>
                </div>
                <div className="absolute left-[15px] md:left-[50%] transform -translate-x-[50%] w-3 h-3 rounded-full bg-[var(--turmeric)] ring-4 ring-[#f7f3cc] shadow-sm" />
                <div className="w-full md:w-1/2 pl-12 md:pl-12">
                  <div className="md:hidden mb-2">
                     <h3 className="font-serif italic text-2xl font-bold text-[var(--charcoal-ink)]">1979</h3>
                     <span className="text-xs uppercase tracking-widest text-[var(--madder-red)] font-bold">The Foundation</span>
                  </div>
                  <div className="bg-[#f0ecd8]/50 p-6 rounded-lg border border-[var(--charcoal-ink)]/5">
                    <p className="text-sm text-zinc-600 leading-relaxed mb-3">
                      The story of Mithila Enterprises began when <strong>Mr. P.N. Mishra</strong> traveled to Delhi from a small town in Bihar with just ₹25 in his pocket. Driven by sheer determination, he started small but dreamed big.
                    </p>
                    <p className="text-sm text-zinc-600 leading-relaxed">
                      He officially founded the company in 1979, operating out of our first registered office at X-3458/7, Street-1, Raghubar Pura-2, Gandhi Nagar, Delhi - 110031. From these humble beginnings, he steadily expanded the business, eventually supplying premium textiles pan-India.
                    </p>
                  </div>
                </div>
              </div>

              {/* 1997-2007 */}
              <div className="flex flex-col md:flex-row items-start md:items-center w-full">
                <div className="w-full md:w-1/2 pl-12 md:pl-0 md:pr-12 md:text-right order-2 md:order-1">
                  <div className="md:hidden mb-2">
                     <h3 className="font-serif italic text-2xl font-bold text-[var(--charcoal-ink)]">1997 - 2007</h3>
                     <span className="text-xs uppercase tracking-widest text-[var(--madder-red)] font-bold">Expansion</span>
                  </div>
                  <div className="bg-[#f0ecd8]/50 p-6 rounded-lg border border-[var(--charcoal-ink)]/5 inline-block text-left w-full">
                    <p className="text-sm text-zinc-600 leading-relaxed">
                      As demand for our premium woven yardage grew, we significantly expanded our storage and distribution capabilities by opening our first major warehouse in Okhla.
                    </p>
                  </div>
                </div>
                <div className="absolute left-[15px] md:left-[50%] transform -translate-x-[50%] w-3 h-3 rounded-full bg-[var(--indigo-dye)] ring-4 ring-[#f7f3cc] shadow-sm order-1 md:order-2" />
                <div className="hidden md:block w-1/2 pl-12 order-3">
                  <h3 className="font-serif italic text-2xl font-bold text-[var(--charcoal-ink)]">1997 - 2007</h3>
                  <span className="text-xs uppercase tracking-widest text-[var(--madder-red)] font-bold">Expansion</span>
                </div>
              </div>

              {/* 2007 - Present */}
              <div className="flex flex-col md:flex-row items-start md:items-center w-full">
                <div className="hidden md:block w-1/2 pr-12 text-right">
                  <h3 className="font-serif italic text-2xl font-bold text-[var(--charcoal-ink)]">2007 - Present</h3>
                  <span className="text-xs uppercase tracking-widest text-[var(--madder-red)] font-bold">New Generation</span>
                </div>
                <div className="absolute left-[15px] md:left-[50%] transform -translate-x-[50%] w-3 h-3 rounded-full bg-[var(--charcoal-ink)] ring-4 ring-[#f7f3cc] shadow-sm" />
                <div className="w-full md:w-1/2 pl-12 md:pl-12">
                  <div className="md:hidden mb-2">
                     <h3 className="font-serif italic text-2xl font-bold text-[var(--charcoal-ink)]">2007 - Present</h3>
                     <span className="text-xs uppercase tracking-widest text-[var(--madder-red)] font-bold">New Generation</span>
                  </div>
                  <div className="bg-[#f0ecd8]/50 p-6 rounded-lg border border-[var(--charcoal-ink)]/5">
                    <p className="text-sm text-zinc-600 leading-relaxed">
                      We relocated our primary operations to TA-106, Okhla Estate Marg, Tughlakabad Extension, Kalkaji, New Delhi - 110019. In this milestone year, <strong>Mr. Dheeraj Mishra</strong> (son of Mr. P.N. Mishra) officially joined the business, bringing modern logistics to our pan-India network.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Intersecting Process Section */}
        <section className="mb-32">
          <div className="text-center max-w-2xl mx-auto mb-20 space-y-2">
            <span className="text-[var(--madder-red)] font-sans uppercase text-xs tracking-wider font-semibold">The Process</span>
            <h2 className="font-serif italic text-4xl md:text-5xl font-bold text-[var(--charcoal-ink)]">Structural Engineering</h2>
            <p className="font-sans text-sm mt-4 leading-relaxed" style={{ color: 'lab(2 0.16 -0.58)' }}>
              We reject industrial mass-production. Every yard of textile is physically constructed through a four-stage mechanical process designed to maximize durability.
            </p>
          </div>

          <div className="relative w-full max-w-5xl mx-auto">
            {/* Central Vertical Connector Line for Desktop */}
            <div className="absolute left-[50%] top-0 bottom-0 w-[1px] bg-[var(--charcoal-ink)]/10 hidden md:block" />

            {/* Step 1 & 2 Block */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="flex flex-col md:flex-row items-center gap-12 mb-24 relative"
            >
              <div className="w-full md:w-1/2 flex justify-end order-2 md:order-1">
                <div className="bg-[#f0ecd8]/80 backdrop-blur-xl p-10 md:p-12 border border-[var(--charcoal-ink)]/10 w-full max-w-md shadow-2xl relative z-20 transition-transform duration-700 hover:-translate-y-2">
                  <div className="absolute -right-6 top-10 w-12 h-[1px] bg-[var(--charcoal-ink)]/30 hidden md:block" />
                  
                  <span className="text-[5rem] leading-none font-serif italic font-bold text-[var(--charcoal-ink)]/10 absolute -top-10 -left-6 select-none pointer-events-none">01</span>
                  <h3 className="font-sans font-bold text-lg uppercase tracking-wider text-[var(--charcoal-ink)] mb-4">Fiber Procurement</h3>
                  <p className="font-sans text-sm leading-relaxed text-justify mb-10" style={{ color: 'lab(2 0.16 -0.58)' }}>
                    We source raw, unbleached flax and high-crimp virgin wool. We strictly select fibers based on tensile strength and climate suitability, avoiding pre-softened or chemically altered crops.
                  </p>
                  
                  <span className="text-[5rem] leading-none font-serif italic font-bold text-[var(--charcoal-ink)]/10 absolute -bottom-10 -right-6 select-none pointer-events-none">02</span>
                  <h3 className="font-sans font-bold text-lg uppercase tracking-wider text-[var(--charcoal-ink)] mb-4 mt-8 pt-8 border-t border-[var(--charcoal-ink)]/10">Tension Weaving</h3>
                  <p className="font-sans text-sm leading-relaxed text-justify" style={{ color: 'lab(2 0.16 -0.58)' }}>
                    Yarns are interlaced on wooden shuttle looms. Human operators manually dictate the warp and weft tension. This creates minute structural variations that allow the final fabric to breathe and flex.
                  </p>
                </div>
              </div>
              <div className="w-full md:w-1/2 relative h-[300px] md:h-[500px] rounded-2xl overflow-hidden shadow-lg z-10 border border-[var(--charcoal-ink)]/10 group order-1 md:order-2">
                <Image src="/images/about/fibers.png" alt="Raw Fibers" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition-transform duration-1000 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/10 mix-blend-multiply group-hover:bg-transparent transition-colors duration-700" />
              </div>
            </motion.div>

            {/* Step 3 & 4 Block */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="flex flex-col md:flex-row-reverse items-center gap-12 relative"
            >
              <div className="w-full md:w-1/2 flex justify-start order-2 md:order-1">
                <div className="bg-white/90 backdrop-blur-xl p-10 md:p-12 border border-[var(--charcoal-ink)]/10 w-full max-w-md shadow-2xl relative z-20 transition-transform duration-700 hover:-translate-y-2">
                  <div className="absolute -left-6 top-10 w-12 h-[1px] bg-[var(--charcoal-ink)]/30 hidden md:block" />
                  
                  <span className="text-[5rem] leading-none font-serif italic font-bold text-[var(--charcoal-ink)]/10 absolute -top-10 -right-6 select-none pointer-events-none">03</span>
                  <h3 className="font-sans font-bold text-lg uppercase tracking-wider text-[var(--charcoal-ink)] mb-4">Pigment Binding</h3>
                  <p className="font-sans text-sm leading-relaxed text-justify mb-10" style={{ color: 'lab(2 0.16 -0.58)' }}>
                    The woven yardage is submerged in natural dye vats. Rather than coating the surface, the pigments penetrate deep into the core of the fibers, ensuring the color matures evenly over time.
                  </p>
                  
                  <span className="text-[5rem] leading-none font-serif italic font-bold text-[var(--charcoal-ink)]/10 absolute -bottom-10 -left-6 select-none pointer-events-none">04</span>
                  <h3 className="font-sans font-bold text-lg uppercase tracking-wider text-[var(--charcoal-ink)] mb-4 mt-8 pt-8 border-t border-[var(--charcoal-ink)]/10">Mechanical Finishing</h3>
                  <p className="font-sans text-sm leading-relaxed text-justify" style={{ color: 'lab(2 0.16 -0.58)' }}>
                    We rely entirely on physical abrasion to finish our textiles. Flannels are aggressively brushed to raise an insulating nap, while twills are pressed to lock the diagonal weave matrix.
                  </p>
                </div>
              </div>
              <div className="w-full md:w-1/2 relative h-[300px] md:h-[500px] rounded-2xl overflow-hidden shadow-lg z-10 border border-[var(--charcoal-ink)]/10 group order-1 md:order-2">
                <Image src="/images/about/loom.png" alt="Finishing" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition-transform duration-1000 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/10 mix-blend-multiply group-hover:bg-transparent transition-colors duration-700" />
              </div>
            </motion.div>
          </div>
        </section>



      </div>
    </main>
  );
}
