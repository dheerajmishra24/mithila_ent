"use client";

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

interface ScrollBackdropProps {
  direction?: 'left' | 'right';
  speed?: number;
  height?: string;
  opacity?: number;
  className?: string;
}

export default function ScrollBackdrop({ 
  direction = 'left', 
  speed = 1, 
  height = '240px',
  opacity = 0.85,
  className = ''
}: ScrollBackdropProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track scroll position within the container's viewport
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  // Determine the movement range based on direction and speed
  // A higher speed value means it moves more across the scroll duration
  const xMovement = direction === 'left' 
    ? ["0%", `-${20 * speed}%`] 
    : [`-${20 * speed}%`, "0%"];

  const x = useTransform(scrollYProgress, [0, 1], xMovement);

  return (
    <div 
      ref={containerRef} 
      className={`w-full relative overflow-hidden bg-[var(--unbleached-cotton)] border-y border-[var(--charcoal-ink)]/10 ${className}`}
      style={{ height }}
    >
      {/* 
        We make the inner motion div much wider than the screen (200vw) 
        and tile the background image so it can scroll seamlessly.
      */}
      <motion.div 
        style={{ 
          x,
          width: '200vw',
          height: '100%',
          backgroundImage: 'url(/images/madhubani_border.png)',
          backgroundSize: 'auto 100%',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'left center',
          opacity,
          filter: 'contrast(1.1) brightness(0.95)' // Slight adjustment for premium feel
        }}
        className="absolute top-0 left-0 mix-blend-multiply"
      />
      
      {/* Optional overlay vignette to blend the edges into the page */}
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--unbleached-cotton)] via-transparent to-[var(--unbleached-cotton)] pointer-events-none opacity-40" />
    </div>
  );
}
