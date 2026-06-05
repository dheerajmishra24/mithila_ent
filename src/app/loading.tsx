"use client";

import Image from 'next/image';
import { motion } from 'framer-motion';

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--unbleached-cotton)]">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ ease: "linear", duration: 200, repeat: Infinity }}
        className="relative w-96 h-96 mix-blend-multiply opacity-90"
      >
        <Image 
          src="/images/madhubani_mandala.png" 
          alt="Loading..." 
          fill 
          className="object-contain" 
          sizes="(max-width: 768px) 100vw, 400px"
          priority 
        />
      </motion.div>
    </div>
  );
}
