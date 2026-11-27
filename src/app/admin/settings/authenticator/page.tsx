import { redirect } from 'next/navigation';
import { requireAdminPage } from '@/lib/dal/session';
import { createClient } from '@/lib/supabase/server';
import { SetupForms } from '@/app/admin-verify/TwoStepClient';

export const dynamic = 'force-dynamic';

// Add an authenticator app after signing in with a WhatsApp/SMS code.
export default async function AuthenticatorSetupPage() {
  await requireAdminPage();
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if ((factors?.totp?.length ?? 0) > 0) redirect('/admin/settings');
  return (
    <div className="max-w-md space-y-6">
      <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)]">Set up an authenticator app</h1>
      <p className="text-sm text-[var(--charcoal-ink)]/80">
        A second way to sign in that works without WhatsApp or SMS. You will need your phone each time you sign in.
      </p>
      <div className="bg-white border-2 border-[var(--charcoal-ink)] p-6">
        <SetupForms />
      </div>
    </div>
  );
}
