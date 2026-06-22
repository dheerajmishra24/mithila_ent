import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { updateSiteContent } from '@/actions/admin';
import { Button } from '@/components/ui/Button';

export const dynamic = 'force-dynamic';

const LABELS: Record<string, string> = {
  'legal_privacy-policy': 'Legal — Privacy Policy',
  'legal_terms-of-service': 'Legal — Terms of Service',
  'legal_shipping-returns': 'Legal — Shipping & Returns',
  about_intro: 'About — Intro',
  home_hero: 'Homepage — Hero',
  announcement: 'Announcement Bar',
};

export default async function AdminContent({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const { saved } = await searchParams;
  const supabase = await createClient();
  const { data: blocks } = await supabase.from('site_content').select('*').order('key');

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-4xl">
      <div className="border-b-2 border-[var(--charcoal-ink)]/20 pb-4">
        <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)]">Site Content</h1>
        <p className="font-sans text-sm opacity-70 mt-1 uppercase tracking-widest">Editable pages &amp; blocks</p>
      </div>

      {saved && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-sm">
          Content saved.
        </div>
      )}

      {(!blocks || blocks.length === 0) && (
        <p className="opacity-60 text-sm">
          No content blocks found. Apply migration 0016_cms_content.sql to seed them.
        </p>
      )}

      {(blocks || []).map((b) => (
        <form
          key={b.key}
          action={updateSiteContent}
          className="bg-white border-2 border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)] space-y-3"
        >
          <input type="hidden" name="key" value={b.key} />
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold">{LABELS[b.key] || b.key}</h2>
            <span className="text-[10px] font-mono opacity-40">{b.key}</span>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">
              Title / Heading
            </label>
            <input
              name="title"
              defaultValue={b.title || ''}
              className="w-full border-2 border-[var(--charcoal-ink)]/20 bg-transparent p-2 focus:outline-none focus:border-[var(--madder-red)]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--indigo-dye)] mb-1">
              Body
            </label>
            <textarea
              name="body"
              rows={5}
              defaultValue={b.body || ''}
              placeholder="Leave empty to use the built-in default copy."
              className="w-full border-2 border-[var(--charcoal-ink)]/20 bg-transparent p-2 font-sans text-sm focus:outline-none focus:border-[var(--madder-red)] resize-y"
            />
          </div>
          <Button
            type="submit"
            className="bg-[var(--charcoal-ink)] text-white hover:bg-[var(--turmeric)] hover:text-[var(--charcoal-ink)] uppercase tracking-widest text-xs font-bold"
          >
            Save
          </Button>
        </form>
      ))}
    </div>
  );
}
