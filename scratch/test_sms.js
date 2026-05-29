/**
 * Final verification: test Kwesi Magid's number (which previously got a 500)
 * through the new retry logic, plus verify Elvis Tetteh's cleaned number.
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[key] = val;
  }
});

const apiKey = env['ARKESEL_API_KEY'];
const senderId = env['ARKESEL_SENDER_ID'] || 'Pawnshop';
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1500;

function formatGhanaPhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return '233' + digits.substring(1);
  if (digits.startsWith('233')) return digits;
  if (digits.length === 9) return '233' + digits;
  return digits;
}

async function sendWithRetry(phone, label) {
  const formattedTo = formatGhanaPhone(phone);
  console.log(`\n[${label}] Phone: "${phone}" → "${formattedTo}"`);

  let lastError = '';
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify({
          sender: senderId,
          message: `Test verification from Sterling Pawnshop.`,
          recipients: [formattedTo],
        }),
      });
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        console.log(`  ✅ SUCCESS on attempt ${attempt + 1}:`, JSON.stringify(result));
        return;
      }

      lastError = result.message || `Status ${response.status}`;

      if (response.status >= 500 && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.log(`  ⚠️  500 error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): "${lastError}". Retrying in ${delay}ms…`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      console.log(`  ❌ FAILED: ${response.status} — "${lastError}"`);
      return;
    } catch (err) {
      console.error(`  ❌ Network error:`, err.message);
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
}

async function run() {
  await sendWithRetry('0535645954', 'Kwesi Magid');
}

run();
