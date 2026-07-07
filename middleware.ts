/**
 * middleware.ts
 * Route protection middleware for the Sterling Pawnshop app.
 *
 * Features:
 * - Unauthenticated users visiting any protected route → redirected to /login
 * - Authenticated users visiting /login → redirected to dashboard (/)
 * - Login rate limiting: 5 attempts per IP per 15 minutes
 * - Uses getSession() for fast local JWT verification (no remote call)
 * - Static assets, _next internals, and favicon are excluded from checks
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { loginLimiter } from '@/lib/rate-limit';

/**
 * Extracts a client identifier from the request for rate limiting.
 * Falls back to a generic key if no forwarded IP is available.
 *
 * @param request - The incoming Next.js request
 * @returns A string identifier for the client
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.ip ||
    'unknown'
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Login rate limiting (POST to /login is the actual auth attempt) ──
  // We also rate-limit aggressive GET requests to /login to deter bots
  if (pathname === '/login') {
    const clientIp = getClientIp(request);
    const { allowed, retryAfterMs } = loginLimiter.check(clientIp);

    if (!allowed) {
      const retrySeconds = Math.ceil(retryAfterMs / 1000);

      // Return a 429 page with a user-friendly message
      return new NextResponse(
        `<!DOCTYPE html>
        <html lang="en">
        <head><meta charset="utf-8"><title>Too Many Attempts</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0f0f11; color: #e4e4e7;
                 display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .box { text-align: center; max-width: 400px; padding: 40px; }
          h1 { font-size: 1.5rem; margin-bottom: 12px; color: #d4a853; }
          p { color: #71717a; line-height: 1.6; }
          .timer { font-size: 2rem; font-weight: 700; color: #d4a853; margin: 20px 0; }
        </style>
        </head>
        <body>
          <div class="box">
            <h1>Too Many Login Attempts</h1>
            <p>You've exceeded the maximum number of login attempts.</p>
            <div class="timer">${Math.ceil(retryAfterMs / 60000)} min</div>
            <p>Please wait before trying again.</p>
          </div>
        </body>
        </html>`,
        {
          status: 429,
          headers: {
            'Content-Type': 'text/html',
            'Retry-After': String(retrySeconds),
          },
        }
      );
    }
  }

  // ── Supabase session check ──
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
            supabaseResponse.cookies.set(name, value, {
              ...options,
              // Override SameSite to Lax for security — prevents CSRF while
              // keeping cookie available for same-site navigations.
              sameSite: 'lax',
            })
          );
        },
      },
    }
  );

  // P5: Use getSession() for fast local JWT verification instead of
  // getUser() which makes a remote HTTP call to Supabase on every request.
  // Trade-off: won't detect banned/deleted users until JWT expires (~1hr).
  // Acceptable for an internal staff tool with few users.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;

  // ── Not logged in → send to /login ──────────────────────────────────────
  if (!user && pathname !== '/login') {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // ── Already logged in, hit /login → send to dashboard ───────────────────
  if (user && pathname === '/login') {
    // Reset rate limit on successful session (user already authenticated)
    const clientIp = getClientIp(request);
    loginLimiter.reset(clientIp);
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
    '/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|api/notify-due|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
