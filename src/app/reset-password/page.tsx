"use client";

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { passwordError, passwordRules } from '@/lib/password';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const supabase = createClient();

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

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setIsError(true);
      setMessage(error.message);
    } else {
      setIsError(false);
      setMessage('Password updated successfully. You can now log in.');
    }
  };

  return (
    <main className="flex-grow flex items-center justify-center py-16 bg-[var(--unbleached-cotton)]">
      <div className="max-w-md w-full bg-white p-8 border-2 border-[var(--charcoal-ink)] shadow-[4px_4px_0_var(--charcoal-ink)]">
        <h1 className="font-serif text-2xl font-bold mb-4">New Password</h1>
        <form onSubmit={handleUpdate} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
                    <span className={ok ? 'text-green-600' : 'text-zinc-400'}>{ok ? '✓' : '○'}</span>
                    <span className={ok ? 'text-zinc-800' : 'text-zinc-500'}>{rule.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          <Button type="submit" className="w-full">Update Password</Button>
        </form>
        {message && (
          <p className={`mt-4 text-sm font-sans font-bold ${isError ? 'text-[var(--madder-red)]' : 'text-green-700'}`}>
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
