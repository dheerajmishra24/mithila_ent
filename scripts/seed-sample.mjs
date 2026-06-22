/**
 * Sample data seeder for Mithila Enterprises.
 *
 * Inserts categories, products (with multiple colour variants spanning every
 * filter facet), and three test coupons. Idempotent: safe to run repeatedly
 * (upserts on slug / sku / code).
 *
 * Run:  node scripts/seed-sample.mjs
 *   (optional) promote an existing signed-up user to admin:
 *       SEED_ADMIN_EMAIL=you@example.com node scripts/seed-sample.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const IMG = (id) => `https://images.unsplash.com/${id}?q=80&w=600&auto=format&fit=crop`;
const IMGS = [
  IMG('photo-1528698827591-e19ccd7bc23d'),
  IMG('photo-1605289982774-9a6fef564df8'),
  IMG('photo-1620799140408-edc6dcb6d633'),
  IMG('photo-1584346747551-5120352fb387'),
];

// Slugs match the shop's category filter so /shop?category=<slug> works.
const categories = [
  { slug: 'linen', name: 'Linen' },
  { slug: 'cotton', name: 'Cotton' },
  { slug: 'wool', name: 'Wool' },
  { slug: 'twill', name: 'Twill' },
  { slug: 'flannel', name: 'Flannel' },
  { slug: 'viscose', name: 'Viscose' },
];

// Spread across GSM (light/medium/heavy), price (budget/standard/premium),
// colours, featured flags, and plain/printed style tags.
const products = [
  {
    slug: 'botanical-indigo-linen', title: 'Botanical Indigo Linen', category: 'linen',
    description: 'Highly breathable linen dyed with fermented indigo. A plain weave that softens with every wash and drapes with an easy, authoritative fall.',
    weave: 'Plain', gsm: 180, is_featured: true, tags: ['linen', 'plain'],
    best_suited_for: ['Unlined blazers', 'Summer shirting'],
    variants: [
      { color: 'Indigo Blue', price: 1450, stock: 30, img: IMGS[0] },
      { color: 'Natural Ecru', price: 1450, stock: 22, img: IMGS[1] },
    ],
  },
  {
    slug: 'handspun-cotton-sheeting', title: 'Handspun Cotton Sheeting', category: 'cotton',
    description: 'GOTS-certified organic cotton in a soft, breathable plain weave. A reliable everyday foundation for both structured and relaxed garments.',
    weave: 'Plain', gsm: 150, is_featured: false, tags: ['cotton', 'plain'],
    best_suited_for: ['Kurtas', 'Daily shirting', 'Linings'],
    variants: [
      { color: 'Crimson Red', price: 950, stock: 45, img: IMGS[2] },
      { color: 'Turmeric Yellow', price: 950, stock: 38, img: IMGS[3] },
      { color: 'Ivory White', price: 950, stock: 50, img: IMGS[1] },
    ],
  },
  {
    slug: 'merino-wool-tweed', title: 'Merino Wool Tweed', category: 'wool',
    description: 'Heavily spun merino in a rough, protective tweed matrix. Repels wind and holds rigid shape — built for severe-cold tailoring.',
    weave: 'Tweed', gsm: 320, is_featured: true, tags: ['wool', 'printed'],
    best_suited_for: ['Overcoats', 'Structured outerwear'],
    variants: [
      { color: 'Charcoal', price: 2400, stock: 12, img: IMGS[0] },
      { color: 'Forest Green', price: 2400, stock: 8, img: IMGS[2] },
    ],
  },
  {
    slug: 'diagonal-cotton-twill', title: 'Diagonal Cotton Twill', category: 'twill',
    description: 'A tightly packed diagonal weave that resists tearing and abrasion. Heavy construction blocks wind and yields a crisp, durable drape.',
    weave: 'Twill', gsm: 240, is_featured: false, tags: ['twill', 'plain'],
    best_suited_for: ['Trousers', 'Workwear jackets'],
    variants: [
      { color: 'Khaki', price: 1300, stock: 26, img: IMGS[3] },
      { color: 'Slate', price: 1300, stock: 19, img: IMGS[0] },
    ],
  },
  {
    slug: 'brushed-winter-flannel', title: 'Brushed Winter Flannel', category: 'flannel',
    description: 'Surface-brushed flannel with a heat-trapping nap. Thick, soft, and highly efficient at blocking cold air.',
    weave: 'Flannel', gsm: 220, is_featured: false, tags: ['flannel', 'printed'],
    best_suited_for: ['Winter shirts', 'Pyjamas'],
    variants: [
      { color: 'Rust', price: 1100, stock: 33, img: IMGS[2] },
      { color: 'Midnight', price: 1100, stock: 28, img: IMGS[1] },
    ],
  },
  {
    slug: 'featherlight-viscose', title: 'Featherlight Viscose', category: 'viscose',
    description: 'A fluid, lightweight viscose that drapes close to the body with a cool, smooth hand-feel. Absorbs moisture quickly and resists static.',
    weave: 'Plain', gsm: 120, is_featured: false, tags: ['viscose', 'plain'],
    best_suited_for: ['Flowy dresses', 'Drape-heavy blouses'],
    variants: [
      { color: 'Blush Pink', price: 780, stock: 41, img: IMGS[3] },
      { color: 'Ivory', price: 780, stock: 36, img: IMGS[1] },
    ],
  },
];

const coupons = [
  { code: 'WELCOME10', type: 'percentage', value: 10, is_active: true, min_order_value: null, max_uses: null },
  { code: 'FLAT200', type: 'fixed_amount', value: 200, is_active: true, min_order_value: 1000, max_uses: 100 },
  { code: 'FREESHIP', type: 'free_shipping', value: 0, is_active: true, min_order_value: null, max_uses: null },
];

const sku = (slug, color) =>
  `${slug.substring(0, 4).toUpperCase()}-${color.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase()}`;

async function main() {
  // Categories
  const { data: catRows, error: catErr } = await supabase
    .from('categories')
    .upsert(categories, { onConflict: 'slug' })
    .select('id, slug');
  if (catErr) { console.error('✗ categories:', catErr.message); process.exit(1); }
  const catId = Object.fromEntries(catRows.map((c) => [c.slug, c.id]));
  console.log(`✓ ${catRows.length} categories`);

  // Products + variants
  let pCount = 0, vCount = 0;
  for (const p of products) {
    const { data: prod, error: pErr } = await supabase
      .from('products')
      .upsert(
        {
          category_id: catId[p.category] || null,
          slug: p.slug, title: p.title, description: p.description,
          weave: p.weave, gsm: p.gsm, is_featured: p.is_featured, tags: p.tags,
          best_suited_for: p.best_suited_for, status: 'active',
        },
        { onConflict: 'slug' }
      )
      .select('id')
      .single();
    if (pErr) { console.error(`✗ product ${p.slug}:`, pErr.message); continue; }
    pCount++;

    const variants = p.variants.map((v) => ({
      product_id: prod.id,
      sku: sku(p.slug, v.color),
      color: v.color, price: v.price, stock_quantity: v.stock, images: [v.img],
    }));
    const { error: vErr } = await supabase
      .from('product_variants')
      .upsert(variants, { onConflict: 'sku' });
    if (vErr) { console.error(`✗ variants ${p.slug}:`, vErr.message); continue; }
    vCount += variants.length;
  }
  console.log(`✓ ${pCount} products, ${vCount} variants`);

  // Coupons
  const { data: cpRows, error: cpErr } = await supabase
    .from('discounts')
    .upsert(coupons, { onConflict: 'code' })
    .select('code');
  if (cpErr) console.error('✗ coupons:', cpErr.message);
  else console.log(`✓ ${cpRows.length} coupons: ${cpRows.map((c) => c.code).join(', ')}`);

  // Optional: promote an existing user to admin
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  if (adminEmail) {
    const { data: list, error: lErr } = await supabase.auth.admin.listUsers();
    if (lErr) {
      console.error('✗ listUsers:', lErr.message);
    } else {
      const u = list.users.find((x) => (x.email || '').toLowerCase() === adminEmail.toLowerCase());
      if (u) {
        const { error: upErr } = await supabase.from('profiles').upsert({ id: u.id, role: 'admin' });
        if (upErr) console.error('✗ promote admin:', upErr.message);
        else console.log(`✓ promoted ${adminEmail} to admin`);
      } else {
        console.warn(`! ${adminEmail} not found — have them sign up first, then re-run.`);
      }
    }
  }

  console.log('\nSeed complete.');
  console.log('Test coupons:  WELCOME10 (10% off)   FLAT200 (₹200 off orders ₹1000+)   FREESHIP (free shipping)');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
