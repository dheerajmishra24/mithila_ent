"use client";

import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function GlobalParallaxBackground() {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  
  const { scrollY } = useScroll();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Smooth scroll
  const smoothScrollY = useSpring(scrollY, {
    stiffness: 40,
    damping: 20,
    mass: 1.2,
  });

  // A subtle, unified parallax transform, perfectly calibrated to the 115vh container
  const yParallax = useTransform(smoothScrollY, [0, 5000], [0, -120]);

  if (!mounted || pathname?.startsWith('/admin')) return null;

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden opacity-100">
      
      {/* SINGLE UNIFIED BACKGROUND */}
      <motion.div 
        style={{ 
          y: yParallax,
          position: 'absolute',
          width: '105vw', // Slightly wider to hide blur edges
          height: '120vh', // Slightly taller to hide blur edges
          left: '-2.5vw', // Offset to center the scaled width
          top: '-10vh', // Offset to center the scaled height
          backgroundImage: 'url(/images/madhubani_premium_bg.png)',
          backgroundSize: 'cover', 
          backgroundRepeat: 'no-repeat', 
          backgroundPosition: 'center center'
        }}
        className="will-change-transform blur-md"
      />

    </div>
  );
}
