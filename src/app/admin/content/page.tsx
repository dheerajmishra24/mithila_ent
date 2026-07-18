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
      { 
        key: 'home_hero', 
        title: 'Hero Section',
        fields: [
          { name: 'title', label: 'Main Heading (Title)', type: 'text' },
          { name: 'subtitle', label: 'Overline Subtitle', type: 'text' },
          { name: 'body', label: 'Description (Body)', type: 'textarea' },
          { name: 'button_text', label: 'Button Text', type: 'text' },
          { name: 'button_link', label: 'Button Link', type: 'text' }
        ]
      },
      { 
        key: 'home_features', 
        title: 'Features Overview',
        fields: [
          { name: 'title', label: 'Main Heading (Title)', type: 'text' },
          { name: 'subtitle', label: 'Overline Subtitle', type: 'text' },
          { name: 'body', label: 'Description (Body)', type: 'textarea' }
        ]
      },
      { 
        key: 'home_cta', 
        title: 'Call to Action Banner',
        fields: [
          { name: 'title', label: 'Main Heading (Title)', type: 'text' },
          { name: 'subtitle', label: 'Overline Subtitle', type: 'text' },
          { name: 'body', label: 'Description (Body)', type: 'textarea' },
          { name: 'button_text', label: 'Button Text', type: 'text' },
          { name: 'button_link', label: 'Button Link', type: 'text' }
        ]
      },
    ]
  },
  {
    id: 'about',
    label: 'About Page',
    description: 'Edit the company story and mission statement.',
    blocks: [
      { 
        key: 'about_intro', 
        title: 'Introduction',
        fields: [
          { name: 'title', label: 'Main Heading (Title)', type: 'text' },
          { name: 'body', label: 'Description (Body)', type: 'textarea' }
        ]
      },
      { 
        key: 'about_mission', 
        title: 'Our Mission',
        fields: [
          { name: 'title', label: 'Main Heading (Title)', type: 'text' },
          { name: 'body', label: 'Description (Body)', type: 'textarea' }
        ]
      },
      { 
        key: 'about_heritage', 
        title: 'Our Heritage',
        fields: [
          { name: 'title', label: 'Main Heading (Title)', type: 'text' },
          { name: 'body', label: 'Description (Body)', type: 'textarea' }
        ]
      },
    ]
  },
  {
    id: 'shop',
    label: 'Shop',
    description: 'Edit the storefront headers.',
    blocks: [
      { 
        key: 'shop_header', 
        title: 'Main Shop Header',
        fields: [
          { name: 'title', label: 'Main Heading (Title)', type: 'text' },
          { name: 'body', label: 'Description (Body)', type: 'textarea' }
        ]
      },
    ]
  },
  {
    id: 'legal',
    label: 'Legal Pages',
    description: 'Edit policies and terms.',
    blocks: [
      { 
        key: 'legal_privacy-policy', 
        title: 'Privacy Policy',
        fields: [
          { name: 'title', label: 'Main Heading (Title)', type: 'text' },
          { name: 'body', label: 'Description (Body)', type: 'textarea' }
        ]
      },
      { 
        key: 'legal_terms-of-service', 
        title: 'Terms of Service',
        fields: [
          { name: 'title', label: 'Main Heading (Title)', type: 'text' },
          { name: 'body', label: 'Description (Body)', type: 'textarea' }
        ]
      },
      { 
        key: 'legal_shipping-returns', 
        title: 'Shipping & Returns',
        fields: [
          { name: 'title', label: 'Main Heading (Title)', type: 'text' },
          { name: 'body', label: 'Description (Body)', type: 'textarea' }
        ]
      },
    ]
  },
  {
    id: 'global',
    label: 'Global Elements',
    description: 'Elements that appear on multiple pages.',
    blocks: [
      { 
        key: 'announcement', 
        title: 'Announcement Bar',
        fields: [
          { name: 'body', label: 'Announcement Text (Body)', type: 'textarea' }
        ]
      },
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
    // Parse body as JSON if possible to extract custom fields
    let bodyData: any = {};
    if (curr.body) {
      try {
        bodyData = JSON.parse(curr.body);
      } catch (e) {
        // Fallback for legacy plain text body
        bodyData = { body: curr.body };
      }
    }
    acc[curr.key] = {
      title: curr.title || '',
      ...bodyData
    };
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
                const data = contentMap[block.key] || {};
                
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
                      <span className="text-[10px] font-mono bg-zinc-100 px-2 py-1 rounded text-zinc-700">
                        {block.key}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {block.fields.map((field) => (
                        <div key={field.name}>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--charcoal-ink)] mb-1">
                            {field.label}
                          </label>
                          {field.type === 'textarea' ? (
                            <textarea
                              name={field.name}
                              rows={4}
                              defaultValue={data[field.name] || ''}
                              placeholder="Leave empty to use default"
                              className="w-full border-2 border-[var(--charcoal-ink)]/20 bg-zinc-50/50 p-2 font-sans text-sm focus:outline-none focus:border-[var(--charcoal-ink)] resize-y transition-colors"
                            />
                          ) : (
                            <input
                              type="text"
                              name={field.name}
                              defaultValue={data[field.name] || ''}
                              placeholder="Leave empty to use default"
                              className="w-full border-2 border-[var(--charcoal-ink)]/20 bg-zinc-50/50 p-2 text-sm focus:outline-none focus:border-[var(--charcoal-ink)] transition-colors"
                            />
                          )}
                        </div>
                      ))}
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
