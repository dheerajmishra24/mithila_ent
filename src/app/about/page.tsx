"use client";

import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import BackgroundPattern from '@/components/vectors/BackgroundPattern';
import Image from 'next/image';

export default function AboutPage() {
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
    <main className="flex-grow w-full bg-[var(--unbleached-cotton)] text-[var(--charcoal-ink)] pt-32 pb-24 font-sans relative overflow-hidden">
      <BackgroundPattern className="opacity-40" />
      <div className="container mx-auto px-6 max-w-6xl relative z-10">
        
        {/* Page Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[var(--madder-red)] font-sans text-xs uppercase tracking-widest font-bold"
          >
            Our Mission & Sourcing
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-serif italic text-5xl md:text-7xl font-bold tracking-tight"
          >
            The Heritage
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-sans text-sm md:text-lg text-zinc-500 leading-relaxed max-w-lg mx-auto"
          >
            We supply the raw materials. You engineer the final form.
          </motion.p>
        </div>

        {/* Layered Heritage Section with Parallax */}
        <section className="relative w-full mb-12 md:mb-8">
          <div className="relative w-full md:w-[70%] h-[400px] md:h-[600px] rounded-2xl overflow-hidden shadow-2xl border border-[var(--charcoal-ink)]/10 z-10">
            <Image src="/images/about/loom.png" alt="Antique Wooden Shuttle Loom" fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--charcoal-ink)]/50 to-transparent mix-blend-multiply" />
          </div>
          
          <motion.div 
            style={{ y: yParallax }}
            className="relative z-20 w-[90%] md:w-[50%] mx-auto md:mr-0 -mt-20 md:-mt-80 bg-white/95 backdrop-blur-2xl p-8 md:p-12 border border-[var(--charcoal-ink)]/10 shadow-[0_30px_60px_rgba(0,0,0,0.1)] rounded-2xl"
          >
            <span className="w-12 h-[2px] bg-[var(--madder-red)] mb-6 block" />
            <span className="text-[var(--turmeric)] font-sans uppercase text-[10px] tracking-wider font-bold block mb-2 opacity-90">The Weave Quality</span>
            <h3 className="font-serif text-3xl md:text-4xl italic font-bold text-[var(--charcoal-ink)] mb-6">Material Physics</h3>
            <p className="font-sans text-sm leading-relaxed text-zinc-600 text-justify mb-4">
              We source, engineer, and supply premium textiles for domestic designers and individual creators. Our entire catalog is built on material physics rather than marketing trends. We focus strictly on the structural integrity, weave density, and tactile properties of our fabrics.
            </p>
            <p className="font-sans text-sm leading-relaxed text-zinc-600 text-justify">
              Every yard of linen, cotton, and wool undergoes rigorous tension and abrasion testing to ensure longevity. We bypass standard chemical finishing processes to preserve the natural memory of the raw fibers. This guarantees that garments constructed from our yardage hold their shape and adapt to the wearer over years of continued use.
            </p>
            <div className="border-t border-zinc-100 pt-6 mt-8 flex flex-wrap gap-6 font-sans text-[10px] font-bold uppercase tracking-widest text-[var(--charcoal-ink)]/50">
              <span>🌾 100% Hand-Woven</span>
              <span>🎨 Natural Pigment Dyes</span>
            </div>
          </motion.div>
        </section>

        {/* Intersecting Process Section */}
        <section className="mb-32">
          <div className="text-center max-w-2xl mx-auto mb-20 space-y-2">
            <span className="text-[var(--madder-red)] font-sans uppercase text-xs tracking-wider font-semibold">The Process</span>
            <h2 className="font-serif italic text-4xl md:text-5xl font-bold text-[var(--charcoal-ink)]">Structural Engineering</h2>
            <p className="font-sans text-sm text-zinc-500 mt-4 leading-relaxed">
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
              <div className="w-full md:w-1/2 flex justify-end">
                <div className="bg-[var(--charcoal-ink)]/5 backdrop-blur-sm p-10 md:p-12 border border-[var(--charcoal-ink)]/10 w-full max-w-md relative z-20 transition-transform duration-700 hover:-translate-y-2">
                  <div className="absolute -left-6 md:-right-6 md:left-auto top-10 w-12 h-[1px] bg-[var(--charcoal-ink)]/30 hidden md:block" />
                  
                  <span className="text-[5rem] leading-none font-serif italic font-bold text-[var(--charcoal-ink)]/10 absolute -top-10 -left-6 select-none pointer-events-none">01</span>
                  <h3 className="font-sans font-bold text-lg uppercase tracking-wider text-[var(--charcoal-ink)] mb-4">Fiber Procurement</h3>
                  <p className="font-sans text-sm leading-relaxed text-zinc-600 text-justify mb-10">
                    We source raw, unbleached flax and high-crimp virgin wool. We strictly select fibers based on tensile strength and climate suitability, avoiding pre-softened or chemically altered crops.
                  </p>
                  
                  <span className="text-[5rem] leading-none font-serif italic font-bold text-[var(--charcoal-ink)]/10 absolute -bottom-10 -right-6 select-none pointer-events-none">02</span>
                  <h3 className="font-sans font-bold text-lg uppercase tracking-wider text-[var(--charcoal-ink)] mb-4 mt-8 pt-8 border-t border-[var(--charcoal-ink)]/10">Tension Weaving</h3>
                  <p className="font-sans text-sm leading-relaxed text-zinc-600 text-justify">
                    Yarns are interlaced on wooden shuttle looms. Human operators manually dictate the warp and weft tension. This creates minute structural variations that allow the final fabric to breathe and flex.
                  </p>
                </div>
              </div>
              <div className="w-full md:w-1/2 relative h-[300px] md:h-[500px] rounded-2xl overflow-hidden shadow-lg z-10 border border-[var(--charcoal-ink)]/10 group">
                <Image src="/images/about/fibers.png" alt="Raw Fibers" fill className="object-cover transition-transform duration-1000 group-hover:scale-105" />
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
              <div className="w-full md:w-1/2 flex justify-start">
                <div className="bg-white/90 backdrop-blur-xl p-10 md:p-12 border border-[var(--charcoal-ink)]/10 w-full max-w-md shadow-2xl relative z-20 transition-transform duration-700 hover:-translate-y-2">
                  <div className="absolute -left-6 top-10 w-12 h-[1px] bg-[var(--charcoal-ink)]/30 hidden md:block" />
                  
                  <span className="text-[5rem] leading-none font-serif italic font-bold text-[var(--charcoal-ink)]/10 absolute -top-10 -right-6 select-none pointer-events-none">03</span>
                  <h3 className="font-sans font-bold text-lg uppercase tracking-wider text-[var(--charcoal-ink)] mb-4">Pigment Binding</h3>
                  <p className="font-sans text-sm leading-relaxed text-zinc-600 text-justify mb-10">
                    The woven yardage is submerged in natural dye vats. Rather than coating the surface, the pigments penetrate deep into the core of the fibers, ensuring the color matures evenly over time.
                  </p>
                  
                  <span className="text-[5rem] leading-none font-serif italic font-bold text-[var(--charcoal-ink)]/10 absolute -bottom-10 -left-6 select-none pointer-events-none">04</span>
                  <h3 className="font-sans font-bold text-lg uppercase tracking-wider text-[var(--charcoal-ink)] mb-4 mt-8 pt-8 border-t border-[var(--charcoal-ink)]/10">Mechanical Finishing</h3>
                  <p className="font-sans text-sm leading-relaxed text-zinc-600 text-justify">
                    We rely entirely on physical abrasion to finish our textiles. Flannels are aggressively brushed to raise an insulating nap, while twills are pressed to lock the diagonal weave matrix.
                  </p>
                </div>
              </div>
              <div className="w-full md:w-1/2 relative h-[300px] md:h-[500px] rounded-2xl overflow-hidden shadow-lg z-10 border border-[var(--charcoal-ink)]/10 group">
                <Image src="/images/about/dyes.png" alt="Botanical Dye Pigments" fill className="object-cover transition-transform duration-1000 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/10 mix-blend-multiply group-hover:bg-transparent transition-colors duration-700" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Section 2: Weaver Profiles */}
        <section>
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
            <span className="text-[var(--madder-red)] font-sans uppercase text-xs tracking-wider font-semibold">Meet the Masters</span>
            <h2 className="font-serif italic text-3xl md:text-4xl font-bold text-[var(--charcoal-ink)]">The Hands Behind the Thread</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 lg:gap-16">
            {weavers.map((weaver, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: idx * 0.15 }}
                className={`polaroid-card group flex flex-col relative pb-8 w-full max-w-sm mx-auto bg-[var(--charcoal-ink)]/5 border border-[var(--charcoal-ink)]/10 ${idx === 1 ? 'md:mt-12' : ''} ${idx === 2 ? 'md:mt-24' : ''}`}
              >
                <div className="aspect-[4/5] bg-neutral-100 rounded-lg overflow-hidden border border-[var(--charcoal-ink)]/5 mb-6 relative">
                  <Image src={weaver.img} alt={weaver.name} fill className="object-cover group-hover:scale-105 transition-transform duration-700" sizes="(max-width: 768px) 100vw, 33vw" />
                </div>
                <div className="px-4 space-y-2 relative z-10 bg-[var(--unbleached-cotton)]/50 backdrop-blur-sm pt-2 -mt-10 mx-2 rounded-lg border border-[var(--charcoal-ink)]/5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--madder-red)] block pt-2">{weaver.role}</span>
                  <h3 className="font-serif italic font-bold text-xl text-[var(--charcoal-ink)]">{weaver.name}</h3>
                  <p className="font-sans text-[10px] text-[var(--charcoal-ink)]/50 uppercase tracking-widest">{weaver.village}</p>
                  <p className="font-sans text-xs leading-relaxed text-zinc-600 pt-3 border-t border-[var(--charcoal-ink)]/10 mt-2 pb-2">
                    {weaver.bio}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
