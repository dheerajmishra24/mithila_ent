"use client";

import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export default function GlobalParallaxBackground() {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  
  // The global scroll tracking. This reads the window scroll automatically.
  const { scrollY } = useScroll();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use a smooth spring to make the motion feel luxurious and haptic (emil-design-eng)
  const smoothScrollY = useSpring(scrollY, {
    stiffness: 40,
    damping: 20,
    mass: 1.2,
  });

  // Transform scroll position into parallax Y offsets and subtle rotations
  const y1 = useTransform(smoothScrollY, [0, 5000], [0, -400]);
  const y2 = useTransform(smoothScrollY, [0, 5000], [0, 600]);
  const y3 = useTransform(smoothScrollY, [0, 5000], [0, -800]);

  const r1 = useTransform(smoothScrollY, [0, 5000], [0, 15]);
  const r2 = useTransform(smoothScrollY, [0, 5000], [180, 160]);
  const r3 = useTransform(smoothScrollY, [0, 5000], [-15, -45]);

  // Don't render on server to avoid hydration mismatches with scroll measurements,
  // and completely disable the background on the admin dashboard for clarity.
  if (!mounted || pathname?.startsWith('/admin')) return null;

  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden mix-blend-multiply opacity-[0.4] md:opacity-[0.6]">
      
      {/* Layer 1: Left */}
      <motion.div 
        style={{ y: y1, rotate: r1 }}
        className="absolute -top-32 -left-32 w-[800px] h-[1200px] opacity-[0.05] will-change-transform"
      >
        <Image 
          src="/images/bng_.svg" 
          alt="Madhubani Background Pattern" 
          fill 
          className="object-contain" 
          priority
        />
      </motion.div>

      {/* Layer 2: Right */}
      <motion.div 
        style={{ y: y2, rotate: r2 }}
        className="absolute top-[20%] -right-48 w-[1000px] h-[1500px] opacity-[0.04] will-change-transform"
      >
        <Image 
          src="/images/bng_.svg" 
          alt="Madhubani Background Pattern" 
          fill 
          className="object-contain" 
        />
      </motion.div>

      {/* Layer 3: Bottom Left */}
      <motion.div 
        style={{ y: y3, rotate: r3 }}
        className="absolute top-[60%] -left-32 w-[900px] h-[1200px] opacity-[0.05] will-change-transform"
      >
        <Image 
          src="/images/bng_.svg" 
          alt="Madhubani Background Pattern" 
          fill 
          className="object-contain" 
        />
      </motion.div>
    </div>
  );
}
