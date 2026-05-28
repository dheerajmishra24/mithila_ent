"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function ContactPage() {
  const [formState, setFormState] = useState({
    firstName: '',
    lastName: '',
    email: '',
    location: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <main className="flex-grow w-full bg-[var(--unbleached-cotton)] text-[var(--charcoal-ink)] pt-32 pb-24 font-sans relative">
      <div className="container mx-auto px-6 max-w-6xl">
        
        {/* Page Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[var(--madder-red)] font-sans text-xs uppercase tracking-wider font-semibold"
          >
            Connect With Us
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-serif italic text-4xl md:text-5xl font-bold"
          >
            Contact Our Artisans
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-sans text-sm md:text-base text-zinc-500 leading-relaxed"
          >
            You can contact us via email, phone, or by filling out the form on this page. We strive to respond promptly and look forward to connecting with you soon!
          </motion.p>
        </div>

        {/* Dual-column content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-stretch mt-8">
          
          {/* Left Column: Info Card */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="sonic-bento-card p-8 md:p-12 flex flex-col justify-between bg-[var(--charcoal-ink)]/5 border border-[var(--charcoal-ink)]/10 backdrop-blur-sm"
          >
            <div className="space-y-8">
              <div>
                <span className="text-[var(--madder-red)] font-sans uppercase text-[10px] tracking-wider font-bold">Inquiries</span>
                <h3 className="font-serif text-2xl italic font-bold mt-2 text-zinc-950">Write Us</h3>
                <p className="font-sans text-xs text-zinc-500 leading-relaxed mt-2">
                  Have questions about fabric weights, bulk orders, or custom loom settings? Our textile experts are here to assist.
                </p>
              </div>

              <div className="space-y-4 font-sans text-sm">
                <div>
                  <span className="block font-bold text-[10px] uppercase opacity-40">Email Address</span>
                  <a href="mailto:dheeraj.mishra02@gmail.com" className="text-base text-[var(--charcoal-ink)] hover:text-[var(--turmeric)] transition-colors font-medium">
                    dheeraj.mishra02@gmail.com
                  </a>
                </div>
                <div>
                  <span className="block font-bold text-[10px] uppercase opacity-40">Call / WhatsApp</span>
                  <a href="tel:+919818555220" className="text-base text-[var(--charcoal-ink)] hover:text-[var(--turmeric)] transition-colors font-medium">
                    +91 9818555220
                  </a>
                </div>
                <div>
                  <span className="block font-bold text-[10px] uppercase opacity-40">Artisan Workshop</span>
                  <p className="text-zinc-600">Madhubani Village, Mithila Region, Bihar, India</p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-zinc-100 mt-8">
              <h4 className="font-sans font-bold text-xs uppercase text-zinc-800">24/7 Available</h4>
              <p className="font-sans text-xs text-zinc-400 mt-1">We respond to email inquiries within 24 hours.</p>
            </div>
          </motion.div>

          {/* Right Column: Interactive Form */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="sonic-bento-card p-8 md:p-12 bg-[var(--charcoal-ink)]/5 border border-[var(--charcoal-ink)]/10 backdrop-blur-sm flex flex-col justify-between"
          >
            <div className="space-y-6 w-full">
              <h3 className="font-serif text-2xl italic font-bold text-zinc-950">We’d love to hear from you!</h3>
              
              {submitted ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-8 text-center bg-zinc-50 border border-zinc-200 rounded-xl space-y-3"
                >
                  <span className="text-3xl">✉️</span>
                  <h4 className="font-sans text-base font-bold text-zinc-900">Message Received!</h4>
                  <p className="font-sans text-xs text-zinc-500 leading-relaxed">
                    Thank you, {formState.firstName}. Our representative will follow up with you at {formState.email} shortly.
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block font-sans text-[10px] uppercase font-bold text-zinc-400">First Name</label>
                      <input 
                        type="text" 
                        required
                        value={formState.firstName}
                        onChange={(e) => setFormState({...formState, firstName: e.target.value})}
                        className="sonic-input"
                        placeholder="Arpan"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-sans text-[10px] uppercase font-bold text-zinc-400">Last Name</label>
                      <input 
                        type="text" 
                        required
                        value={formState.lastName}
                        onChange={(e) => setFormState({...formState, lastName: e.target.value})}
                        className="sonic-input"
                        placeholder="Tyagi"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-sans text-[10px] uppercase font-bold text-zinc-400">Email Address</label>
                    <input 
                      type="email" 
                      required
                      value={formState.email}
                      onChange={(e) => setFormState({...formState, email: e.target.value})}
                      className="sonic-input"
                      placeholder="example@gmail.com"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-sans text-[10px] uppercase font-bold text-zinc-400">Location / City</label>
                    <input 
                      type="text" 
                      required
                      value={formState.location}
                      onChange={(e) => setFormState({...formState, location: e.target.value})}
                      className="sonic-input"
                      placeholder="New Delhi, India"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-sans text-[10px] uppercase font-bold text-zinc-400">Inquiry Details</label>
                    <textarea 
                      required
                      rows={3}
                      value={formState.message}
                      onChange={(e) => setFormState({...formState, message: e.target.value})}
                      className="sonic-input resize-none"
                      placeholder="Details about your fabric customization, weaving specifications, or quantities..."
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="sonic-btn-primary w-full text-xs"
                  >
                    Submit Request
                  </button>
                </form>
              )}
            </div>
          </motion.div>

        </div>

        {/* FAQ Section (AEO Optimized) */}
        <div className="mt-32 max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[var(--madder-red)] font-sans text-xs uppercase tracking-wider font-semibold">Knowledge Base</span>
            <h2 className="font-serif italic text-3xl font-bold mt-2">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-4">
            <details className="group border border-[var(--charcoal-ink)]/10 bg-[var(--charcoal-ink)]/5 p-6 rounded-xl cursor-pointer sonic-bento-card">
              <summary className="font-sans text-sm font-bold uppercase tracking-wider flex justify-between items-center outline-none">
                How do I tell if linen is 100% pure?
                <span className="group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="pt-4 font-sans text-sm opacity-80 leading-relaxed text-justify">
                Pure linen possesses a distinct, cool touch and a slightly stiff initial drape. Look closely at the surface for "slubs"—small, natural knots or thicker threads running through the weave. When crushed in your hand, genuine linen will crease sharply and retain the fold, whereas synthetic blends will bounce back smoothly.
              </div>
            </details>
            <details className="group border border-[var(--charcoal-ink)]/10 bg-[var(--charcoal-ink)]/5 p-6 rounded-xl cursor-pointer sonic-bento-card">
              <summary className="font-sans text-sm font-bold uppercase tracking-wider flex justify-between items-center outline-none">
                Does handloom cotton shrink?
                <span className="group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="pt-4 font-sans text-sm opacity-80 leading-relaxed text-justify">
                Yes. Authentic handloom cotton fabric will typically shrink between 3% to 5% during the first wash. This occurs because the natural fibers, which are kept under tension on the loom, relax and contract when exposed to water. Always pre-wash your yardage in cold water before cutting or tailoring.
              </div>
            </details>
            <details className="group border border-[var(--charcoal-ink)]/10 bg-[var(--charcoal-ink)]/5 p-6 rounded-xl cursor-pointer sonic-bento-card">
              <summary className="font-sans text-sm font-bold uppercase tracking-wider flex justify-between items-center outline-none">
                Why do botanical dyes bleed initially?
                <span className="group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="pt-4 font-sans text-sm opacity-80 leading-relaxed text-justify">
                Natural botanical dyes, such as pure indigo and madder root, do not use chemical mordants to force the color into the fiber. During the first two to three washes, excess pigment resting on the surface of the yarn will wash away. This is a natural stabilization process. Wash dark handloomed fabrics separately in cold water.
              </div>
            </details>
            <details className="group border border-[var(--charcoal-ink)]/10 bg-[var(--charcoal-ink)]/5 p-6 rounded-xl cursor-pointer sonic-bento-card">
              <summary className="font-sans text-sm font-bold uppercase tracking-wider flex justify-between items-center outline-none">
                Do you sell artisanal textile wholesale for designers?
                <span className="group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="pt-4 font-sans text-sm opacity-80 leading-relaxed text-justify">
                Yes. We supply authentic Indian handloom linen and cotton yardage directly to boutique designers, tailoring houses, and sustainable fashion labels globally. We require a minimum order quantity (MOQ) of 20 meters per colorway for wholesale pricing. Contact us directly to request swatch books and wholesale rate cards.
              </div>
            </details>
            <details className="group border border-[var(--charcoal-ink)]/10 bg-[var(--charcoal-ink)]/5 p-6 rounded-xl cursor-pointer sonic-bento-card">
              <summary className="font-sans text-sm font-bold uppercase tracking-wider flex justify-between items-center outline-none">
                What makes handloomed fabric more breathable than machine-made fabric?
                <span className="group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="pt-4 font-sans text-sm opacity-80 leading-relaxed text-justify">
                Machine looms apply extreme, uniform tension to yarns, packing them tightly together. Handlooms operate at a lower, variable tension controlled by the artisan's physical strength. This manual process leaves microscopic spaces between the warp and weft threads, allowing air to circulate freely through the fabric.
              </div>
            </details>
          </div>
        </div>

      </div>
    </main>
  );
}
