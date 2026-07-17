"use client";

import { useCart } from "@/store/useCart";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Plus, Minus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";
import { syncCartVariants } from "@/actions/cart";

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { ease: [0.32, 0.72, 0, 1] as any, duration: 0.6 } },
};

export default function CartDrawer() {
  const { isOpen, closeCart, items, updateQuantity, removeItem, syncItems } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    
    // Sync cart with database to ensure MOQ and prices are up to date
    if (items.length > 0) {
      syncCartVariants(items.map(i => i.id)).then(updates => {
        if (updates && updates.length > 0) {
          syncItems(updates);
        }
      });
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            onClick={closeCart}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-md"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
            className="fixed right-0 top-0 z-[70] h-[100dvh] w-full max-w-lg bg-[var(--kora-white)] shadow-2xl flex flex-col border-l-2 border-[var(--charcoal-ink)]"
          >
            {/* Decorative Corner */}
            <div className="absolute top-0 left-0 w-12 h-12 bg-[var(--turmeric)] border-b-2 border-r-2 border-[var(--charcoal-ink)] z-10 hidden sm:block"></div>

            {/* Header */}
            <div className="flex items-center justify-between px-8 py-10 relative z-20">
              <h2 className="font-serif italic text-4xl font-bold tracking-tight text-[var(--charcoal-ink)] sm:ml-4">
                Your Canvas
              </h2>
              <button
                onClick={closeCart}
                className="w-12 h-12 rounded-full border border-[var(--charcoal-ink)]/20 flex items-center justify-center text-[var(--charcoal-ink)] hover:bg-[var(--charcoal-ink)]/5 hover:scale-105 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-8 pb-8">
              {items.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                  className="h-full flex flex-col items-center justify-center text-center space-y-6"
                >
                  <div className="w-24 h-24 rounded-full border border-[var(--charcoal-ink)]/20 bg-[var(--charcoal-ink)]/5 flex items-center justify-center">
                    <span className="text-4xl opacity-50 text-[var(--charcoal-ink)]">✦</span>
                  </div>
                  <div>
                    <p className="font-serif italic text-2xl text-[var(--charcoal-ink)] mb-2">It's quiet here.</p>
                    <p className="font-sans text-xs tracking-widest uppercase opacity-60 text-[var(--charcoal-ink)]">
                      Select a fabric to begin.
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="space-y-6"
                >
                  {items.map((item) => (
                    <motion.div
                      key={item.id}
                      variants={staggerItem}
                      className="relative bg-[var(--unbleached-cotton)] p-1.5 border-2 border-[var(--charcoal-ink)] shadow-[4px_4px_0_var(--turmeric)]"
                    >
                      {/* Inner Box */}
                      <div className="flex gap-4 sm:gap-6 bg-transparent p-2 sm:p-4">
                        <div className="w-20 h-28 sm:w-24 sm:h-32 border-2 border-[var(--charcoal-ink)] bg-[var(--charcoal-ink)]/5 relative shrink-0">
                          {item.image && (
                            <Image src={item.image} alt={item.title} fill className="object-cover" />
                          )}
                        </div>
                        <div className="flex-1 flex flex-col justify-between py-1">
                          <div>
                            <div className="flex justify-between items-start mb-1">
                              <h3 className="font-serif font-bold text-lg sm:text-xl text-[var(--charcoal-ink)] leading-tight pr-4">
                                {item.title}
                              </h3>
                              <button
                                onClick={() => removeItem(item.id)}
                                className="text-[var(--charcoal-ink)]/40 hover:text-[var(--madder-red)] transition-colors p-1"
                              >
                                <Trash2 size={18} strokeWidth={2} />
                              </button>
                            </div>
                            <p className="font-sans text-[10px] uppercase tracking-[0.2em] opacity-80 text-[var(--charcoal-ink)]">
                              {item.color}
                            </p>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-4">
                            <div className="flex flex-col gap-1">
                               {item.min_order_quantity > 1 && (
                                 <span className="text-[9px] uppercase tracking-widest text-[var(--madder-red)] font-bold">MOQ: {item.min_order_quantity}M</span>
                               )}
                               <div className="flex items-center gap-4 bg-[var(--charcoal-ink)]/5 border-2 border-[var(--charcoal-ink)] px-1 py-1 w-fit">
                                 <button
                                   onClick={() => updateQuantity(item.id, Math.max(item.min_order_quantity || 1, item.quantity - 1))}
                                   className="w-6 h-6 sm:w-8 sm:h-8 bg-white border border-[var(--charcoal-ink)] flex items-center justify-center hover:bg-[var(--madder-red)] hover:text-white transition-colors"
                                 >
                                   <Minus size={14} strokeWidth={2.5} />
                                 </button>
                                 <span className="font-sans font-bold text-sm w-4 text-center text-[var(--charcoal-ink)]">
                                   {item.quantity}
                                 </span>
                                 <button
                                   onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                   className="w-6 h-6 sm:w-8 sm:h-8 bg-white border border-[var(--charcoal-ink)] flex items-center justify-center hover:bg-[var(--turmeric)] hover:border-[var(--charcoal-ink)] transition-colors"
                                 >
                                   <Plus size={14} strokeWidth={2.5} />
                                 </button>
                               </div>
                            </div>
                            <p className="font-sans font-bold text-lg text-[var(--charcoal-ink)]">
                              ₹{(item.price * item.quantity).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                className="p-8 pt-6 border-t-2 border-[var(--charcoal-ink)] bg-[var(--kora-white)] z-20 relative"
              >
                <div className="flex items-end justify-between mb-8">
                  <span className="font-sans text-xs uppercase tracking-widest font-bold opacity-80 text-[var(--charcoal-ink)]">
                    Subtotal
                  </span>
                  <span className="font-serif italic text-3xl font-bold text-[var(--charcoal-ink)]">
                    ₹{total.toLocaleString()}
                  </span>
                </div>
                <Link href="/checkout" onClick={closeCart} className="block w-full">
                  <button className="group relative w-full flex items-center justify-between border-2 border-[var(--charcoal-ink)] bg-[var(--turmeric)] text-[var(--charcoal-ink)] p-3 pl-8 transition-colors duration-300 ease-out active:scale-[0.98] hover:bg-[var(--charcoal-ink)] hover:text-[var(--unbleached-cotton)] shadow-[4px_4px_0_var(--charcoal-ink)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]">
                    <span className="text-sm uppercase tracking-widest font-bold">
                      Secure Checkout
                    </span>
                    <div className="w-10 h-10 border-2 border-[var(--charcoal-ink)] bg-white group-hover:bg-[var(--charcoal-ink)] group-hover:border-[var(--unbleached-cotton)] flex items-center justify-center shrink-0 transition-colors duration-300">
                      <svg className="w-5 h-5 text-[var(--charcoal-ink)] group-hover:text-[var(--unbleached-cotton)] transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </div>
                  </button>
                </Link>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
