"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { passwordError, passwordRules } from '@/lib/password';
import { PasswordInput } from '@/components/PasswordInput';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [pending, setPending] = useState(false);
  // null while checking; false when the reset link did not produce a session.
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setHasSession(Boolean(data.user)));
  }, [supabase]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setIsError(false);

    const err = passwordError(password);
    if (err) {
      setIsError(true);
      setMessage(err);
      return;
    }

    setPending(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPending(false);
      setIsError(true);
      setMessage(
        error.code === 'same_password'
          ? 'Please choose a password you have not used before.'
          : error.code === 'weak_password'
            ? 'That password is too weak or has appeared in a known data breach. Please choose another.'
            : 'We could not update your password. Please request a new reset link.',
      );
      return;
    }

    // Sign out every other device that still holds the old session.
    await supabase.auth.signOut({ scope: 'others' });
    setMessage('Password updated. Taking you to your account…');
    router.replace('/account');
    router.refresh();
  };

  if (hasSession === false) {
    return (
      <main className="flex-grow flex items-center justify-center py-16 bg-transparent">
        <div className="max-w-md w-full bg-white p-8 border-2 border-[var(--charcoal-ink)] shadow-[4px_4px_0_var(--charcoal-ink)]">
          <h1 className="font-serif text-2xl font-bold mb-4">Link expired</h1>
          <p className="font-sans text-sm mb-6">This password reset link is invalid or has expired. Reset links work once and last one hour.</p>
          <Link href="/forgot-password" className="font-sans font-bold underline">Request a new link</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-grow flex items-center justify-center py-16 bg-transparent">
      <div className="max-w-md w-full bg-white p-8 border-2 border-[var(--charcoal-ink)] shadow-[4px_4px_0_var(--charcoal-ink)]">
        <h1 className="font-serif text-2xl font-bold mb-4">New Password</h1>
        <form onSubmit={handleUpdate} className="space-y-4">
          <label htmlFor="reset-password" className="block font-sans text-xs font-bold uppercase tracking-widest">New password</label>
          <PasswordInput
            id="reset-password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            placeholder="Enter new password"
            required
            className="w-full border-2 border-[var(--charcoal-ink)] p-3 font-sans focus:outline-none"
          />

          {password.length > 0 && (
            <div className="space-y-1">
              {passwordRules.map((rule, idx) => {
                const ok = rule.test(password);
                return (
                  <div key={idx} className="flex items-center gap-2 text-xs font-sans">
                    <span className={ok ? 'text-green-800' : 'text-zinc-800'}>{ok ? '✓' : '○'}</span>
                    <span className={ok ? 'text-zinc-800' : 'text-zinc-700'}>{rule.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          <Button type="submit" disabled={pending || hasSession === null} className="w-full">
            {pending ? 'Updating…' : 'Update Password'}
          </Button>
        </form>
        {message && (
          <p role="status" className={`mt-4 text-sm font-sans font-bold ${isError ? 'text-[var(--madder-red)]' : 'text-green-800'}`}>
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
