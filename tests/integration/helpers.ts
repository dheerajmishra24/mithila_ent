import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Integration tests run against a REAL Supabase test project. Provide:
//   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SERVICE_KEY
// (falls back to the app's own env if you point it at a disposable project).
export const TEST_URL = process.env.SUPABASE_TEST_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const TEST_ANON = process.env.SUPABASE_TEST_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const TEST_SERVICE = process.env.SUPABASE_TEST_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const haveTestDb = !!(TEST_URL && TEST_ANON && TEST_SERVICE);

export function serviceClient(): SupabaseClient {
  return createClient(TEST_URL, TEST_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function anonClient(): SupabaseClient {
  return createClient(TEST_URL, TEST_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function makeUser(email: string, password = 'Test-User-1234!') {
  const svc = serviceClient();
  const { error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  if (error && !/already/i.test(error.message)) throw error;
  const { data: list } = await svc.auth.admin.listUsers();
  const userId = list.users.find((u) => u.email === email)?.id as string;
  // ensure a profile exists (handle_new_user trigger should do this anyway)
  await svc.from('profiles').upsert({ id: userId, role: 'retail' });
  const client = anonClient();
  await client.auth.signInWithPassword({ email, password });
  return { client, userId };
}

export async function setAdmin(userId: string) {
  await serviceClient().from('profiles').upsert({ id: userId, role: 'admin' });
}

export async function deleteUser(email: string) {
  const svc = serviceClient();
  const { data: list } = await svc.auth.admin.listUsers();
  const u = list.users.find((x) => x.email === email);
  if (u) await svc.auth.admin.deleteUser(u.id);
}

export async function seedVariant(price = 500, stock = 5) {
  const svc = serviceClient();
  const slug = 'test-' + Math.random().toString(36).slice(2, 9);
  const { data: prod } = await svc.from('products').insert({ slug, title: 'Test Fabric', status: 'active' }).select('id').single();
  const sku = 'TST-' + Math.random().toString(36).slice(2, 9).toUpperCase();
  const { data: variant } = await svc
    .from('product_variants')
    .insert({ product_id: prod!.id, sku, color: 'Test', price, stock_quantity: stock })
    .select('id, price, stock_quantity')
    .single();
  return { productId: prod!.id as string, variantId: variant!.id as string, price, stock };
}

export async function seedDiscount(code: string, type: string, value: number) {
  const svc = serviceClient();
  await svc.from('discounts').upsert({ code, type, value, is_active: true }, { onConflict: 'code' });
}
