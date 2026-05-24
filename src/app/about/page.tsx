"use client";

import React from 'react';
import { motion } from 'framer-motion';
import BackgroundPattern from '@/components/vectors/BackgroundPattern';

export default function AboutPage() {
  const weavers = [
    {
      name: "Smt. Devaki Devi",
      role: "Lead Master Weaver",
      village: "Ranti Village, Mithila",
      bio: "Devaki is a third-generation handloom weaver specialized in the intricate &apos;Bharni&apos; color-fill border style. She has been weaving and training local weavers for over 35 years.",
      img: "https://images.unsplash.com/photo-1583391733958-d25e07fac662?q=80&w=400&auto=format&fit=crop"
    },
    {
      name: "Shri. Ramchandra Paswan",
      role: "Indigo Dye Master",
      village: "Jitwarpur Village",
      bio: "Ramchandra manages our natural vegetable dye baths. He has mastered the art of fermenting wild indigo leaves to create our trademark meditative deep indigo blue shades.",
      img: "https://images.unsplash.com/photo-1598425237654-4c05bf607590?q=80&w=400&auto=format&fit=crop"
    },
    {
      name: "Smt. Shanti Devi",
      role: "Fine Line Artistry Specialist",
      village: "Ranti Village",
      bio: "Shanti specializes in &apos;Kachni&apos; fine line calligraphy. She manually paints highly detailed bird, fish, and lotus motifs onto our handloomed canvas pieces using organic soot ink.",
      img: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=400&auto=format&fit=crop"
    }
  ];

  return (
    <main className="flex-grow w-full bg-[var(--unbleached-cotton)] text-[var(--charcoal-ink)] pt-32 pb-24 font-sans relative overflow-hidden">
      <BackgroundPattern className="opacity-40" />
      <div className="container mx-auto px-6 max-w-6xl relative z-10">
        
        {/* Page Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[var(--madder-red)] font-sans text-xs uppercase tracking-wider font-semibold"
          >
            Our Legacy & Weavers
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-serif italic text-4xl md:text-5xl font-bold"
          >
            The Rhythm of the Loom
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-sans text-sm md:text-base text-zinc-500 leading-relaxed"
          >
            The story of Mithila Enterprises is not measured in fiscal quarters. It is measured in the rhythmic, echoing clack of the wooden shuttle.
          </motion.p>
        </div>

        {/* Section 1: Our Story (Bento structure) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch mb-24">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="sonic-bento-card md:col-span-8 p-8 md:p-12 bg-[var(--charcoal-ink)]/5 backdrop-blur-sm border border-[var(--charcoal-ink)]/10 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <span className="text-[var(--madder-red)] font-sans uppercase text-[10px] tracking-wider font-bold">The Heritage Journey</span>
              <h3 className="font-serif text-3xl italic font-bold text-[var(--charcoal-ink)]">A Living Canvas</h3>
              <p className="font-sans text-sm md:text-base leading-relaxed text-zinc-600 text-justify">
                For generations, the weaving families of Mithila, India, have treated cotton and linen not as commodities, but as canvases. We work directly with these master craftspeople, bridging the gap between isolated artisan guilds and the modern wearer. Every yard of fabric we produce carries the literal fingerprint of the person who made it.
              </p>
              <p className="font-sans text-sm md:text-base leading-relaxed text-zinc-600 text-justify">
                We bring you textiles of quiet luxury—fabrics that feel substantial, breathe effortlessly, and age with grace.
              </p>
            </div>
            <div className="border-t border-zinc-100 pt-6 mt-8 flex flex-wrap gap-8 font-sans text-xs font-bold uppercase tracking-wider text-zinc-400">
              <span>🌾 100% Hand-Woven</span>
              <span>🎨 Natural Pigment Dyes</span>
              <span>🏡 Community Focused</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="sonic-bento-card md:col-span-4 p-8 bg-[var(--charcoal-ink)]/5 backdrop-blur-sm border border-[var(--charcoal-ink)]/10 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <span className="text-[var(--turmeric)] font-sans uppercase text-[10px] tracking-wider font-bold opacity-90">The Weave Quality</span>
              <h3 className="font-serif text-2xl italic font-bold text-[var(--charcoal-ink)]">Profound Physics</h3>
              <p className="font-sans text-xs leading-relaxed text-zinc-600">
                When human hands guide the shuttle, they constantly adjust the tension. This creates minute, intentional variations in the weave. These aren't flaws. They are the breathing spaces that allow the fabric to regulate temperature, to move with the body, and to endure for decades. We do not rush the process. We do not use industrial shortcuts. We honor the raw fiber, the botanical dyes, and the centuries-old techniques of our ancestors.
              </p>
            </div>

            <div className="mt-8 border-t border-zinc-100 pt-6">
              <h4 className="font-sans font-bold text-xs uppercase text-zinc-800">Uncompromised Quality</h4>
              <p className="font-sans text-[10px] text-zinc-400 mt-1">Loomed in Bihar. Shipped worldwide.</p>
            </div>
          </motion.div>

        </div>

        {/* Section 2: Weaver Profiles */}
        <div>
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
            <span className="text-[var(--madder-red)] font-sans uppercase text-xs tracking-wider font-semibold">Meet the Masters</span>
            <h2 className="font-serif italic text-3xl md:text-4xl font-bold text-[var(--charcoal-ink)]">The Hands Behind the Thread</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {weavers.map((weaver, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="polaroid-card group flex flex-col relative pb-8 w-full max-w-sm mx-auto bg-[var(--charcoal-ink)]/5 border border-[var(--charcoal-ink)]/10"
              >
                <div className="aspect-[4/5] bg-neutral-100 rounded-lg overflow-hidden border border-[var(--charcoal-ink)]/5 mb-4">
                  <img src={weaver.img} alt={weaver.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="px-2 space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--madder-red)] block">{weaver.role}</span>
                  <h3 className="font-serif italic font-bold text-xl text-[var(--charcoal-ink)]">{weaver.name}</h3>
                  <p className="font-sans text-[10px] text-zinc-500 uppercase tracking-widest">{weaver.village}</p>
                  <p className="font-sans text-xs leading-relaxed text-zinc-500 pt-3 border-t border-zinc-100 mt-2">
                    {weaver.bio}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
