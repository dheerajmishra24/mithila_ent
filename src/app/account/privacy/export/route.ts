import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/dal/session';
import { buildMyDataExport } from '@/lib/dal/privacy';

// "Download your data" (DPDP Act s.11). Signed-in person only, their own
// data only; never cached anywhere.

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await buildMyDataExport();
    const day = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="mithila-my-data-${day}.json"`,
        'cache-control': 'no-store, private',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (e) {
    // Relative Location: no host from the request is trusted.
    if (e instanceof AuthError) return new Response(null, { status: 303, headers: { location: '/login?next=/account/privacy', 'cache-control': 'no-store' } });
    if ((e as Error).message === 'TOO_MANY') return NextResponse.json({ error: 'Too many downloads today. Please try tomorrow.' }, { status: 429 });
    console.error('data export failed:', (e as Error).message);
    return NextResponse.json({ error: 'Could not prepare your data. Please try again.' }, { status: 500 });
  }
}
