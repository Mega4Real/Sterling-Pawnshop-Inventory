/**
 * app/api/notify-due/route.ts
 *
 * GET — Called by the Vercel Cron Job every morning at 8 AM UTC.
 *       Also callable manually for testing.
 *
 * Logic:
 *  1. Uses the Supabase service-role key to bypass RLS and read ALL loans.
 *  2. Finds Active loans that are:
 *       - Overdue  (due_date < today)
 *       - Due today (due_date = today)
 *       - Due in exactly 3 days (due_date = today + 3)
 *  3. Fetches all push_subscriptions from the database.
 *  4. Sends a Web Push notification to every subscribed device.
 *  5. Returns a JSON summary { sent, skipped, errors }.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { format, addDays, parseISO, isToday, isBefore, startOfDay } from 'date-fns';

// ─── VAPID configuration ─────────────────────────────────────────────────────
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

/** Supabase admin client — bypasses RLS so cron can read all rows. */
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Format a date as DD/MM/YYYY for display in notifications. */
function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
}

interface Loan {
  id: string;
  due_date: string;
  loan_amount: number;
  status: string;
  customers?: { full_name?: string } | null;
  inventory?: { item_name?: string } | null;
}

interface PushSubscriptionRow {
  subscription: webpush.PushSubscription;
}

/**
 * Build the notification payload for a loan.
 * Returns title + body strings suitable for the service worker.
 */
function buildPayload(loan: Loan, type: 'overdue' | 'due_today' | 'due_soon') {
  const customerName = loan.customers?.full_name ?? 'A customer';
  const itemName     = loan.inventory?.item_name  ?? 'an item';
  const dateStr      = formatDate(loan.due_date);
  const amount       = `GHS ${Number(loan.loan_amount).toFixed(2)}`;

  const messages = {
    overdue: {
      title: '🔴 Overdue Buyback',
      body: `${customerName}'s loan for ${itemName} (${amount}) was due on ${dateStr} and is OVERDUE.`,
      tag: `overdue-${loan.id}`,
    },
    due_today: {
      title: '🟡 Buyback Due Today',
      body: `${customerName}'s loan for ${itemName} (${amount}) is due TODAY.`,
      tag: `due-today-${loan.id}`,
    },
    due_soon: {
      title: '🔔 Buyback Due in 3 Days',
      body: `${customerName}'s loan for ${itemName} (${amount}) is due on ${dateStr}.`,
      tag: `due-soon-${loan.id}`,
    },
  };

  return { ...messages[type], url: '/buybacks' };
}

export async function GET() {

  try {
    const supabase = createAdminClient();
    const today    = startOfDay(new Date());
    const in3Days  = addDays(today, 3);
    const todayStr = format(today,   'yyyy-MM-dd');
    const in3Str   = format(in3Days, 'yyyy-MM-dd');

    // ── 1. Fetch Active loans joined with customers + inventory ───────────────
    const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select('id, due_date, loan_amount, status, customers(full_name), inventory(item_name)')
      .eq('status', 'Active');

    if (loansError) {
      console.error('[notify-due] loans fetch error:', loansError);
      return NextResponse.json({ error: loansError.message }, { status: 500 });
    }

    // ── 2. Classify loans ─────────────────────────────────────────────────────
    const targets: Array<{ loan: Loan; type: 'overdue' | 'due_today' | 'due_soon' }> = [];

    for (const loan of (loans ?? []) as Loan[]) {
      const due = parseISO(loan.due_date);
      if (isBefore(due, today)) {
        targets.push({ loan, type: 'overdue' });
      } else if (loan.due_date === todayStr) {
        targets.push({ loan, type: 'due_today' });
      } else if (loan.due_date === in3Str) {
        targets.push({ loan, type: 'due_soon' });
      }
    }

    if (targets.length === 0) {
      return NextResponse.json({ message: 'No due or overdue loans today.', sent: 0 });
    }

    // ── 3. Fetch all push subscriptions ───────────────────────────────────────
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription');

    if (subError) {
      console.error('[notify-due] subscriptions fetch error:', subError);
      return NextResponse.json({ error: subError.message }, { status: 500 });
    }

    const subs = (subscriptions ?? []) as PushSubscriptionRow[];

    if (subs.length === 0) {
      return NextResponse.json({
        message: `${targets.length} loan(s) need attention but no push subscriptions found.`,
        sent: 0,
      });
    }

    // ── 4. Send notifications ─────────────────────────────────────────────────
    let sent = 0;
    let errors = 0;

    for (const { loan, type } of targets) {
      const payload = buildPayload(loan, type);

      for (const { subscription } of subs) {
        try {
          await webpush.sendNotification(subscription, JSON.stringify(payload));
          sent++;
        } catch (err: unknown) {
          errors++;
          // If the subscription is expired/invalid (410 Gone), remove it
          if (
            err &&
            typeof err === 'object' &&
            'statusCode' in err &&
            (err as { statusCode: number }).statusCode === 410
          ) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', subscription.endpoint);
          } else {
            console.error('[notify-due] push error:', err);
          }
        }
      }
    }

    console.log(`[notify-due] Done — sent=${sent}, errors=${errors}, loans=${targets.length}`);

    return NextResponse.json({
      ok: true,
      loans: targets.length,
      subscriptions: subs.length,
      sent,
      errors,
      summary: targets.map(t => ({
        id: t.loan.id,
        due_date: t.loan.due_date,
        type: t.type,
        customer: t.loan.customers?.full_name,
      })),
    });
  } catch (err) {
    console.error('[notify-due] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
