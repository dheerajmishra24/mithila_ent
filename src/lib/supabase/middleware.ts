import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let ratelimit: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(20, '10 s'),
    analytics: true,
  });
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // 1. Rate Limiting Logic (Upstash Redis)
  if (ratelimit) {
    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
    const { success, limit, reset, remaining } = await ratelimit.limit(`ratelimit_${ip}`)

    if (!success) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        },
      })
    }
  }

  // 2. Supabase Auth Logic
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon-key',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Route protection (routing only: every page, action and route handler
  // re-checks through the DAL in src/lib/dal/session.ts).
  const pathname = request.nextUrl.pathname
  const needsUser = pathname.startsWith('/account') || pathname.startsWith('/admin')

  if (needsUser && !user) {
    // Send them back where they were going once they sign in. The login page
    // passes this through safeNextPath, so it can only be a same-site path.
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(url)
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    // Same rule as the DAL and RLS (public.is_admin(), migration 0053): the
    // admin role AND a second factor in the last 12 hours. Admins who have
    // only signed in with a password go to the two-step page.
    const { data, error } = await supabase.rpc('admin_two_step_status')
    let status = data as { admin_role?: boolean; second_factor?: boolean } | null
    if (error) {
      // Before migration 0053 exists: plain is_admin(), so the code can ship first.
      const { data: legacy } = await supabase.rpc('is_admin')
      status = { admin_role: legacy === true, second_factor: legacy === true }
    }
    if (!(status?.admin_role === true && status.second_factor === true)) {
      const url = request.nextUrl.clone()
      url.pathname = status?.admin_role === true ? '/admin-verify' : '/'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
