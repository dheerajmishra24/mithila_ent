"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useSearchParams } from 'next/navigation';
import { useActionState, useState } from 'react';
import { register, signInWithGoogle } from '@/actions/auth';
import { passwordRules } from '@/lib/password';
import { PasswordInput } from '@/components/PasswordInput';

const initialState: { error?: string; success?: string } = {
  error: '',
}

export default function SignupPage() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/account';
  const [state, formAction, isPending] = useActionState(register, initialState);
  const [password, setPassword] = useState('');


  return (
    <main className="flex-grow bg-transparent py-24 flex items-center justify-center px-4">
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

          {state?.success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-sm mb-4">
              {state.success}
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
            <PasswordInput
              name="password"
              required
              value={password}
              onChange={(e: any) => setPassword(e.target.value)}
              className="focus:border-[var(--turmeric)]"
            />

            {password.length > 0 && (
              <div className="mt-3 space-y-1">
                {passwordRules.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs font-sans">
                    <span className={rule.test(password) ? "text-green-600" : "text-zinc-400"}>
                      {rule.test(password) ? '✓' : '○'}
                    </span>
                    <span className={rule.test(password) ? "text-zinc-800" : "text-zinc-700"}>
                      {rule.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button type="submit" disabled={isPending} className="w-full bg-[var(--turmeric)] border-[var(--turmeric)] hover:border-[var(--charcoal-ink)] hover:bg-[var(--charcoal-ink)] text-[var(--charcoal-ink)] hover:text-[var(--unbleached-cotton)]">
            {isPending ? 'Creating Account...' : 'Create Account'}
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
            Sign up with Google
          </button>
        </form>

        <p className="font-sans text-sm text-center mt-8">
          Already have an account? <Link href="/login" className="font-bold text-[var(--turmeric)] hover:underline">Log in</Link>
        </p>
      </div>
    </main>
  );
}
