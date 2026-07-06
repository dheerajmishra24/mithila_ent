import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Hard gate: only works in LOCAL development AND only with an explicit opt-in
// flag. Returns 404 in production, on ANY Vercel deployment, or without the flag,
// so it can never expose the dashboard on the live site. This performs a REAL
// Supabase sign-in (no auth bypass) — proxy.ts + requireAdmin stay fully in force.
function devLoginEnabled() {
  return (
    process.env.NODE_ENV !== 'production' &&
    !process.env.VERCEL &&
    process.env.DEV_AUTOLOGIN === 'true'
  )
}

export async function GET(request: NextRequest) {
  if (!devLoginEnabled()) {
    return new NextResponse('Not found', { status: 404 })
  }

  const email = process.env.DEV_ADMIN_EMAIL
  const password = process.env.DEV_ADMIN_PASSWORD
  if (!email || !password) {
    return NextResponse.json(
      { error: 'Set DEV_ADMIN_EMAIL and DEV_ADMIN_PASSWORD in .env.local to use dev auto-login.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Normal sign-in first.
  let { error } = await supabase.auth.signInWithPassword({ email, password })

  // Dev convenience: if the account doesn't exist yet, provision it and retry.
  if (error) {
    try {
      const admin = createAdminClient()
      const { error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (createErr && !/already|registered|exists/i.test(createErr.message)) {
        return NextResponse.json({ error: createErr.message }, { status: 500 })
      }
      const retry = await supabase.auth.signInWithPassword({ email, password })
      error = retry.error
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'dev provisioning failed'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  // Ensure the signed-in dev user has the admin role.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const admin = createAdminClient()
      await admin.from('profiles').upsert({ id: user.id, role: 'admin' })
    }
  } catch {
    // non-fatal
  }

  return NextResponse.redirect(new URL('/admin/dashboard', request.url))
}
