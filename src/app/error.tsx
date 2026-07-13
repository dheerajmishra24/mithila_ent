"use client";

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Error Caught:', error);
  }, [error]);

  return (
    <main className="flex-grow bg-transparent py-32 flex flex-col items-center justify-center text-center px-4">
      {/* Madhubani Motif Placeholder */}
      <div className="w-32 h-32 border-4 border-dashed border-[var(--madder-red)] opacity-50 mb-8 rotate-45"></div>
      
      <h1 className="font-serif text-4xl font-bold text-[var(--charcoal-ink)] mb-4">A thread snapped.</h1>
      <p className="font-sans text-lg opacity-70 mb-8 max-w-md">
        Something went wrong on our end. Our artisans are working to tie it back together.
      </p>
      
      <Button onClick={() => reset()}>Try Again</Button>
    </main>
  );
}
