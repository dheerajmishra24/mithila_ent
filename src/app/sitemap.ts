import { MetadataRoute } from 'next';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSiteUrl } from '@/lib/site-url';
import { getAllPosts } from '@/lib/blog-data';
import { fabricData } from '@/lib/fabric-data';
import { getAllWholesaleSlugs } from '@/lib/wholesale-data';

export const revalidate = 86400; // Cache sitemap for 24 hours

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/shop`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${baseUrl}/remnants`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/wholesale`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/legal/privacy-policy`,
      lastModified: new Date('2026-01-09'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/legal/terms-of-service`,
      lastModified: new Date('2026-01-09'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/legal/shipping-returns`,
      lastModified: new Date('2026-01-09'),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];

  // Blog posts
  const blogPosts = getAllPosts();
  const blogUrls: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // Categories (fetch from Supabase with static fallback to fabricData)
  let categorySlugs = Object.keys(fabricData);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
      const { data: categories } = await supabase.from('categories').select('slug, created_at');
      if (categories && categories.length > 0) {
        const dbSlugs = categories.map((c) => c.slug);
        categorySlugs = Array.from(new Set([...categorySlugs, ...dbSlugs]));
      }
    } catch (err) {
      console.warn('Sitemap category fetch error:', err);
    }
  }

  const categoryUrls: MetadataRoute.Sitemap = categorySlugs.map((slug) => ({
    url: `${baseUrl}/category/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.85,
  }));

  // Products
  let productUrls: MetadataRoute.Sitemap = [];
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
      const { data: products } = await supabase.from('products').select('slug, created_at');
      if (products && products.length > 0) {
        productUrls = products.map((product) => ({
          url: `${baseUrl}/product/${product.slug}`,
          lastModified: product.created_at ? new Date(product.created_at) : new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        }));
      }
    } catch (err) {
      console.warn('Sitemap product fetch error:', err);
    }
  }

  // Wholesale specialized hubs
  const wholesaleUrls: MetadataRoute.Sitemap = getAllWholesaleSlugs().map((slug) => ({
    url: `${baseUrl}/wholesale/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.85,
  }));

  return [...staticRoutes, ...categoryUrls, ...wholesaleUrls, ...blogUrls, ...productUrls];
}
