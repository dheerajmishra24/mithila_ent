"use client";

import Link from 'next/link';
import { ShoppingCart, User, Menu, Search, X } from 'lucide-react';
import { useCart } from '@/store/useCart';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function Header() {
  const { openCart, items } = useCart();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const navLinks = [
    ['Shop Fabrics', '/shop'],
    ['Our Story', '/about'],
    ['Wholesale', '/wholesale'],
    ['Contact', '/contact']
  ];

  return (
    <>
      <header 
        className={`fixed top-0 left-0 right-0 z-40 w-full bg-[var(--unbleached-cotton)]/90 backdrop-blur-md transition-all duration-300 ${
          scrolled ? 'py-2 shadow-sm' : 'py-4'
        }`}
      >
        {/* Thin Madhubani border strip matching the rest of the page */}
        <div className="absolute bottom-0 left-0 right-0 h-[6px] w-full overflow-hidden">
          <svg width="100%" height="6" preserveAspectRatio="none" className="w-full">
            <defs>
              <pattern id="header-triangle" width="10" height="6" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0.5" x2="10" y2="0.5" stroke="var(--text-primary)" strokeWidth="0.5" />
                <line x1="0" y1="5.5" x2="10" y2="5.5" stroke="var(--text-primary)" strokeWidth="0.5" />
                <polygon points="0,1 5,5 10,1" fill="var(--madder-red)" stroke="var(--text-primary)" strokeWidth="0.5" />
                <polygon points="0,5 5,1 10,5" fill="var(--turmeric)" stroke="var(--text-primary)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="6" fill="url(#header-triangle)" />
          </svg>
        </div>

        <div className="container mx-auto flex items-center justify-between px-4 md:px-8 max-w-7xl relative z-10">
          
          {/* Logo & Identity */}
          <Link href="/" className="flex items-center gap-2 group min-h-[48px] py-1">
            <div className="w-8 h-8 rounded-full bg-[var(--madder-red)] flex items-center justify-center text-white font-bold font-serif text-sm transition-transform group-hover:scale-105 shadow-sm">
              M
            </div>
            <span className="font-serif italic font-bold text-lg tracking-tight text-[var(--indigo-dye)] transition-colors">
              Mithila
            </span>
            <span className="font-sans text-[9px] uppercase tracking-widest text-[var(--charcoal-ink)] opacity-70 font-bold border-l border-[var(--charcoal-ink)]/20 pl-2 hidden sm:block">
              Enterprises
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 font-sans font-bold text-xs uppercase tracking-wider text-[var(--charcoal-ink)]">
            {navLinks.map(([label, href]) => (
              <Link 
                key={label} 
                href={href} 
                className="hover:text-[var(--madder-red)] transition-colors py-2"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Action Triggers - Mobile First 48px touch targets */}
          <div className="flex items-center gap-1 sm:gap-2 text-[var(--charcoal-ink)]">
            <Link href="/shop" className="w-12 h-12 flex items-center justify-center hover:text-[var(--madder-red)] transition-colors" aria-label="Search">
              <Search size={20} strokeWidth={2} />
            </Link>
            
            <Link href="/login" className="w-12 h-12 hidden sm:flex items-center justify-center hover:text-[var(--madder-red)] transition-colors" aria-label="User Account">
              <User size={20} strokeWidth={2} />
            </Link>
            
            <button 
              onClick={openCart} 
              className="w-12 h-12 flex items-center justify-center hover:text-[var(--madder-red)] transition-colors relative"
              aria-label="Open Cart"
            >
              <ShoppingCart size={20} strokeWidth={2} />
              {mounted && itemCount > 0 && (
                <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--turmeric)] text-[8px] font-bold text-[var(--charcoal-ink)] border border-[var(--charcoal-ink)]">
                  {itemCount}
                </span>
              )}
            </button>
            
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="w-12 h-12 flex md:hidden items-center justify-center hover:text-[var(--madder-red)] transition-colors"
              aria-label="Open Menu"
            >
              <Menu size={24} strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      {/* Full Screen Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: "-100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-[var(--unbleached-cotton)] flex flex-col px-6 pt-6 pb-12 overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-12 border-b border-[var(--charcoal-ink)]/10 pb-4">
              <span className="font-serif italic font-bold text-2xl text-[var(--charcoal-ink)]">Menu</span>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="w-12 h-12 flex items-center justify-end text-[var(--charcoal-ink)] hover:text-[var(--madder-red)]"
                aria-label="Close Menu"
              >
                <X size={28} strokeWidth={2} />
              </button>
            </div>

            <nav className="flex flex-col gap-6">
              {navLinks.map(([label, href], i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                >
                  <Link 
                    href={href} 
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-3xl font-serif italic font-bold text-[var(--charcoal-ink)] hover:text-[var(--madder-red)] transition-colors block py-2"
                  >
                    {label}
                  </Link>
                </motion.div>
              ))}
              
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8 pt-8 border-t border-[var(--charcoal-ink)]/10"
              >
                <Link 
                  href="/login" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-4 text-xl font-sans font-bold text-[var(--charcoal-ink)] py-4"
                >
                  <User size={24} />
                  <span>Account Login</span>
                </Link>
              </motion.div>
            </nav>
            
            <div className="mt-auto pt-12">
              <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Mithila Enterprises © 2026</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
