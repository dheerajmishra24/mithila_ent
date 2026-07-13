"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useSearchParams } from 'next/navigation';
import { useActionState } from 'react';
import { login } from '@/actions/auth';

const initialState = {
  error: '',
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/account';
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <main className="flex-grow bg-transparent py-24 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[var(--charcoal-ink)]/5 backdrop-blur-sm border-2 border-[var(--charcoal-ink)] p-8 rounded-sm shadow-2xl relative">
        {/* Decorative corner */}
        <div className="absolute top-0 left-0 w-8 h-8 bg-[var(--madder-red)] border-b-2 border-r-2 border-[var(--charcoal-ink)]"></div>
        
        <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)] mb-2 mt-4 text-center">Artisan Portal</h1>
        <p className="font-sans text-sm opacity-70 text-center mb-8">Enter your credentials to manage your fabric registry and procurement history.</p>
        
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="next" value={nextPath} />
          
          {state?.error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm mb-4">
              {state.error}
            </div>
          )}

          <div>
            <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[var(--charcoal-ink)] mb-2">Email</label>
            <input type="email" name="email" required className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
          </div>
          <div>
            <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[var(--charcoal-ink)] mb-2">Password</label>
            <input type="password" name="password" required className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 font-sans text-sm cursor-pointer">
              <input type="checkbox" name="remember" className="accent-[var(--madder-red)]" />
              Remember me
            </label>
            <Link href="/forgot-password" className="font-sans text-sm text-[var(--madder-red)] hover:underline">Forgot password?</Link>
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>

        <p className="font-sans text-sm text-center mt-8">
          Don&apos;t have an account? <Link href="/signup" className="font-bold text-[var(--madder-red)] hover:underline">Sign up</Link>
        </p>
      </div>
    </main>
  );
}
