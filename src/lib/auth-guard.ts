import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Server-side guard for admin server components. The proxy (src/proxy.ts) already
 * protects /admin at the edge; this is defense-in-depth and gives server pages a
 * verified admin user. Redirects non-admins away.
 */
export async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/dashboard')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/')
  }

  return user
}
