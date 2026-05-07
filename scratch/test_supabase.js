
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://dlnmkxjucbmsfgspleea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsbm1reGp1Y2Jtc2Znc3BsZWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzUwNTgsImV4cCI6MjA5MzY1MTA1OH0.KyperX3vYIX69-xqPv5Fkpmluot63e9x0PxzxvFEbf4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing Supabase Connection...');
  console.log('URL:', supabaseUrl);
  
  const { data: customers, error: cError } = await supabase.from('customers').select('*').limit(1);
  if (cError) {
    console.error('Customers Table Error:', cError);
  } else {
    console.log('Customers Table: OK', customers);
  }

  const { data: inventory, error: iError } = await supabase.from('inventory').select('*').limit(1);
  if (iError) {
    console.error('Inventory Table Error:', iError);
  } else {
    console.log('Inventory Table: OK', inventory);
  }

  const { data: loans, error: lError } = await supabase.from('loans').select('*').limit(1);
  if (lError) {
    console.error('Loans Table Error:', lError);
  } else {
    console.log('Loans Table: OK', loans);
  }
}

test();
