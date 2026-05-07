/**
 * middleware.ts
 * Route protection middleware for the Sterling Pawnshop app.
 *
 * - Unauthenticated users visiting any protected route → redirected to /login
 * - Authenticated users visiting /login → redirected to dashboard (/)
 * - Static assets, _next internals, and favicon are excluded from checks
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Start with a passthrough response; we'll mutate it to refresh cookies
  let supabaseResponse = NextResponse.next({ request });

  // Create a server-side Supabase client that reads/writes cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        /** Read all cookies from the incoming request */
        getAll() {
          return request.cookies.getAll();
        },
        /** Write refreshed cookies back to both request and response */
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Fetch the currently authenticated user (verifies JWT with Supabase server)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ── Not logged in → send to /login ──────────────────────────────────────
  if (!user && pathname !== '/login') {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // ── Already logged in, hit /login → send to dashboard ───────────────────
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // ── Authenticated & not on /login → proceed normally ────────────────────
  return supabaseResponse;
}

/**
 * Apply middleware to all routes except Next.js internals and static assets.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
