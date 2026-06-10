import { NextRequest, NextResponse } from 'next/server';

/**
 * Format helper for Ghana numbers.
 * Converts to 233... format.
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

  if (digits.length === 9) {
    return '233' + digits;
  }

  return digits;
}

/**
 * POST handler for checking balance and sending legacy SMS.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, to, sms, schedule, from, apiKey } = body;

    const key = apiKey || process.env.ARKESEL_API_KEY || 'bWdESWdxdnVkdWh2WWRxbEFDQW0';
    const sender = from || process.env.ARKESEL_SENDER_ID || 'Pawnshop';

    if (action === 'check-balance') {
      const url = `https://sms.arkesel.com/sms/api?action=check-balance&api_key=${encodeURIComponent(key)}&response=json`;
      const res = await fetch(url, { method: 'GET', cache: 'no-store' });
      
      if (!res.ok) {
        return NextResponse.json(
          { success: false, message: `Arkesel API error: HTTP ${res.status}` },
          { status: res.status }
        );
      }
      
      const data = await res.json();
      return NextResponse.json({ success: true, data });
    }

    if (action === 'send-sms') {
      if (!to) {
        return NextResponse.json({ success: false, message: 'Recipient phone number is required.' }, { status: 400 });
      }
      if (!sms) {
        return NextResponse.json({ success: false, message: 'SMS message content is required.' }, { status: 400 });
      }

      // Format recipient phone number
      const formattedTo = formatGhanaPhone(to);
      if (!formattedTo || formattedTo.length < 10 || formattedTo.length > 15) {
        return NextResponse.json(
          { success: false, message: 'Invalid phone number format. Please check the number.' },
          { status: 400 }
        );
      }

      // Construct URL parameters
      const urlParams = new URLSearchParams({
        action: 'send-sms',
        api_key: key,
        to: formattedTo,
        from: sender.substring(0, 11), // Sender ID must be max 11 chars
        sms: sms,
      });

      if (schedule) {
        urlParams.append('schedule', schedule);
      }

      const url = `https://sms.arkesel.com/sms/api?${urlParams.toString()}`;
      
      const res = await fetch(url, { method: 'GET', cache: 'no-store' });
      if (!res.ok) {
        return NextResponse.json(
          { success: false, message: `Arkesel API error: HTTP ${res.status}` },
          { status: res.status }
        );
      }

      const responseText = await res.text();
      const trimmedResponse = responseText.trim();
      
      let success = false;
      let message = responseText;

      // Status codes for Arkesel v1:
      // 1000 = Success (Message sent successfully / scheduled successfully)
      // 100 = Bad gateway request
      // 101 = Wrong action
      // 102 = Authentication failed
      // 103 = Invalid phone number
      // 104 = Phone coverage not active
      // 105 = Insufficient balance
      // 106 = Invalid Sender ID
      // 109 = Invalid Schedule Time
      // 111 = SMS contains spam word
      if (trimmedResponse.includes('1000') || trimmedResponse.toLowerCase() === 'ok' || trimmedResponse.toLowerCase().includes('success')) {
        success = true;
        message = schedule ? 'SMS scheduled successfully!' : 'SMS sent successfully!';
      } else {
        // Map codes
        if (trimmedResponse.includes('100')) {
          message = 'Bad gateway request (Code 100)';
        } else if (trimmedResponse.includes('101')) {
          message = 'Wrong action parameter (Code 101)';
        } else if (trimmedResponse.includes('102')) {
          message = 'Authentication failed. Please check your API Key (Code 102)';
        } else if (trimmedResponse.includes('103')) {
          message = 'Invalid phone number format (Code 103)';
        } else if (trimmedResponse.includes('104')) {
          message = 'Phone coverage not active (Code 104)';
        } else if (trimmedResponse.includes('105')) {
          message = 'Insufficient balance (Code 105)';
        } else if (trimmedResponse.includes('106')) {
          message = 'Invalid Sender ID (Code 106)';
        } else if (trimmedResponse.includes('109')) {
          message = 'Invalid Schedule Time format. Must be dd-mm-yyyy hh:mm AM/PM (Code 109)';
        } else if (trimmedResponse.includes('111')) {
          message = 'SMS contains spam words and was blocked (Code 111)';
        } else {
          message = `Failed to send SMS. Arkesel response: "${responseText}"`;
        }
      }

      return NextResponse.json({ success, message, code: trimmedResponse });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('Server error in SMS route handler:', error);
    return NextResponse.json({ success: false, message: error.message || 'Internal server error' }, { status: 500 });
  }
}
