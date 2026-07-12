"use client";

import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import Image from 'next/image';
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

  // A subtle, unified parallax scroll that moves the entire massive SVG
  const yParallax = useTransform(smoothScrollY, [0, 5000], [0, -300]);

  if (!mounted || pathname?.startsWith('/admin')) return null;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden mix-blend-multiply opacity-25">
      
      {/* 
        A single, massive container that is larger than the viewport (120vw/120vh).
        This gives us room to parallax scroll the image up/down without showing the edges.
      */}
      <motion.div 
        style={{ y: yParallax }}
        className="absolute w-[120vw] h-[120vh] -left-[10vw] -top-[10vh] grayscale contrast-125 will-change-transform"
      >
        <Image 
          src="/images/madhubani_premium.svg" 
          alt="Premium Madhubani SVG Pattern" 
          fill 
          className="object-cover opacity-50" 
          priority
        />
      </motion.div>

    </div>
  );
}
