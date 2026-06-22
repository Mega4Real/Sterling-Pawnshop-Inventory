/**
 * app/api/subscribe/route.ts
 *
 * POST  — saves a Web Push subscription for the currently authenticated user.
 * DELETE — removes the subscription (unsubscribe).
 *
 * The subscription object (endpoint + keys) is stored in the
 * push_subscriptions table in Supabase so the notify-due cron can
 * send pushes to all registered devices.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Build a Supabase server client that reads the auth session from cookies. */
function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from Server Components — safe to ignore
          }
        },
      },
    }
  );
}

/**
 * POST /api/subscribe
 * Body: { subscription: PushSubscriptionJSON }
 *
 * Upserts the push subscription for the current user.
 * If the user already has a subscription with the same endpoint,
 * it is updated (handles key rotation).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { subscription } = body as { subscription: PushSubscriptionJSON };

    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
    }

    // Upsert: if the same endpoint already exists for this user, update it.
    const { error: upsertError } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          subscription,
          endpoint: subscription.endpoint, // used as unique key in upsert
        },
        { onConflict: 'endpoint' }
      );

    if (upsertError) {
      console.error('[subscribe] upsert error:', upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[subscribe] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/subscribe
 * Body: { endpoint: string }
 *
 * Removes a push subscription by its endpoint URL.
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { endpoint } = body as { endpoint: string };

    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);

    if (deleteError) {
      console.error('[subscribe] delete error:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[subscribe] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
