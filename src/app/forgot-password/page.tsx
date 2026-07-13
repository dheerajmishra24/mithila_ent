"use client";

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
    });
    if (error) setMessage(error.message);
    else setMessage('Check your email for the password reset link.');
  };

  return (
    <main className="flex-grow flex items-center justify-center py-16 bg-transparent">
      <div className="max-w-md w-full bg-white p-8 border-2 border-[var(--charcoal-ink)] shadow-[4px_4px_0_var(--charcoal-ink)]">
        <h1 className="font-serif text-2xl font-bold mb-4">Reset Password</h1>
        <form onSubmit={handleReset} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            className="w-full border-2 border-[var(--charcoal-ink)] p-3 font-sans focus:outline-none"
          />
          <Button type="submit" className="w-full">Send Link</Button>
        </form>
        {message && <p className="mt-4 text-sm font-sans font-bold text-[var(--madder-red)]">{message}</p>}
      </div>
    </main>
  );
}
