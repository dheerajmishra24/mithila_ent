"use client";

import { Button } from '@/components/ui/Button';
import { useActionState } from 'react';
import { login } from '@/actions/auth';

const initialState = { error: '' };

export default function AdminLogin() {
  // Uses the same hardened server action as /login: failed-attempt lockout,
  // security-alert email, and server-side admin redirect. No client-side auth.
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <div className="min-h-screen bg-[var(--charcoal-ink)] flex items-center justify-center py-16 px-4">
      <div className="max-w-md w-full bg-[var(--unbleached-cotton)] p-8 shadow-[8px_8px_0_var(--turmeric)]">
        <h1 className="font-serif text-2xl font-bold mb-2 text-[var(--charcoal-ink)]">Owner Portal</h1>
        <p className="font-sans text-sm opacity-70 mb-6">Restricted access. Admin credentials only.</p>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value="/admin/dashboard" />
          {state?.error && (
            <p className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm font-sans">
              {state.error}
            </p>
          )}
          <input
            type="email"
            name="email"
            placeholder="Admin Email"
            required
            className="w-full border-2 border-[var(--charcoal-ink)] p-3 font-sans focus:outline-none bg-transparent"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            className="w-full border-2 border-[var(--charcoal-ink)] p-3 font-sans focus:outline-none bg-transparent"
          />
          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-[var(--charcoal-ink)] text-white hover:bg-[var(--madder-red)]"
          >
            {isPending ? 'Authenticating…' : 'Authenticate'}
          </Button>
        </form>
        {process.env.NODE_ENV !== 'production' && (
          <a
            href="/api/dev/login"
            className="block mt-4 text-center text-xs underline opacity-50 hover:opacity-90"
          >
            Dev auto-login (local only)
          </a>
        )}
        <p className="font-sans text-xs opacity-60 mt-6 text-center">
          Non-admin accounts are denied access to this portal.
        </p>
      </div>
    </div>
  );
}
