import { NextRequest, NextResponse } from 'next/server';
import { smsGlobalLimiter } from '@/lib/rate-limit';
import { createServerClient } from '@supabase/ssr';

/**
 * Extracts a client identifier from the request for rate limiting.
 * Falls back to a generic key if no forwarded IP is available.
 */
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.ip ||
    'unknown'
  );
}

/**
 * Format helper for Ghana numbers.
 * Converts to 233... international format.
 *
 * @param raw - Raw phone string (may include spaces, dashes, etc.)
 * @returns Formatted number string, or empty string on failure.
 */
function formatGhanaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  if (!digits) return '';

  if (digits.startsWith('0')) {
    return '233' + digits.substring(1);
  }

  if (digits.startsWith('233')) {
    return digits;
  }

  // Bare 9-digit number (leading 0 omitted)
  if (digits.length === 9) {
    return '233' + digits;
  }

  return digits;
}

/**
 * POST handler for the Arkesel v1 SMS gateway.
 *
 * Security measures:
 * - Authenticated users only (verified via Supabase session)
 * - Rate-limited: 20 calls per hour per IP (shared with global SMS limiter)
 * - API key NEVER returned in any response
 * - Raw Arkesel response text never echoed back to the client
 * - Hardcoded fallback key removed — env var is the sole source
 */
export async function POST(req: NextRequest) {
  // ── 1. Verify authenticated session ──────────────────────────────────────
  // Defense-in-depth: middleware already guards this route, but we double-check
  // here so even if middleware config changes, this endpoint stays protected.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  // ── 2. Rate limiting ──────────────────────────────────────────────────────
  // Re-use the global SMS limiter (20 sends/hr) keyed by IP.
  const clientIp = getClientIp(req);
  const rateLimit = smsGlobalLimiter.check(clientIp);
  if (!rateLimit.allowed) {
    const retryMinutes = Math.ceil(rateLimit.retryAfterMs / 60_000);
    return NextResponse.json(
      {
        success: false,
        message: `Too many SMS requests. Please wait ${retryMinutes} minute${retryMinutes !== 1 ? 's' : ''} before trying again.`,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) },
      }
    );
  }

  // ── 3. Parse and validate request body ───────────────────────────────────
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body.' }, { status: 400 });
  }

  const { action, to, sms, schedule, from } = body;

  // Only use the server-side env var — never accept an API key from the client.
  // This prevents any key from being intercepted via request inspection.
  const key = process.env.ARKESEL_API_KEY;
  if (!key) {
    console.error('[SMS Route] ARKESEL_API_KEY environment variable is not set.');
    return NextResponse.json(
      { success: false, message: 'SMS service is not configured. Contact the administrator.' },
      { status: 503 }
    );
  }

  // Sender ID: use request param (so staff can set it via UI), but clamp to 11 chars.
  // Falls back to env var, then to 'Pawnshop'.
  const senderRaw = (from || process.env.ARKESEL_SENDER_ID || 'Pawnshop') as string;
  const sender = senderRaw.substring(0, 11);

  // ── 4. Action: check-balance ──────────────────────────────────────────────
  if (action === 'check-balance') {
    try {
      const url = new URL('https://sms.arkesel.com/sms/api');
      url.searchParams.set('action', 'check-balance');
      url.searchParams.set('api_key', key);
      url.searchParams.set('response', 'json');

      const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });

      if (!res.ok) {
        return NextResponse.json(
          { success: false, message: 'Could not reach the SMS gateway. Please try again.' },
          { status: 502 }
        );
      }

      const data = await res.json();
      return NextResponse.json({ success: true, data });
    } catch (err) {
      console.error('[SMS Route] Balance check error:', err);
      return NextResponse.json({ success: false, message: 'Network error contacting SMS gateway.' }, { status: 502 });
    }
  }

  // ── 5. Action: send-sms ───────────────────────────────────────────────────
  if (action === 'send-sms') {
    if (!to || typeof to !== 'string') {
      return NextResponse.json({ success: false, message: 'Recipient phone number is required.' }, { status: 400 });
    }
    if (!sms || typeof sms !== 'string' || !sms.trim()) {
      return NextResponse.json({ success: false, message: 'SMS message content is required.' }, { status: 400 });
    }
    if (sms.length > 1600) {
      return NextResponse.json({ success: false, message: 'Message is too long (max 1600 characters).' }, { status: 400 });
    }

    // Format and validate phone number
    const formattedTo = formatGhanaPhone(to);
    if (!formattedTo || formattedTo.length < 10 || formattedTo.length > 15) {
      return NextResponse.json(
        { success: false, message: 'Invalid phone number. Please enter a valid Ghana number.' },
        { status: 400 }
      );
    }

    try {
      const url = new URL('https://sms.arkesel.com/sms/api');
      url.searchParams.set('action', 'send-sms');
      url.searchParams.set('api_key', key);
      url.searchParams.set('to', formattedTo);
      url.searchParams.set('from', sender);
      url.searchParams.set('sms', sms);

      if (schedule && typeof schedule === 'string') {
        url.searchParams.set('schedule', schedule);
      }

      const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
      if (!res.ok) {
        return NextResponse.json(
          { success: false, message: 'Could not reach the SMS gateway. Please try again.' },
          { status: 502 }
        );
      }

      // Parse Arkesel v1 status code — never echo the raw response to the client
      const trimmedResponse = (await res.text()).trim();

      // Status codes: 1000 = OK; others are errors
      const isSuccess =
        trimmedResponse === '1000' ||
        trimmedResponse.toLowerCase() === 'ok' ||
        trimmedResponse.toLowerCase().includes('success');

      if (isSuccess) {
        return NextResponse.json({
          success: true,
          message: schedule ? 'SMS scheduled successfully!' : 'SMS sent successfully!',
        });
      }

      // Map error codes to user-friendly messages (no raw codes sent to client)
      const errorMap: Record<string, string> = {
        '100': 'Gateway rejected the request. Please try again.',
        '101': 'Internal configuration error.',
        '102': 'SMS authentication failed. Contact the administrator.',
        '103': 'Invalid phone number format.',
        '104': 'Phone number not covered by this network.',
        '105': 'Insufficient SMS balance. Please top up your Arkesel account.',
        '106': 'Invalid Sender ID. It must be 11 characters or fewer.',
        '109': 'Invalid scheduled time format.',
        '111': 'Message was blocked (contains restricted content).',
      };

      const matchedCode = Object.keys(errorMap).find(code => trimmedResponse.includes(code));
      const userMessage = matchedCode
        ? errorMap[matchedCode]
        : 'Failed to send SMS. Please check the details and try again.';

      // Log the raw code server-side for diagnostics, never send it to the client
      console.error(`[SMS Route] Arkesel returned code: ${trimmedResponse} for recipient: ${formattedTo}`);

      return NextResponse.json({ success: false, message: userMessage });
    } catch (err) {
      console.error('[SMS Route] Send error:', err);
      return NextResponse.json({ success: false, message: 'Network error contacting SMS gateway.' }, { status: 502 });
    }
  }

  return NextResponse.json({ success: false, message: 'Invalid action.' }, { status: 400 });
}
