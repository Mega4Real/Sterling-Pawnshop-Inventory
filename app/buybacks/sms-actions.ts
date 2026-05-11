'use server';

import { supabase } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { format } from 'date-fns';

/**
 * Server action to send a reminder SMS to a customer for their buyback
 */
export async function sendBuybackReminderAction(loanId: string) {
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
      return { success: false, message: 'Customer phone number is missing.' };
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
 * Server action to send a forfeiture notice for overdue buybacks
 */
export async function sendBuybackForfeitureAction(loanId: string) {
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
      return { success: false, message: 'Customer phone number is missing.' };
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
