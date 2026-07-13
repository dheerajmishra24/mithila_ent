import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <main className="flex-grow bg-transparent py-32 flex flex-col items-center justify-center text-center px-4">
      {/* Madhubani Motif Placeholder */}
      <div className="w-32 h-32 kachni-border bg-[var(--charcoal-ink)] opacity-20 mb-8 relative">
        <div className="absolute inset-2 bg-[var(--madder-red)] opacity-50"></div>
      </div>
      
      <h1 className="font-serif text-5xl md:text-7xl font-bold text-[var(--charcoal-ink)] mb-4">404</h1>
      <p className="font-sans text-xl opacity-70 mb-8 max-w-lg">
        The canvas is blank. The page you are looking for has been woven out of our loom.
      </p>
      
      <div className="flex gap-4">
        <Link href="/">
          <Button>Return Home</Button>
        </Link>
        <Link href="/shop">
          <Button variant="outline">Explore Fabrics</Button>
        </Link>
      </div>
    </main>
  );
}
