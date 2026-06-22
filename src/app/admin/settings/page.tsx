import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { updateStoreSettings } from '@/actions/admin';

export const dynamic = 'force-dynamic';

export default async function AdminSettings({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const { saved } = await searchParams;
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('store_settings')
    .select('*')
    .eq('id', true)
    .single();

  return (
    <div className="space-y-8 max-w-3xl p-4 md:p-8">
      <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)]">Store Settings</h1>

      {saved && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-sm">
          Settings saved.
        </div>
      )}

      <form action={updateStoreSettings} className="bg-white border-2 border-[var(--charcoal-ink)] p-8 space-y-4">
        <h2 className="font-serif text-xl font-bold">General</h2>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1">Store Name</label>
          <input
            type="text"
            name="store_name"
            defaultValue={settings?.store_name ?? 'Mithila Enterprises'}
            className="w-full border-2 border-[var(--charcoal-ink)] p-2 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1">Support Email</label>
          <input
            type="email"
            name="support_email"
            defaultValue={settings?.support_email ?? ''}
            className="w-full border-2 border-[var(--charcoal-ink)] p-2 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest mb-1">Support Phone</label>
          <input
            type="text"
            name="support_phone"
            defaultValue={settings?.support_phone ?? ''}
            className="w-full border-2 border-[var(--charcoal-ink)] p-2 focus:outline-none"
          />
        </div>
        <Button type="submit">Save Changes</Button>
      </form>

      <section className="bg-white border-2 border-[var(--charcoal-ink)] p-8 space-y-2">
        <h2 className="font-serif text-xl font-bold">API Keys &amp; Integrations</h2>
        <p className="text-sm opacity-70">
          Secrets (Gemini, Resend, Supabase, logistics webhook) are configured via environment
          variables in <code>.env.local</code> and are never stored in the database.
        </p>
      </section>
    </div>
  );
}
