"use client";

import React from 'react';
import { motion } from 'framer-motion';
import BackgroundPattern from '@/components/vectors/BackgroundPattern';

export default function WholesalePage() {
  return (
    <main className="flex-grow w-full bg-transparent text-[var(--charcoal-ink)] pt-32 pb-24 font-sans relative overflow-hidden">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-stretch mt-8">
          
          {/* Left Column: Requirements & Details */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="sonic-bento-card p-8 md:p-12 flex flex-col justify-between bg-[var(--charcoal-ink)]/5 border border-[var(--charcoal-ink)]/10 backdrop-blur-sm"
          >
            <div className="space-y-8">
              <div>
                <span className="text-[var(--madder-red)] font-sans uppercase text-[10px] tracking-wider font-bold">Criteria</span>
                <h3 className="font-serif text-2xl italic font-bold mt-2 text-zinc-950">Account Requirements</h3>
                <p className="font-sans text-xs text-zinc-500 leading-relaxed mt-2 text-justify">
                  Wholesale accounts are strictly reserved for registered businesses and independent designers requiring bulk yardage. Approval grants access to our tiered volume pricing and direct liaison with our master weavers for custom dye runs.
                </p>
              </div>

              <ul className="space-y-4 font-sans text-sm text-[var(--charcoal-ink)] opacity-80">
                <li className="flex items-start">
                  <span className="text-[var(--madder-red)] mr-3 font-bold opacity-100">01.</span>
                  A valid Tax Identification Number or equivalent business registration is mandatory.
                </li>
                <li className="flex items-start">
                  <span className="text-[var(--madder-red)] mr-3 font-bold opacity-100">02.</span>
                  The Minimum Order Quantity (MOQ) is 50 yards per specific textile variant.
                </li>
                <li className="flex items-start">
                  <span className="text-[var(--madder-red)] mr-3 font-bold opacity-100">03.</span>
                  Custom dye runs require a separate consultation and a 100-yard MOQ.
                </li>
              </ul>
            </div>

            <div className="pt-6 border-t border-zinc-200 mt-8">
              <h4 className="font-sans font-bold text-xs uppercase text-zinc-800">Logistics & Freight</h4>
              <p className="font-sans text-xs text-zinc-500 mt-2 leading-relaxed text-justify">
                Heavyweight orders exceeding 100 yards are palletized and shipped via dedicated freight. Standard transit times for domestic freight range from 5 to 7 business days. We ensure all fabric rolls are securely wrapped in climate-resistant casing to prevent moisture penetration during transit.
              </p>
            </div>
          </motion.div>

          {/* Right Column: Application Form */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="sonic-bento-card p-8 md:p-12 bg-[var(--charcoal-ink)]/5 border border-[var(--charcoal-ink)]/10 backdrop-blur-sm flex flex-col justify-between"
          >
            <div className="space-y-6 w-full">
              <h3 className="font-serif text-2xl italic font-bold text-zinc-950">Submit Inquiry</h3>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-sans text-[10px] uppercase font-bold text-zinc-400">Business Name</label>
                    <input type="text" className="sonic-input" placeholder="e.g. Atelier Studios" />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-sans text-[10px] uppercase font-bold text-zinc-400">Tax ID / GST</label>
                    <input type="text" className="sonic-input" placeholder="Registration Number" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-sans text-[10px] uppercase font-bold text-zinc-400">Contact Email</label>
                  <input type="email" className="sonic-input" placeholder="purchasing@domain.com" />
                </div>

                <div className="space-y-1">
                  <label className="block font-sans text-[10px] uppercase font-bold text-zinc-400">Fabric Requirements & Estimated Volume</label>
                  <textarea rows={4} className="sonic-input resize-none" placeholder="Detail your specific textile needs, weight requirements, and expected monthly yardage."></textarea>
                </div>

                <button type="submit" className="sonic-btn-primary w-full text-xs">
                  Submit Application
                </button>
              </form>
            </div>
          </motion.div>

        </div>
      </div>
    </main>
  );
}
