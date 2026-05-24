"use client";
import React from 'react';

export default function MadhubaniFrame() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex flex-col justify-between hidden md:flex">
      {/* Top Border */}
      <svg width="100%" height="24" preserveAspectRatio="none" className="w-full">
        <defs>
          <pattern id="triangle-top" width="40" height="24" patternUnits="userSpaceOnUse">
            {/* Outer border lines */}
            <line x1="0" y1="2" x2="40" y2="2" stroke="var(--text-primary)" strokeWidth="2" />
            <line x1="0" y1="22" x2="40" y2="22" stroke="var(--text-primary)" strokeWidth="2" />
            
            {/* Triangles */}
            <polygon points="0,4 20,20 40,4" fill="var(--turmeric)" stroke="var(--text-primary)" strokeWidth="1.5" />
            <polygon points="0,20 20,4 40,20" fill="var(--madder-red)" stroke="var(--text-primary)" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect width="100%" height="24" fill="url(#triangle-top)" />
      </svg>

      {/* Side Borders Container */}
      <div className="flex-grow flex justify-between w-full h-full overflow-hidden">
        {/* Left Border */}
        <svg width="24" height="100%" preserveAspectRatio="none" className="h-full">
          <defs>
            <pattern id="triangle-left" width="24" height="40" patternUnits="userSpaceOnUse">
              <line x1="2" y1="0" x2="2" y2="40" stroke="var(--text-primary)" strokeWidth="2" />
              <line x1="22" y1="0" x2="22" y2="40" stroke="var(--text-primary)" strokeWidth="2" />
              
              <polygon points="4,0 20,20 4,40" fill="var(--madhubani-green)" stroke="var(--text-primary)" strokeWidth="1.5" />
              <polygon points="20,0 4,20 20,40" fill="var(--peacock-blue)" stroke="var(--text-primary)" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="24" height="100%" fill="url(#triangle-left)" />
        </svg>

        {/* Right Border */}
        <svg width="24" height="100%" preserveAspectRatio="none" className="h-full">
          <defs>
            <pattern id="triangle-right" width="24" height="40" patternUnits="userSpaceOnUse">
              <line x1="2" y1="0" x2="2" y2="40" stroke="var(--text-primary)" strokeWidth="2" />
              <line x1="22" y1="0" x2="22" y2="40" stroke="var(--text-primary)" strokeWidth="2" />
              
              <polygon points="4,0 20,20 4,40" fill="var(--peacock-blue)" stroke="var(--text-primary)" strokeWidth="1.5" />
              <polygon points="20,0 4,20 20,40" fill="var(--madhubani-green)" stroke="var(--text-primary)" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="24" height="100%" fill="url(#triangle-right)" />
        </svg>
      </div>

      {/* Bottom Border */}
      <svg width="100%" height="24" preserveAspectRatio="none" className="w-full">
        <defs>
          <pattern id="triangle-bottom" width="40" height="24" patternUnits="userSpaceOnUse">
            <line x1="0" y1="2" x2="40" y2="2" stroke="var(--text-primary)" strokeWidth="2" />
            <line x1="0" y1="22" x2="40" y2="22" stroke="var(--text-primary)" strokeWidth="2" />
            
            <polygon points="0,4 20,20 40,4" fill="var(--madder-red)" stroke="var(--text-primary)" strokeWidth="1.5" />
            <polygon points="0,20 20,4 40,20" fill="var(--turmeric)" stroke="var(--text-primary)" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect width="100%" height="24" fill="url(#triangle-bottom)" />
      </svg>
    </div>
  );
}
