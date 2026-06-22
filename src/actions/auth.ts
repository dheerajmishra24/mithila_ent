'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

import { sendSecurityAlertEmail } from '@/lib/email'
import { passwordError } from '@/lib/password'

export async function login(prevState: any, formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const nextPath = formData.get('next') as string || '/account'

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  // Rate limiting runs through SECURITY DEFINER functions so the auth_attempts
  // table is never exposed to the unauthenticated client.
  const { data: locked } = await supabase.rpc('auth_attempt_is_locked', { p_email: email })
  if (locked === true) {
    return { error: 'Account temporarily locked due to multiple failed attempts. Please try again later.' }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    const { data: res } = await supabase.rpc('auth_attempt_record_failure', { p_email: email })

    if (res?.justLocked) {
      await sendSecurityAlertEmail(email)
      return { error: 'Account temporarily locked due to multiple failed attempts. A security alert has been sent to your email.' }
    }
    if (res?.locked) {
      return { error: 'Account temporarily locked due to multiple failed attempts. Please try again later.' }
    }
    return { error: error?.message || 'Failed to login' }
  }

  // On success, clear the failure counter.
  await supabase.rpc('auth_attempt_clear', { p_email: email })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  revalidatePath('/', 'layout')

  if (profile?.role === 'admin') {
    redirect('/admin/dashboard')
  } else {
    redirect(nextPath)
  }
}

export async function register(prevState: any, formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const nextPath = formData.get('next') as string || '/account'

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  // Enforce the shared password policy (see src/lib/password.ts)
  const pwError = passwordError(password)
  if (pwError) {
    return { error: pwError }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (error || !data.user) {
    return { error: error?.message || 'Failed to register' }
  }

  // When email confirmation is enabled, signUp returns a user but NO session.
  // Redirecting into a protected route here would just bounce the user back to
  // /login via the proxy, so prompt them to confirm their email instead.
  if (!data.session) {
    return {
      success: 'Account created. Please check your email to confirm your address before signing in.',
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  revalidatePath('/', 'layout')

  if (profile?.role === 'admin') {
    redirect('/admin/dashboard')
  } else {
    redirect(nextPath)
  }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
