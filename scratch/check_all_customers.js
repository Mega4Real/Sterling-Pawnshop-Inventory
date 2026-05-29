const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://dlnmkxjucbmsfgspleea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsbm1reGp1Y2Jtc2Znc3BsZWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzUwNTgsImV4cCI6MjA5MzY1MTA1OH0.KyperX3vYIX69-xqPv5Fkpmluot63e9x0PxzxvFEbf4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: customers, error } = await supabase
    .from('customers')
    .select('*');

  if (error) {
    console.error('Error fetching customers:', error);
    return;
  }

  console.log(`Found ${customers.length} customers:`);
  customers.forEach((cust, index) => {
    console.log(`${index + 1}. Name: "${cust.full_name}", Phone: "${cust.phone}"`);
  });
}

check();
