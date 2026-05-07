const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dlnmkxjucbmsfgspleea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsbm1reGp1Y2Jtc2Znc3BsZWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzUwNTgsImV4cCI6MjA5MzY1MTA1OH0.KyperX3vYIX69-xqPv5Fkpmluot63e9x0PxzxvFEbf4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data, error } = await supabase.from('loans')
    .select('*, customers(full_name, phone), inventory(item_name, category)')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('Loan sample:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('No loans found.');
  }
}

test();
