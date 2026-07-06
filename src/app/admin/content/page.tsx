import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { updateSiteContent } from '@/actions/admin';
import { Button } from '@/components/ui/Button';

export const dynamic = 'force-dynamic';

const CMS_SCHEMA = [
  {
    id: 'home',
    label: 'Homepage',
    description: 'Edit the main landing page sections.',
    blocks: [
      { key: 'home_hero', title: 'Hero Section', hasTitle: true, hasBody: true },
      { key: 'home_features', title: 'Features Overview', hasTitle: true, hasBody: true },
      { key: 'home_cta', title: 'Call to Action Banner', hasTitle: true, hasBody: true },
    ]
  },
  {
    id: 'about',
    label: 'About Page',
    description: 'Edit the company story and mission statement.',
    blocks: [
      { key: 'about_intro', title: 'Introduction', hasTitle: true, hasBody: true },
      { key: 'about_mission', title: 'Our Mission', hasTitle: true, hasBody: true },
      { key: 'about_heritage', title: 'Our Heritage', hasTitle: true, hasBody: true },
    ]
  },
  {
    id: 'shop',
    label: 'Shop',
    description: 'Edit the storefront headers.',
    blocks: [
      { key: 'shop_header', title: 'Main Shop Header', hasTitle: true, hasBody: true },
    ]
  },
  {
    id: 'legal',
    label: 'Legal Pages',
    description: 'Edit policies and terms.',
    blocks: [
      { key: 'legal_privacy-policy', title: 'Privacy Policy', hasTitle: true, hasBody: true },
      { key: 'legal_terms-of-service', title: 'Terms of Service', hasTitle: true, hasBody: true },
      { key: 'legal_shipping-returns', title: 'Shipping & Returns', hasTitle: true, hasBody: true },
    ]
  },
  {
    id: 'global',
    label: 'Global Elements',
    description: 'Elements that appear on multiple pages.',
    blocks: [
      { key: 'announcement', title: 'Announcement Bar', hasTitle: false, hasBody: true },
    ]
  }
];

export default async function AdminContent({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const { saved } = await searchParams;
  const supabase = await createClient();
  const { data: dbBlocks } = await supabase.from('site_content').select('*');
  
  // Map DB records for easy lookup
  const contentMap = (dbBlocks || []).reduce((acc: any, curr: any) => {
    acc[curr.key] = curr;
    return acc;
  }, {});

  return (
    <div className="space-y-12 p-4 md:p-8 max-w-5xl">
      <div className="border-b-2 border-[var(--charcoal-ink)]/20 pb-4">
        <h1 className="font-serif text-3xl font-bold text-[var(--charcoal-ink)]">Site Content</h1>
        <p className="font-sans text-sm opacity-70 mt-1 uppercase tracking-widest">Manage copy and layout text across the site</p>
      </div>

      {saved && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-sm">
          Content saved successfully. It is now live on the storefront.
        </div>
      )}

      <div className="space-y-16">
        {CMS_SCHEMA.map((group) => (
          <div key={group.id} className="space-y-6">
            <div className="border-b border-[var(--charcoal-ink)]/10 pb-2">
              <h2 className="font-serif text-2xl font-bold text-[var(--charcoal-ink)]">{group.label}</h2>
              <p className="font-sans text-xs opacity-60 uppercase tracking-widest">{group.description}</p>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              {group.blocks.map((block) => {
                const data = contentMap[block.key] || { title: '', body: '' };
                
                return (
                  <form
                    key={block.key}
                    action={updateSiteContent}
                    className="bg-white border-2 border-[var(--charcoal-ink)] p-6 shadow-[4px_4px_0_var(--charcoal-ink)] space-y-4"
                  >
                    <input type="hidden" name="key" value={block.key} />
                    
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-sans text-sm font-bold uppercase tracking-widest text-[var(--madder-red)]">
                        {block.title}
                      </h3>
                      <span className="text-[10px] font-mono bg-zinc-100 px-2 py-1 rounded text-zinc-500">
                        {block.key}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {block.hasTitle && (
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--charcoal-ink)] mb-1">
                            Heading / Title
                          </label>
                          <input
                            name="title"
                            defaultValue={data.title}
                            placeholder="Leave empty to use default"
                            className="w-full border-2 border-[var(--charcoal-ink)]/20 bg-zinc-50/50 p-2 text-sm focus:outline-none focus:border-[var(--charcoal-ink)] transition-colors"
                          />
                        </div>
                      )}

                      {block.hasBody && (
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--charcoal-ink)] mb-1">
                            Body Text
                          </label>
                          <textarea
                            name="body"
                            rows={4}
                            defaultValue={data.body}
                            placeholder="Leave empty to use default"
                            className="w-full border-2 border-[var(--charcoal-ink)]/20 bg-zinc-50/50 p-2 font-sans text-sm focus:outline-none focus:border-[var(--charcoal-ink)] resize-y transition-colors"
                          />
                        </div>
                      )}
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Button
                        type="submit"
                        className="bg-[var(--charcoal-ink)] text-white hover:bg-[var(--turmeric)] hover:text-[var(--charcoal-ink)] uppercase tracking-widest text-[10px] font-bold px-6 py-2 h-auto"
                      >
                        Save Section
                      </Button>
                    </div>
                  </form>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
