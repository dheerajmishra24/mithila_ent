import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export default async function proxy(request: NextRequest) {
  // First run the supabase auth & role checks
  const response = await updateSession(request);

  // If updateSession returned a redirect (e.g. enforcing /login), return immediately
  if (response.headers.has('location')) {
    return response;
  }

  // Basic security headers
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Cloudflare GEO logic
  const country = request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country') || 'US';
  response.headers.set('x-user-country', country);

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
