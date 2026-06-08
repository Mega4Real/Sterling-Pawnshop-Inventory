'use server';

import { supabase } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { format } from 'date-fns';
import { smsPerLoanLimiter, smsGlobalLimiter } from '@/lib/rate-limit';

/**
 * Checks SMS rate limits before allowing a send.
 * Enforces both per-loan and global limits to prevent cost abuse.
 *
 * @param loanId - The loan ID being messaged
 * @returns Error message if rate-limited, or null if allowed
 */
function checkSmsRateLimit(loanId: string): string | null {
  // Check per-loan limit (3 per 10 minutes)
  const perLoan = smsPerLoanLimiter.check(loanId);
  if (!perLoan.allowed) {
    const retryMinutes = Math.ceil(perLoan.retryAfterMs / 60000);
    return `Too many messages for this buyback. Please wait ${retryMinutes} minute${retryMinutes !== 1 ? 's' : ''} before sending again.`;
  }

  // Check global limit (15 per hour)
  const global = smsGlobalLimiter.check('global');
  if (!global.allowed) {
    const retryMinutes = Math.ceil(global.retryAfterMs / 60000);
    return `SMS limit reached (${retryMinutes} min${retryMinutes !== 1 ? 's' : ''} until reset). You have sent too many messages this hour.`;
  }

  return null;
}

/**
 * Server action to send a reminder SMS to a customer for their buyback.
 * Rate-limited: 3 per loan per 10min, 15 total per hour.
 */
export async function sendBuybackReminderAction(loanId: string) {
  // ── Rate limit check ──
  const limitError = checkSmsRateLimit(loanId);
  if (limitError) {
    return { success: false, message: limitError };
  }

  try {
    // 1. Fetch loan and customer details
    const { data: loan, error } = await supabase
      .from('loans')
      .select('*, customers(full_name, phone), inventory(item_name)')
      .eq('id', loanId)
      .single();

    if (error || !loan) {
      return { success: false, message: 'Could not find buyback details.' };
    }

    const customer = loan.customers as any;
    const inventory = loan.inventory as any;

    if (!customer?.phone) {
      return { success: false, message: `No phone number on file for ${customer?.full_name || 'this customer'}. Please add one first.` };
    }

    // 2. Construct the message
    const customerName = customer.full_name;
    const itemName = inventory?.item_name || 'your item';
    const dueDate = format(new Date(loan.due_date), 'dd MMM yyyy');
    const totalDue = loan.total_due.toFixed(2);

    const message = `Hello ${customerName}, this is a friendly reminder from Sterling Pawnshop. Your buyback for ${itemName} is due on ${dueDate}. Total redemption amount is GH₵ ${totalDue}. Thank you.`;

    // 3. Send the SMS
    const result = await sendSMS(customer.phone, message);

    return result;
  } catch (err) {
    console.error('Action Error:', err);
    return { success: false, message: 'Failed to process reminder request.' };
  }
}

/**
 * Server action to send a forfeiture notice for overdue buybacks.
 * Rate-limited: 3 per loan per 10min, 15 total per hour.
 */
export async function sendBuybackForfeitureAction(loanId: string) {
  // ── Rate limit check ──
  const limitError = checkSmsRateLimit(loanId);
  if (limitError) {
    return { success: false, message: limitError };
  }

  try {
    const { data: loan, error } = await supabase
      .from('loans')
      .select('*, customers(full_name, phone), inventory(item_name)')
      .eq('id', loanId)
      .single();

    if (error || !loan) {
      return { success: false, message: 'Could not find buyback details.' };
    }

    const customer = loan.customers as any;
    const inventory = loan.inventory as any;

    if (!customer?.phone) {
      return { success: false, message: `No phone number on file for ${customer?.full_name || 'this customer'}. Please add one first.` };
    }

    const customerName = customer.full_name;
    const itemName = inventory?.item_name || 'your item';
    const totalDue = loan.total_due.toFixed(2);

    const message = `Hello ${customerName}, this is a notice from Sterling Pawnshop. Your buyback for ${itemName} is now overdue. As per our agreement, the item has been forfeited and is subject to sale. Total amount that was due: GH₵ ${totalDue}. Thank you.`;

    const result = await sendSMS(customer.phone, message);
    return result;
  } catch (err) {
    console.error('Action Error:', err);
    return { success: false, message: 'Failed to process forfeiture notice.' };
  }
}
