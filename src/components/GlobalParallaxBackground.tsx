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

  // A single, unified parallax transform
  const yParallax = useTransform(smoothScrollY, [0, 5000], [0, -300]);

  if (!mounted || pathname?.startsWith('/admin')) return null;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden mix-blend-multiply opacity-25">
      
      {/* SINGLE UNIFIED BACKGROUND */}
      <motion.div 
        style={{ 
          y: yParallax,
          position: 'absolute',
          width: '120vw',
          height: '200vh', // Extra height to allow scrolling without clipping
          left: '-10vw',
          top: '-20vh',
          backgroundImage: 'url(/images/madhubani_premium.svg)',
          backgroundSize: '1000px', // Large, readable scale for the art
          backgroundRepeat: 'repeat',
          backgroundPosition: 'center top'
        }}
        className="grayscale contrast-125 opacity-50 will-change-transform"
      />

    </div>
  );
}
