"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useSearchParams } from 'next/navigation';
import { useActionState } from 'react';
import { register } from '@/actions/auth';

const initialState = {
  error: '',
}

export default function SignupPage() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/account';
  const [state, formAction, isPending] = useActionState(register, initialState);

  return (
    <main className="flex-grow bg-[var(--unbleached-cotton)] py-24 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[var(--charcoal-ink)]/5 backdrop-blur-sm border-2 border-[var(--charcoal-ink)] p-8 rounded-sm shadow-2xl relative">
        <div className="absolute top-0 right-0 w-8 h-8 bg-[var(--turmeric)] border-b-2 border-l-2 border-[var(--charcoal-ink)]"></div>
        
        <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)] mb-2 mt-4 text-center">Join the Guild</h1>
        <p className="font-sans text-sm opacity-70 text-center mb-8 px-2">Register to secure early access to limited loom runs and manage your artisan procurements.</p>
        
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="next" value={nextPath} />
          
          {state?.error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm mb-4">
              {state.error}
            </div>
          )}

          <div>
            <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[var(--charcoal-ink)] mb-2">Full Name</label>
            <input type="text" name="fullName" required className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--turmeric)] transition-colors" />
          </div>
          <div>
            <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[var(--charcoal-ink)] mb-2">Email</label>
            <input type="email" name="email" required className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--turmeric)] transition-colors" />
          </div>
          <div>
            <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[var(--charcoal-ink)] mb-2">Password</label>
            <input type="password" name="password" required className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--turmeric)] transition-colors" />
          </div>

          <Button type="submit" disabled={isPending} className="w-full bg-[var(--turmeric)] border-[var(--turmeric)] hover:border-[var(--charcoal-ink)] hover:bg-[var(--charcoal-ink)] text-[var(--charcoal-ink)] hover:text-[var(--unbleached-cotton)]">
            {isPending ? 'Creating Account...' : 'Create Account'}
          </Button>
        </form>

        <p className="font-sans text-sm text-center mt-8">
          Already have an account? <Link href="/login" className="font-bold text-[var(--turmeric)] hover:underline">Log in</Link>
        </p>
      </div>
    </main>
  );
}
