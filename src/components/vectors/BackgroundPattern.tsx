"use client";
import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Image from 'next/image';

export default function BackgroundPattern({ className = '' }: { className?: string }) {
  const ref = useRef(null);
  
  // Track scroll progress for this specific section
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  // Subtle parallax translation values (floating in opposite directions)
  const y1 = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const y2 = useTransform(scrollYProgress, [0, 1], [-80, 80]);

  return (
    <div ref={ref} className={`absolute inset-0 z-0 pointer-events-none overflow-hidden ${className}`}>
      {/* Top-left aligned vector */}
      <motion.div 
        style={{ y: y1 }}
        className="absolute -top-16 -left-16 w-[562px] h-[839px] opacity-20 mix-blend-multiply"
      >
        <Image 
          src="/images/bng_.svg" 
          alt="Artisanal Vector Pattern" 
          fill 
          className="object-contain" 
          priority 
        />
      </motion.div>

      {/* Bottom-right aligned vector, rotated for variety */}
      <motion.div 
        style={{ y: y2, rotate: 180 }}
        className="absolute -bottom-32 -right-16 w-[562px] h-[839px] opacity-20 mix-blend-multiply"
      >
        <Image 
          src="/images/bng_.svg" 
          alt="Artisanal Vector Pattern" 
          fill 
          className="object-contain" 
        />
      </motion.div>
    </div>
  );
}
