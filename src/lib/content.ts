import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

// Cookie-less anon client for public storefront reads (static/ISR friendly).
function anon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );
}

export type StoreSettings = {
  store_name: string;
  support_email: string;
  support_phone: string;
};

const DEFAULT_SETTINGS: StoreSettings = {
  store_name: 'Mithila Enterprises',
  support_email: 'mithlaenterprises11@gmail.com',
  support_phone: '+91 9818555220',
};

// Cached so the storefront chrome doesn't hit the DB on every request.
// The admin actions call revalidateTag('store-settings' | 'site-content') for instant refresh.
export const getStoreSettings = unstable_cache(
  async (): Promise<StoreSettings> => {
    try {
      const { data } = await anon()
        .from('store_settings')
        .select('store_name, support_email, support_phone')
        .eq('id', true)
        .single();
      return {
        store_name: data?.store_name || DEFAULT_SETTINGS.store_name,
        support_email: data?.support_email || DEFAULT_SETTINGS.support_email,
        support_phone: data?.support_phone || DEFAULT_SETTINGS.support_phone,
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },
  ['store-settings'],
  { revalidate: 60, tags: ['store-settings'] }
);

export const getSiteContentMap = unstable_cache(
  async (): Promise<Record<string, { title: string; body: string }>> => {
    try {
      const { data } = await anon().from('site_content').select('key, title, body');
      const map: Record<string, { title: string; body: string }> = {};
      for (const r of data || []) {
        map[(r as any).key] = { title: (r as any).title || '', body: (r as any).body || '' };
      }
      return map;
    } catch {
      return {};
    }
  },
  ['site-content'],
  { revalidate: 60, tags: ['site-content'] }
);


export const getLatestVariants = unstable_cache(
  async (): Promise<any[]> => {
    try {
      const { data } = await anon()
        .from('product_variants')
        .select('id, color, price, images, products(title, slug, weave)')
        .order('created_at', { ascending: false })
        .limit(8);
      return data || [];
    } catch {
      return [];
    }
  },
  ['latest-variants'],
  { revalidate: 60, tags: ['latest-products'] }
);
