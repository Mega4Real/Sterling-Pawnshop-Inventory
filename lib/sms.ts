/**
 * Utility for sending SMS via Arkesel API v2
 */

const ARKESEL_ENDPOINT = 'https://sms.arkesel.com/api/v2/sms/send';

export async function sendSMS(to: string, message: string) {
  const apiKey = process.env.ARKESEL_API_KEY;
  let senderId = process.env.ARKESEL_SENDER_ID || 'Pawnshop';

  // Arkesel constraint: Sender ID must be max 11 characters
  if (senderId.length > 11) {
    senderId = senderId.substring(0, 11);
  }

  if (!apiKey) {
    console.error('ARKESEL_API_KEY is not defined in environment variables.');
    return { success: false, message: 'SMS service not configured.' };
  }

  // Format phone number to international format (233...) if it starts with 0
  let formattedTo = to.replace(/\s+/g, '');
  if (formattedTo.startsWith('0')) {
    formattedTo = '233' + formattedTo.substring(1);
  }

  try {
    const response = await fetch(ARKESEL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: senderId,
        message: message,
        recipients: [formattedTo],
      }),
    });

    const result = await response.json();

    if (response.ok) {
      return { success: true, data: result };
    } else {
      console.error('Arkesel API Error:', result);
      return { success: false, message: result.message || 'Failed to send SMS' };
    }
  } catch (error) {
    console.error('SMS Send Error:', error);
    return { success: false, message: 'An unexpected error occurred while sending SMS.' };
  }
}
