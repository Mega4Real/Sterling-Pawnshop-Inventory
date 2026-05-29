const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://dlnmkxjucbmsfgspleea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsbm1reGp1Y2Jtc2Znc3BsZWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzUwNTgsImV4cCI6MjA5MzY1MTA1OH0.KyperX3vYIX69-xqPv5Fkpmluot63e9x0PxzxvFEbf4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function cleanup() {
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, full_name, phone');

  if (error) {
    console.error('Error fetching customers:', error);
    return;
  }

  console.log(`Checking ${customers.length} customers...`);
  
  for (const customer of customers) {
    if (!customer.phone) continue;
    
    // Check if phone has non-digits
    const cleanedPhone = customer.phone.replace(/\D/g, '');
    
    // If the cleaned phone is different from the original phone
    // (excluding spaces, e.g. "020 8953649" -> "0208953649" is fine, but we also want to clean any other characters)
    const normalizedOriginal = customer.phone.replace(/\s+/g, '');
    if (normalizedOriginal !== cleanedPhone) {
      console.log(`Malformation found: "${customer.full_name}" | Original: "${customer.phone}" -> Cleaned: "${cleanedPhone}"`);
      
      const { error: updateError } = await supabase
        .from('customers')
        .update({ phone: cleanedPhone })
        .eq('id', customer.id);
        
      if (updateError) {
        console.error(`  Error updating customer ${customer.id}:`, updateError);
      } else {
        console.log(`  Successfully cleaned phone number for "${customer.full_name}".`);
      }
    }
  }
  
  console.log('Cleanup completed.');
}

cleanup();
