"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useSearchParams } from 'next/navigation';
import { useActionState } from 'react';
import { login, signInWithGoogle } from '@/actions/auth';
import { PasswordInput } from '@/components/PasswordInput';
import { safeNextPath } from '@/lib/safe-next';
import { loginPageError } from '@/lib/auth-errors';

const initialState = {
  error: '',
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get('next'));
  const linkError = loginPageError(searchParams.get('error'));
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <main className="flex-grow bg-transparent py-24 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[var(--charcoal-ink)]/5 backdrop-blur-sm border-2 border-[var(--charcoal-ink)] p-8 rounded-sm shadow-2xl relative">
        {/* Decorative corner */}
        <div className="absolute top-0 left-0 w-8 h-8 bg-[var(--madder-red)] border-b-2 border-r-2 border-[var(--charcoal-ink)]"></div>
        
        <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)] mb-2 mt-4 text-center">Artisan Portal</h1>
        <p className="font-sans text-sm opacity-70 text-center mb-8 px-2">Enter your credentials to manage your fabric registry and procurement history.</p>
        
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="next" value={nextPath} />
          
          {(state?.error || linkError) && (
            <div role="alert" className="bg-red-100 border border-red-400 text-red-800 px-4 py-3 rounded text-sm mb-4">
              {state?.error || linkError}
            </div>
          )}

          <div>
            <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[var(--charcoal-ink)] mb-2" htmlFor="login-email">Email</label>
            <input id="login-email" defaultValue={(state as { email?: string } | undefined)?.email ?? ''} type="email" name="email" autoComplete="email" required className="w-full border-2 border-[var(--charcoal-ink)] bg-transparent p-3 font-sans focus:outline-none focus:border-[var(--madder-red)] transition-colors" />
          </div>
          <div>
            <label className="block font-sans text-xs font-bold uppercase tracking-widest text-[var(--charcoal-ink)] mb-2" htmlFor="login-password">Password</label>
            <PasswordInput id="login-password" autoComplete="current-password" className="focus:border-[var(--madder-red)]" />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 font-sans text-sm cursor-pointer">
              <input type="checkbox" name="remember" className="accent-[var(--madder-red)]" />
              Remember me
            </label>
            <Link href="/forgot-password" className="font-sans text-sm font-bold text-[var(--madder-red)] hover:underline">Forgot password?</Link>
          </div>

          <Button type="submit" disabled={isPending} className="w-full bg-[var(--madder-red)] border-[var(--madder-red)] hover:border-[var(--charcoal-ink)] hover:bg-[var(--charcoal-ink)] text-[var(--unbleached-cotton)] hover:text-[var(--unbleached-cotton)] transition-colors">
            {isPending ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>

        <form action={signInWithGoogle} className="mt-4">
          <input type="hidden" name="next" value={nextPath} />
          <button type="submit" className="w-full flex items-center justify-center gap-3 bg-white border-2 border-[var(--charcoal-ink)] p-3 font-sans font-bold text-xs uppercase tracking-widest text-[var(--charcoal-ink)] hover:bg-zinc-50 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        </form>

        <p className="font-sans text-sm text-center mt-8">
          Don&apos;t have an account? <Link href="/signup" className="font-bold text-[var(--madder-red)] hover:underline">Sign up</Link>
        </p>
      </div>
    </main>
  );
}
