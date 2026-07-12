"use client";

import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

import MadhubaniArt from './vectors/MadhubaniArt';

export default function GlobalParallaxBackground() {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  
  // The global scroll tracking. This reads the window scroll automatically.
  const { scrollY } = useScroll();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use a smooth spring to make the motion feel luxurious and haptic
  const smoothScrollY = useSpring(scrollY, {
    stiffness: 40,
    damping: 20,
    mass: 1.2,
  });

  // Transform scroll position into parallax Y offsets and subtle rotations
  const y1 = useTransform(smoothScrollY, [0, 5000], [0, -300]);
  const y2 = useTransform(smoothScrollY, [0, 5000], [0, 400]);

  const r1 = useTransform(smoothScrollY, [0, 5000], [0, 20]);
  const r2 = useTransform(smoothScrollY, [0, 5000], [180, 160]);

  // Don't render on server to avoid hydration mismatches, and hide on admin
  if (!mounted || pathname?.startsWith('/admin')) return null;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden mix-blend-multiply opacity-[0.08]">
      
      {/* Top Right Generative Mandala */}
      <motion.div 
        style={{ y: y1, rotate: r1 }}
        className="absolute -top-[30%] -right-[20%] w-[1200px] h-[1200px] text-[var(--charcoal-ink)] will-change-transform"
      >
        <MadhubaniArt className="w-full h-full stroke-current" />
      </motion.div>

      {/* Bottom Left Generative Mandala */}
      <motion.div 
        style={{ y: y2, rotate: r2 }}
        className="absolute top-[40%] -left-[20%] w-[1000px] h-[1000px] text-[var(--charcoal-ink)] will-change-transform"
      >
        <MadhubaniArt className="w-full h-full stroke-current" />
      </motion.div>
      
    </div>
  );
}
