"use client";

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [pending, setPending] = useState(false);
  const [supabase] = useState(() => createClient());

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
    });
    setPending(false);
    // The same reply whether or not the address has an account, so this form
    // cannot be used to find out who shops here. Only rate limits are surfaced.
    if (error && (error.status === 429 || /rate_limit/.test(error.code ?? ''))) {
      setIsError(true);
      setMessage('Too many requests. Please wait a few minutes and try again.');
    } else {
      setIsError(false);
      setMessage('If an account exists for that email, we have sent a link to reset your password. It expires in one hour.');
    }
  };

  return (
    <main className="flex-grow flex items-center justify-center py-16 bg-transparent">
      <div className="max-w-md w-full bg-white p-8 border-2 border-[var(--charcoal-ink)] shadow-[4px_4px_0_var(--charcoal-ink)]">
        <h1 className="font-serif text-2xl font-bold mb-4">Reset Password</h1>
        <form onSubmit={handleReset} className="space-y-4">
          <label htmlFor="forgot-email" className="block font-sans text-xs font-bold uppercase tracking-widest">Email</label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            className="w-full border-2 border-[var(--charcoal-ink)] p-3 font-sans focus:outline-none"
          />
          <Button type="submit" disabled={pending} className="w-full">{pending ? 'Sending…' : 'Send Link'}</Button>
        </form>
        {message && (
          <p role="status" className={`mt-4 text-sm font-sans font-bold ${isError ? 'text-[var(--madder-red)]' : 'text-green-800'}`}>
            {message}
          </p>
        )}
        <p className="mt-6 text-sm font-sans">
          <Link href="/login" className="font-bold underline">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
