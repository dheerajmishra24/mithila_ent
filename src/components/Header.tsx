"use client";

import Link from 'next/link';
import { ShoppingCart, User, Menu, Search } from 'lucide-react';
import { useCart } from '@/store/useCart';
import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function Header() {
  const { openCart, items } = useCart();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 w-full bg-[var(--unbleached-cotton)]/90 backdrop-blur-md transition-all duration-300 ${
        scrolled ? 'py-3 shadow-sm' : 'py-5'
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

      <div className="container mx-auto flex items-center justify-between px-6 max-w-7xl relative z-10">
        
        {/* Logo & Identity */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-full bg-[var(--madder-red)] flex items-center justify-center text-white font-bold font-serif text-sm transition-transform group-hover:scale-105 shadow-sm">
            M
          </div>
          <span className="font-serif italic font-bold text-lg tracking-tight text-[var(--indigo-dye)] group-hover:text-[var(--madder-red)] transition-colors">
            Mithila
          </span>
          <span className="font-sans text-[9px] uppercase tracking-widest text-[var(--charcoal-ink)] opacity-70 font-bold border-l border-[var(--charcoal-ink)]/20 pl-2">
            Enterprises
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 font-sans font-medium text-sm text-zinc-600">
          {[
            ['Shop Fabrics', '/shop'],
            ['Our Story', '/about'],
            ['Features', '/#features'],
            ['Contact', '/contact']
          ].map(([label, href]) => (
            <Link 
              key={label} 
              href={href} 
              className="hover:text-[var(--madder-red)] transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Action Triggers */}
        <div className="flex items-center gap-4 text-zinc-700">
          <Link href="/shop" className="p-2 hover:text-[var(--madder-red)] transition-colors">
            <Search size={18} strokeWidth={2} />
          </Link>
          
          <Link href="/login" className="p-2 hover:text-[var(--madder-red)] transition-colors">
            <User size={18} strokeWidth={2} />
          </Link>
          
          <button 
            onClick={openCart} 
            className="p-2 hover:text-[var(--madder-red)] transition-colors relative"
          >
            <ShoppingCart size={18} strokeWidth={2} />
            {mounted && itemCount > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--turmeric)] text-[8px] font-bold text-black border border-[var(--charcoal-ink)]">
                {itemCount}
              </span>
            )}
          </button>
          
          <button className="md:hidden p-2 hover:text-[var(--madder-red)]">
            <Menu size={20} strokeWidth={2} />
          </button>
        </div>

      </div>
    </header>
  );
}
