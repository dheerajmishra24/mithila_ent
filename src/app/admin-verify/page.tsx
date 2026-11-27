import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser, getTwoStepStatus } from '@/lib/dal/session';
import { maskPhone, phoneOtpAvailable } from '@/lib/otp';
import TwoStepClient from './TwoStepClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Two-step sign-in | Owner Portal', robots: { index: false, follow: false } };

// Second step of owner-portal sign-in (migration 0053). Lives outside /admin
// so the admin layout's guard does not bounce it; it checks the caller itself.
export default async function AdminVerifyPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/admin/dashboard');
  const status = await getTwoStepStatus();
  if (!status.adminRole) redirect('/');
  if (status.secondFactor) redirect('/admin/dashboard');

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasAuthenticator = (factors?.totp?.length ?? 0) > 0;
  const phone = status.phoneLast4 && phoneOtpAvailable() ? maskPhone(status.phoneLast4) : null;
  const needsSetup = !hasAuthenticator && !status.phoneLast4;

  return (
    <main className="min-h-screen bg-[var(--charcoal-ink)] flex items-center justify-center py-16 px-4">
      <div className="max-w-md w-full bg-[var(--unbleached-cotton)] p-8 shadow-[8px_8px_0_var(--turmeric)]">
        <h1 className="font-serif text-2xl font-bold mb-2 text-[var(--charcoal-ink)]">Two-step sign-in</h1>
        <p className="font-sans text-sm text-[var(--charcoal-ink)]/80 mb-6">
          {needsSetup
            ? 'The owner portal needs a second step after your password. Set up an authenticator app once; after that you enter a 6-digit code from it each time you sign in.'
            : 'Confirm it is you with a 6-digit code. You will stay signed in to the owner portal for 12 hours.'}
        </p>
        <TwoStepClient hasAuthenticator={hasAuthenticator} phone={phone} needsSetup={needsSetup} />
        {!needsSetup && !hasAuthenticator && !phone && (
          <p role="alert" className="mt-4 text-sm font-bold text-[var(--madder-red)]">
            Codes by WhatsApp or SMS are not available right now. Ask your developer for help signing in.
          </p>
        )}
      </div>
    </main>
  );
}
