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
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden mix-blend-multiply opacity-15">
      
      {/* SINGLE UNIFIED BACKGROUND */}
      <motion.div 
        style={{ 
          y: yParallax,
          position: 'absolute',
          width: '100vw',
          height: '115vh', // Taller than the screen to allow for parallax
          left: '0',
          top: '-5vh', // Start slightly offset to allow scrolling up
          backgroundImage: 'url(/images/madhubani_widescreen.png)',
          backgroundSize: 'cover', // Now that the image is 16:9, cover will fit perfectly without extreme cropping!
          backgroundRepeat: 'no-repeat', 
          backgroundPosition: 'center center'
        }}
        className="grayscale contrast-125 opacity-40 will-change-transform"
      />

    </div>
  );
}
