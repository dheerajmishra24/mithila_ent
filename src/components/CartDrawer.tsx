"use client";

import { useCart } from "@/store/useCart";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Plus, Minus } from "lucide-react";
import { Button } from "./ui/Button";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function CartDrawer() {
  const { isOpen, closeCart, items, updateQuantity, removeItem } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
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
            onClick={closeCart}
            className="fixed inset-0 z-[60] bg-[var(--charcoal-ink)]/50 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 z-[70] h-full w-full max-w-md bg-[var(--unbleached-cotton)] shadow-2xl flex flex-col border-l-2 border-[var(--charcoal-ink)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b-4 border-[var(--charcoal-ink)] bg-[var(--lotus-pink)] text-white">
              <h2 className="font-serif text-3xl font-bold tracking-tight">Your Canvas</h2>
              <button onClick={closeCart} className="hover:text-[var(--turmeric)] hover:rotate-90 transition-all duration-300">
                <X size={28} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  {/* Playful Bouncing Motif Placeholder for Empty Cart */}
                  <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                    className="w-24 h-24 hand-drawn-border bg-[var(--turmeric)] opacity-80 mb-6 flex items-center justify-center"
                  >
                    <span className="text-4xl">🐟</span>
                  </motion.div>
                  <p className="font-serif text-2xl font-bold text-[var(--peacock-blue)]">Your canvas is empty.</p>
                  <p className="font-sans text-sm mt-2 opacity-70">Fill it with the vibrant colors of Mithila!</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="flex gap-4 border-b-2 border-[var(--charcoal-ink)]/20 pb-6">
                    <div className="w-24 h-32 bg-[var(--unbleached-cotton)] rounded-sm overflow-hidden flex-shrink-0 border border-[var(--charcoal-ink)]/10">
                      {/* Image placeholder */}
                      <div className="w-full h-full bg-[var(--charcoal-ink)]/5"></div>
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-serif font-bold text-lg text-[var(--charcoal-ink)]">{item.title}</h3>
                        <p className="font-sans text-sm opacity-70">Color: {item.color}</p>
                        <p className="font-sans font-bold mt-1 text-[var(--madder-red)]">₹{item.price}</p>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center border-2 border-[var(--charcoal-ink)] rounded-sm">
                          <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="p-1 hover:bg-[var(--turmeric)] transition-colors">
                            <Minus size={16} />
                          </button>
                          <span className="px-4 font-sans font-bold">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 hover:bg-[var(--turmeric)] transition-colors">
                            <Plus size={16} />
                          </button>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="text-[var(--charcoal-ink)] hover:text-[var(--madder-red)] transition-colors p-2">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-6 border-t-2 border-[var(--charcoal-ink)] bg-[var(--unbleached-cotton)]">
                <div className="flex items-center justify-between font-serif text-xl font-bold mb-6">
                  <span>Subtotal</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
                <Link href="/checkout" onClick={closeCart}>
                  <Button className="w-full text-lg">Secure Checkout</Button>
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
