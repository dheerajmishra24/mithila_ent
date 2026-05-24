"use client";
import React from 'react';

export default function BackgroundPattern({ className = '' }: { className?: string }) {
  // A very faint, intricate background pattern to replace solid colors
  return (
    <svg 
      className={`w-full h-full absolute inset-0 z-0 pointer-events-none ${className}`} 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="bg-lotus" width="120" height="120" patternUnits="userSpaceOnUse">
          {/* Subtle background motif */}
          <g stroke="var(--peacock-blue)" strokeWidth="0.8" fill="none" opacity="0.15">
            {/* Lotus */}
            <path d="M60,40 C70,20 80,40 60,60 C40,40 50,20 60,40 Z" />
            <path d="M60,60 C80,50 90,70 60,80 C30,70 40,50 60,60 Z" />
            <path d="M60,60 C75,65 70,85 60,90 C50,85 45,65 60,60 Z" />
            
            {/* Swirling vines connecting */}
            <path d="M60,90 Q70,110 120,100" />
            <path d="M60,90 Q50,110 0,100" />
            <path d="M60,40 Q80,10 120,30" />
            <path d="M60,40 Q40,10 0,30" />
            
            {/* Little fish motif scattered */}
            <g transform="translate(10, 10) scale(0.5)">
              <path d="M20,20 Q30,10 40,20 Q30,30 20,20 Z" />
              <path d="M20,20 L15,15 L15,25 Z" />
              <circle cx="35" cy="18" r="1" fill="var(--charcoal-ink)" />
            </g>
            <g transform="translate(90, 80) scale(0.5) rotate(180 20 20)">
              <path d="M20,20 Q30,10 40,20 Q30,30 20,20 Z" />
              <path d="M20,20 L15,15 L15,25 Z" />
              <circle cx="35" cy="18" r="1" fill="var(--charcoal-ink)" />
            </g>
          </g>
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill="url(#bg-lotus)" />
    </svg>
  );
}
