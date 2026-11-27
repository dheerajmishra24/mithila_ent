'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { sendSecurityAlertEmail } from '@/lib/email'
import { passwordError } from '@/lib/password'
import { safeNextPath } from '@/lib/safe-next'
import { authRedirectOrigin } from '@/lib/site-origin'
import { loginErrorMessage, signupErrorMessage } from '@/lib/auth-errors'

async function requestOrigin(): Promise<string> {
  const h = await headers()
  return authRedirectOrigin(h.get('host'), h.get('x-forwarded-proto'))
}

// Admins land on the dashboard. Asks the database (public.is_admin() reads
// public.user_roles, migration 0047), the same check the DAL and RLS use.
async function landingPath(supabase: Awaited<ReturnType<typeof createClient>>, nextPath: string) {
  // Admin rights need a second factor (migration 0053): a fresh password
  // sign-in never has one, so admins go to the two-step page first.
  const { data, error } = await supabase.rpc('admin_two_step_status')
  if (error) {
    // Before migration 0053 exists: the old rule, so the code can ship first.
    const { data: isAdmin } = await supabase.rpc('is_admin')
    return isAdmin === true ? '/admin/dashboard' : nextPath
  }
  const status = data as { admin_role?: boolean; second_factor?: boolean } | null
  if (status?.admin_role === true) return status.second_factor === true ? '/admin/dashboard' : '/admin-verify'
  return nextPath
}

// Failed attempts echo back what was typed (never the password), because
// React resets the form after an action and the fields would otherwise empty.

// FormData values can be File objects; keep only bounded strings (SEC-12).
function formString(formData: FormData, key: string, max: number): string {
  const v = formData.get(key)
  return typeof v === 'string' && v.length <= max ? v : ''
}

export async function login(prevState: unknown, formData: FormData) {
  const supabase = await createClient()
  const email = formString(formData, 'email', 254).trim()
  const password = formString(formData, 'password', 256)
  const nextPath = safeNextPath(formData.get('next'))

  if (!email || !password) {
    return { email, error: 'Email and password are required' }
  }

  // The lockout functions are EXECUTE-able by service_role only (migration 0042):
  // with the public anon key anyone could otherwise lock any account or clear
  // the counter between password guesses. Threshold and lock length are fixed
  // inside the database.
  const lockout = createAdminClient()
  const { data: locked } = await lockout.rpc('auth_attempt_is_locked', { p_email: email })
  if (locked === true) {
    return { email, error: 'Account temporarily locked due to multiple failed attempts. Please try again later.' }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    const { data: res } = await lockout.rpc('auth_attempt_record_failure', { p_email: email })

    if (res?.justLocked) {
      await sendSecurityAlertEmail(email)
      return { email, error: 'Account temporarily locked due to multiple failed attempts. A security alert has been sent to your email.' }
    }
    if (res?.locked) {
      return { email, error: 'Account temporarily locked due to multiple failed attempts. Please try again later.' }
    }
    console.warn('login failed:', error?.code ?? 'no_user', error?.status ?? '')
    return { email, error: loginErrorMessage(error) }
  }

  // On success, clear the failure counter.
  await lockout.rpc('auth_attempt_clear', { p_email: email })

  const destination = await landingPath(supabase, nextPath)
  revalidatePath('/', 'layout')
  redirect(destination)
}

export async function register(prevState: unknown, formData: FormData) {
  const supabase = await createClient()
  const email = formString(formData, 'email', 254).trim()
  const password = formString(formData, 'password', 256)
  const fullName = formString(formData, 'fullName', 100).trim()
  const nextPath = safeNextPath(formData.get('next'))

  if (!email || !password) {
    return { email, fullName, error: 'Email and password are required' }
  }

  // Enforce the shared password policy (see src/lib/password.ts)
  const pwError = passwordError(password)
  if (pwError) {
    return { email, fullName, error: pwError }
  }

  const origin = await requestOrigin()
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  })

  if (error || !data.user) {
    console.warn('signup failed:', error?.code ?? 'no_user', error?.status ?? '')
    return { email, fullName, error: signupErrorMessage(error) }
  }

  // When email confirmation is enabled, signUp returns a user but NO session.
  // Redirecting into a protected route here would just bounce the user back to
  // /login via the proxy, so prompt them to confirm their email instead.
  if (!data.session) {
    return {
      success: 'Account created. Please check your email to confirm your address before signing in.',
    }
  }

  const destination = await landingPath(supabase, nextPath)
  revalidatePath('/', 'layout')
  redirect(destination)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

// Building the OAuth URL never fails, even when the Google provider is switched
// off; the shopper would then land on Supabase's raw JSON error. Ask Auth's
// public settings first and send them back to /login with a clear message.
async function googleEnabled(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return false
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    })
    if (!res.ok) return false
    const settings = (await res.json()) as { external?: { google?: boolean } }
    return settings.external?.google === true
  } catch {
    return false
  }
}

export async function signInWithGoogle(formData: FormData) {
  if (!(await googleEnabled())) {
    redirect('/login?error=google_unavailable')
  }
  const supabase = await createClient()
  const origin = await requestOrigin()
  const nextPath = safeNextPath(formData.get('next'))
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  })

  if (error || !data.url) {
    console.warn('google sign-in unavailable:', error?.code ?? 'no_url')
    redirect('/login?error=google_unavailable')
  }
  redirect(data.url)
}

