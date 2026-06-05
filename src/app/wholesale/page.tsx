"use client";

import React from 'react';
import { motion } from 'framer-motion';
import BackgroundPattern from '@/components/vectors/BackgroundPattern';

export default function WholesalePage() {
  return (
    <main className="flex-grow w-full bg-[var(--unbleached-cotton)] text-[var(--charcoal-ink)] pt-32 pb-24 font-sans relative overflow-hidden">
      <BackgroundPattern className="opacity-40" />
      <div className="container mx-auto px-6 max-w-5xl relative z-10">
        
        {/* Page Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[var(--madder-red)] font-sans text-xs uppercase tracking-wider font-semibold"
          >
            B2B Procurement
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-serif italic text-4xl md:text-5xl font-bold"
          >
            Wholesale Accounts
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-sans text-sm md:text-base text-zinc-500 leading-relaxed"
          >
            We supply premium, structurally engineered yardage to domestic artisans and premier design houses.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          
          {/* Left Column: Requirements & Details */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-10"
          >
            <div className="space-y-4">
              <h2 className="font-serif italic text-2xl font-bold text-[var(--charcoal-ink)]">Account Requirements</h2>
              <p className="font-sans text-sm leading-relaxed text-zinc-600 text-justify">
                Wholesale accounts are strictly reserved for registered businesses and independent designers requiring bulk yardage. Approval grants access to our tiered volume pricing and direct liaison with our master weavers for custom dye runs.
              </p>
              <ul className="space-y-3 font-sans text-sm text-zinc-600">
                <li className="flex items-start">
                  <span className="text-[var(--madder-red)] mr-3 font-bold">01.</span>
                  A valid Tax Identification Number or equivalent business registration is mandatory.
                </li>
                <li className="flex items-start">
                  <span className="text-[var(--madder-red)] mr-3 font-bold">02.</span>
                  The Minimum Order Quantity (MOQ) is 50 yards per specific textile variant.
                </li>
                <li className="flex items-start">
                  <span className="text-[var(--madder-red)] mr-3 font-bold">03.</span>
                  Custom dye runs require a separate consultation and a 100-yard MOQ.
                </li>
              </ul>
            </div>

            <div className="bg-[var(--charcoal-ink)]/5 p-8 border border-[var(--charcoal-ink)]/10">
              <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-[var(--charcoal-ink)] mb-4">Logistics & Freight</h3>
              <p className="font-sans text-xs leading-relaxed text-zinc-600 text-justify">
                Heavyweight orders exceeding 100 yards are palletized and shipped via dedicated freight. Standard transit times for domestic freight range from 5 to 7 business days. We ensure all fabric rolls are securely wrapped in climate-resistant casing to prevent moisture penetration during transit.
              </p>
            </div>
          </motion.div>

          {/* Right Column: Application Form */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/60 backdrop-blur-md p-8 md:p-10 border border-[var(--charcoal-ink)]/10 shadow-sm rounded-lg"
          >
            <h2 className="font-serif italic text-2xl font-bold text-[var(--charcoal-ink)] mb-6">Submit Inquiry</h2>
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="font-sans text-[10px] font-bold uppercase tracking-widest text-zinc-500">Business Name</label>
                  <input type="text" className="w-full bg-transparent border-b border-zinc-300 py-2 font-sans text-sm text-[var(--charcoal-ink)] focus:outline-none focus:border-[var(--charcoal-ink)] transition-colors" placeholder="e.g. Atelier Studios" />
                </div>
                <div className="space-y-2">
                  <label className="font-sans text-[10px] font-bold uppercase tracking-widest text-zinc-500">Tax ID / GST</label>
                  <input type="text" className="w-full bg-transparent border-b border-zinc-300 py-2 font-sans text-sm text-[var(--charcoal-ink)] focus:outline-none focus:border-[var(--charcoal-ink)] transition-colors" placeholder="Registration Number" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-sans text-[10px] font-bold uppercase tracking-widest text-zinc-500">Contact Email</label>
                <input type="email" className="w-full bg-transparent border-b border-zinc-300 py-2 font-sans text-sm text-[var(--charcoal-ink)] focus:outline-none focus:border-[var(--charcoal-ink)] transition-colors" placeholder="purchasing@domain.com" />
              </div>

              <div className="space-y-2">
                <label className="font-sans text-[10px] font-bold uppercase tracking-widest text-zinc-500">Fabric Requirements & Estimated Volume</label>
                <textarea rows={4} className="w-full bg-transparent border-b border-zinc-300 py-2 font-sans text-sm text-[var(--charcoal-ink)] focus:outline-none focus:border-[var(--charcoal-ink)] transition-colors resize-none" placeholder="Detail your specific textile needs, weight requirements, and expected monthly yardage."></textarea>
              </div>

              <button type="submit" className="w-full bg-[var(--charcoal-ink)] text-white font-sans text-xs font-bold uppercase tracking-widest py-4 mt-4 hover:bg-[var(--madder-red)] transition-colors">
                Submit Application
              </button>
            </form>
          </motion.div>

        </div>
      </div>
    </main>
  );
}
