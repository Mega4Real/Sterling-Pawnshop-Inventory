/**
 * Utility for sending SMS via Arkesel API v2
 *
 * Handles phone number sanitization (strips non-digit chars),
 * conversion to Ghana international format (233…),
 * and automatic retry on transient Arkesel 500 errors.
 */

const ARKESEL_ENDPOINT = 'https://sms.arkesel.com/api/v2/sms/send';

/** Maximum number of retry attempts for transient server errors */
const MAX_RETRIES = 2;

/** Base delay in ms between retries (doubles each attempt) */
const RETRY_BASE_DELAY_MS = 1500;

/**
 * Sanitize and convert a Ghana phone number to the 233… international format.
 *
 * Strips every non-digit character first, then:
 *  - "0XXXXXXXXX"  → "233XXXXXXXXX"
 *  - 9 bare digits  → "233" + digits   (assumes the leading 0 was omitted)
 *  - Already starts with "233" → kept as-is
 *
 * @returns The formatted number, or an empty string if nothing usable remains.
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

  // Fall-through: return whatever digits we have and let Arkesel validate
  return digits;
}

/**
 * Send an SMS to a single recipient via the Arkesel v2 API.
 *
 * @param to      - Raw phone number (local or international, may contain spaces/colons/etc.)
 * @param message - The SMS body text
 * @returns       - `{ success: true, data }` on success or `{ success: false, message }` on failure
 */
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

  // --- Phone validation ---
  if (!to || typeof to !== 'string') {
    return { success: false, message: 'Customer phone number is missing.' };
  }

  const formattedTo = formatGhanaPhone(to);

  if (!formattedTo) {
    return { success: false, message: 'Phone number contains no valid digits.' };
  }

  // Basic length check: Ghana numbers are 12 digits (233 + 9 digits)
  if (formattedTo.length < 10 || formattedTo.length > 15) {
    console.error(`Invalid phone length after formatting: "${formattedTo}" (from "${to}")`);
    return { success: false, message: `Phone number "${to}" does not look valid.` };
  }

  // --- Send with retry ---
  let lastError: string = 'Failed to send SMS';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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

      if (response.ok && result.status === 'success') {
        return { success: true, data: result };
      }

      // Capture the error message from the API
      lastError = result.message || `Arkesel returned status ${response.status}`;

      // Only retry on 500 (transient server error). Other codes (4xx) are permanent.
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `Arkesel 500 error for ${formattedTo} (attempt ${attempt + 1}/${MAX_RETRIES + 1}). ` +
          `Retrying in ${delay}ms…`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Non-retryable or final attempt
      console.error('Arkesel API Error:', { status: response.status, body: result, phone: formattedTo });
      return { success: false, message: lastError };

    } catch (error) {
      console.error('SMS Send Error:', error);
      lastError = 'Network error while sending SMS. Please check your connection.';

      // Retry on network errors too
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`Network error (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Retrying in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
    }
  }

  return { success: false, message: lastError };
}
