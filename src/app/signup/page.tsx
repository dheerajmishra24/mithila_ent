"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate successful signup
    setTimeout(() => {
      router.push('/');
    }, 800);
  };

  return (
    <main className="flex-grow bg-[var(--unbleached-cotton)] py-24 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[var(--charcoal-ink)]/5 backdrop-blur-sm border-2 border-[var(--charcoal-ink)] p-8 rounded-sm shadow-2xl relative">
        <div className="absolute top-0 right-0 w-8 h-8 bg-[var(--turmeric)] border-b-2 border-l-2 border-[var(--charcoal-ink)]"></div>
        
        <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)] mb-2 mt-4 text-center">Join the Guild</h1>
        <p className="font-sans text-sm opacity-70 text-center mb-8 px-2">Register to secure early access to limited loom runs and manage your artisan procurements.</p>
        
        <form onSubmit={handleSignup} className="space-y-6">
          <div>
            <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[var(--charcoal-ink)] mb-2">Full Name</label>
            <input type="text" required className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--turmeric)] transition-colors" />
          </div>
          <div>
            <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[var(--charcoal-ink)] mb-2">Email</label>
            <input type="email" required className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--turmeric)] transition-colors" />
          </div>
          <div>
            <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[var(--charcoal-ink)] mb-2">Password</label>
            <input type="password" required className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--turmeric)] transition-colors" />
          </div>

          <Button type="submit" className="w-full bg-[var(--turmeric)] border-[var(--turmeric)] hover:border-[var(--charcoal-ink)] hover:bg-[var(--charcoal-ink)] text-[var(--charcoal-ink)] hover:text-[var(--unbleached-cotton)]">Create Account</Button>
        </form>

        <p className="font-sans text-sm text-center mt-8">
          Already have an account? <Link href="/login" className="font-bold text-[var(--turmeric)] hover:underline">Log in</Link>
        </p>
      </div>
    </main>
  );
}
