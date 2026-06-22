import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { notFound } from 'next/navigation';
import EditProductForm from './EditProductForm';

export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from('products')
    .select('*, product_variants(*)')
    .eq('id', id)
    .single();

  if (!product) {
    notFound();
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('name');

  return <EditProductForm product={product} categories={categories || []} />;
}
