import React from 'react';

export default function MadhubaniArt({ className = "" }: { className?: string }) {
  const ring = (count: number) => Array.from({ length: count }, (_, i) => i);

  return (
    <svg viewBox="0 0 1500 1500" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Center Lotus Petal - Double lined */}
        <path id="center-petal" d="M 0 0 C 15 -20, 25 -40, 0 -95 C -25 -40, -15 -20, 0 0 M 0 -10 C 10 -25, 18 -40, 0 -85 C -18 -40, -10 -25, 0 -10" fill="none" stroke="currentColor" strokeWidth="2" />
        
        {/* Fish Motif - swimming right */}
        <g id="madhubani-fish">
          {/* Main body & tail */}
          <path d="M -50 0 C -25 -30, 25 -35, 50 0 C 25 35, -25 30, -50 0 Z" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M 50 0 L 70 -20 L 65 0 L 70 20 Z" fill="none" stroke="currentColor" strokeWidth="2" />
          {/* Eye */}
          <circle cx="-25" cy="-6" r="4" fill="currentColor" />
          {/* Scales / Inner lines */}
          <path d="M -10 -22 Q 5 0, -10 22 M 15 -18 Q 25 0, 15 18" fill="none" stroke="currentColor" strokeWidth="1.5" />
          {/* Fins */}
          <path d="M -15 -27 L -10 -40 L 5 -30 M -15 27 L -10 40 L 5 30" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </g>

        {/* Peacock Motif */}
        <g id="madhubani-peacock">
          <path d="M 0 0 C -20 -40, -20 -80, 20 -100 C 40 -80, 40 -40, 0 0" fill="none" stroke="currentColor" strokeWidth="2"/>
          <circle cx="16" cy="-80" r="4" fill="currentColor" />
          {/* Crown */}
          <path d="M 20 -100 L 15 -120 M 28 -95 L 30 -120 M 38 -88 L 48 -108" stroke="currentColor" strokeWidth="2"/>
          {/* Body/Feathers */}
          <path d="M 0 0 C -80 40, -120 -20, -160 20 C -120 60, -60 80, 0 0" fill="none" stroke="currentColor" strokeWidth="2"/>
          <path d="M -40 20 C -60 60, -100 80, -140 100 C -100 120, -40 100, 0 0" fill="none" stroke="currentColor" strokeWidth="2"/>
          {/* Legs */}
          <path d="M -20 40 L -30 80 L -40 90 M -30 80 L -20 90" fill="none" stroke="currentColor" strokeWidth="2"/>
        </g>

        {/* Vine Pattern */}
        <g id="madhubani-vine">
          <path d="M 0 0 Q 50 -60, 0 -120 T 0 -210" fill="none" stroke="currentColor" strokeWidth="2.5" />
          {/* Leaves */}
          <path d="M 22 -60 Q 60 -60, 75 -85 Q 50 -100, 22 -60" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M -22 -120 Q -60 -120, -75 -145 Q -50 -160, -22 -120" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M 22 -180 Q 60 -180, 75 -205 Q 50 -220, 22 -180" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        </g>

        {/* Outer Ring Leaf */}
        <path id="outer-leaf" d="M 0 0 C 50 -50, 60 -120, 0 -180 C -60 -120, -50 -50, 0 0 M 0 -25 L 0 -155 M 0 -50 L 25 -75 M 0 -90 L 25 -115 M 0 -125 L 25 -150 M 0 -50 L -25 -75 M 0 -90 L -25 -115 M 0 -125 L -25 -150" fill="none" stroke="currentColor" strokeWidth="2"/>
      </defs>

      <g transform="translate(750, 750)">
        {/* Core Mandala Rings */}
        <circle cx="0" cy="0" r="100" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="0" cy="0" r="115" fill="none" stroke="currentColor" strokeWidth="2.5" />
        
        {/* Zig-zag inner border */}
        {ring(36).map(i => {
           const a1 = i * 10 * Math.PI / 180;
           const a2 = (i * 10 + 5) * Math.PI / 180;
           const a3 = (i + 1) * 10 * Math.PI / 180;
           return (
             <path key={`zig-${i}`} d={`M ${Math.cos(a1)*100} ${Math.sin(a1)*100} L ${Math.cos(a2)*115} ${Math.sin(a2)*115} L ${Math.cos(a3)*100} ${Math.sin(a3)*100}`} fill="none" stroke="currentColor" strokeWidth="2" />
           )
        })}

        {/* 12 Center Petals */}
        {ring(12).map(i => (
          <g key={`petal-${i}`} transform={`rotate(${i * 30}) translate(0, -115)`}>
            <use href="#center-petal" />
          </g>
        ))}

        {/* Next Border */}
        <circle cx="0" cy="0" r="215" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="0" cy="0" r="230" fill="none" stroke="currentColor" strokeWidth="2.5" />

        {/* Fish Ring */}
        {ring(12).map(i => (
          <g key={`fish-${i}`} transform={`rotate(${i * 30}) translate(0, -290) rotate(90)`}>
            <use href="#madhubani-fish" />
          </g>
        ))}

        {/* Fish border */}
        <circle cx="0" cy="0" r="350" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="0" cy="0" r="365" fill="none" stroke="currentColor" strokeWidth="2.5" />

        {/* Peacocks and Vines Ring */}
        {ring(8).map(i => (
          <g key={`peacock-${i}`} transform={`rotate(${i * 45}) translate(0, -420)`}>
            <use href="#madhubani-peacock" />
          </g>
        ))}
        {ring(8).map(i => (
          <g key={`vine-${i}`} transform={`rotate(${i * 45 + 22.5}) translate(0, -365)`}>
            <use href="#madhubani-vine" />
          </g>
        ))}

        {/* Outer Border */}
        <circle cx="0" cy="0" r="590" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="0" cy="0" r="605" fill="none" stroke="currentColor" strokeWidth="2.5" />

        {/* Outer Leaves */}
        {ring(36).map(i => (
          <g key={`outer-leaf-${i}`} transform={`rotate(${i * 10}) translate(0, -605)`}>
            <use href="#outer-leaf" />
          </g>
        ))}
      </g>
    </svg>
  );
}
