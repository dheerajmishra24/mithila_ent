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
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden opacity-25 mix-blend-multiply">
      
      {/* SINGLE UNIFIED BACKGROUND */}
      <motion.div 
        style={{ 
          y: yParallax,
          position: 'absolute',
          width: '100vw',
          height: '150vh', // Extra height to allow smooth parallax scrolling when tiling
          left: '0',
          top: '-25vh', 
          backgroundImage: 'url(/images/madhubani_premium_bg.png)',
          backgroundSize: '800px', // Fixed crisp size to prevent stretching/blurring
          backgroundRepeat: 'repeat', // Tile the image to properly fill the screen
          backgroundPosition: 'top center'
        }}
        className="will-change-transform"
      />

    </div>
  );
}
