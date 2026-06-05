import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MOCK_VARIANTS = [
  {
    id: 'mock-1',
    color: 'Crimson Red',
    price: 1200,
    stock_quantity: 10,
    images: ['https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=600&auto=format&fit=crop'],
    product_id: 'prod-1',
    products: {
      id: 'prod-1',
      title: 'Hand-spun Cotton Tunic',
      slug: 'hand-spun-cotton-tunic',
      description: 'Premium hand-spun cotton tunic featuring intricate Jamdani weave patterns. Perfect for casual or semi-formal wear with deep crimson hues naturally dyed from botanical sources.',
      weave: 'Jamdani',
      gsm: 150,
      is_featured: true,
      tags: ['cotton', 'stitched'],
      categories: { name: 'Stitched Wear', slug: 'stitched-wear' }
    }
  },
  {
    id: 'mock-2',
    color: 'Natural Ecru',
    price: 850,
    stock_quantity: 25,
    images: ['https://images.unsplash.com/photo-1605289982774-9a6fef564df8?q=80&w=600&auto=format&fit=crop'],
    product_id: 'prod-2',
    products: {
      id: 'prod-2',
      title: 'Raw Silk Yardage',
      slug: 'raw-silk-yardage',
      description: 'Pure, unbleached Tussar silk yardage. Loomed by heritage artisans, this fabric showcases the raw, natural elegance and texture of organic silk. Sold per meter.',
      weave: 'Tussar',
      gsm: 120,
      is_featured: false,
      tags: ['silk'],
      categories: { name: 'Fabric', slug: 'fabric' }
    }
  },
  {
    id: 'mock-3',
    color: 'Indigo Blue',
    price: 1450,
    stock_quantity: 5,
    images: ['https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?q=80&w=600&auto=format&fit=crop'],
    product_id: 'prod-3',
    products: {
      id: 'prod-3',
      title: 'Botanical Dyed Linen',
      slug: 'botanical-dyed-linen',
      description: 'Highly breathable linen, dyed using fermented indigo plants. This plain weave fabric offers superior comfort and gets softer with every wash.',
      weave: 'Plain',
      gsm: 180,
      is_featured: true,
      tags: ['linen'],
      categories: { name: 'Fabric', slug: 'fabric' }
    }
  },
  {
    id: 'mock-4',
    color: 'Turmeric Yellow',
    price: 950,
    stock_quantity: 40,
    images: ['https://images.unsplash.com/photo-1584346747551-5120352fb387?q=80&w=600&auto=format&fit=crop'],
    product_id: 'prod-4',
    products: {
      id: 'prod-4',
      title: 'Organic Cotton Weave',
      slug: 'organic-cotton-weave',
      description: 'GOTS certified organic cotton woven in a soft satin finish. Naturally dyed with turmeric roots, this fabric offers a vibrant, sunshine glow.',
      weave: 'Satin',
      gsm: 160,
      is_featured: false,
      tags: ['cotton'],
      categories: { name: 'Fabric', slug: 'fabric' }
    }
  }
];

async function seed() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  console.log("Signing up admin user...");
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: 'dheeraj.mishra02@gmail.com',
    password: 'admin123'
  });

  if (authError && authError.message !== 'User already registered') {
    console.error("Auth error:", authError);
    process.exit(1);
  }

  // Sign in to make sure we have a session
  await supabase.auth.signInWithPassword({
    email: 'dheeraj.mishra02@gmail.com',
    password: 'admin123'
  });

  const { data: user } = await supabase.auth.getUser();
  if (user?.user?.id) {
    console.log("Setting user role to admin...");
    await supabase.from('profiles').update({ role: 'admin' }).eq('id', user.user.id);
  }

  console.log("Seeding categories...");
  const categoryNames = [...new Set(MOCK_VARIANTS.map(v => v.products.categories.name))];
  const categoryIds = {};
  for (const name of categoryNames) {
    const slug = name.toLowerCase().replace(/\\s+/g, '-');
    const { data, error } = await supabase.from('categories').insert({ name, slug }).select().single();
    if (error) {
      if (error.code === '23505') {
        const { data: existing } = await supabase.from('categories').select('id').eq('slug', slug).single();
        if (existing) categoryIds[name] = existing.id;
      } else {
        console.error("Error inserting category:", error);
      }
    } else {
      categoryIds[name] = data.id;
    }
  }

  console.log("Seeding products and variants...");
  for (const v of MOCK_VARIANTS) {
    const p = v.products;
    const catId = categoryIds[p.categories.name];
    
    // Insert Product
    const { data: prodData, error: prodError } = await supabase.from('products').insert({
      category_id: catId,
      slug: p.slug,
      title: p.title,
      description: p.description,
      weave: p.weave,
      gsm: p.gsm,
      is_featured: p.is_featured,
      tags: p.tags,
      status: 'active'
    }).select().single();

    let productId = prodData?.id;

    if (prodError) {
      if (prodError.code === '23505') {
        const { data: existing } = await supabase.from('products').select('id').eq('slug', p.slug).single();
        productId = existing?.id;
      } else {
        console.error("Error inserting product:", prodError);
        continue;
      }
    }

    if (productId) {
      // Insert Variant
      const sku = `${p.slug.substring(0,3).toUpperCase()}-${v.color.substring(0,3).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
      await supabase.from('product_variants').insert({
        product_id: productId,
        sku: sku,
        color: v.color,
        price: v.price,
        stock_quantity: v.stock_quantity,
        images: v.images
      });
    }
  }

  console.log("Seeding sample orders...");
  // Get variants for order items
  const { data: dbVariants } = await supabase.from('product_variants').select('id, price').limit(2);
  
  if (dbVariants && dbVariants.length > 0 && user?.user?.id) {
    const { data: orderData, error: orderError } = await supabase.from('orders').insert({
      user_id: user.user.id,
      status: 'paid',
      subtotal: dbVariants[0].price * 2,
      total_amount: dbVariants[0].price * 2,
      shipping_address: { full_name: 'Aditi Sharma', address: '12 Weaver Lane', city: 'Varanasi', zip: '221001' },
      is_paid: true
    }).select().single();

    if (orderData) {
      await supabase.from('order_items').insert({
        order_id: orderData.id,
        variant_id: dbVariants[0].id,
        quantity: 2,
        unit_price: dbVariants[0].price
      });
    }
  }

  console.log("Database seeded successfully!");
  process.exit(0);
}

seed().catch(console.error);
