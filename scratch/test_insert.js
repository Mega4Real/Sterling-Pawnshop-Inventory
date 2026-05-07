
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://dlnmkxjucbmsfgspleea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsbm1reGp1Y2Jtc2Znc3BsZWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzUwNTgsImV4cCI6MjA5MzY1MTA1OH0.KyperX3vYIX69-xqPv5Fkpmluot63e9x0PxzxvFEbf4';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  console.log('Testing Insert into inventory...');
  const payload = {
    item_name: 'Test Item',
    cost_price: 100,
    selling_price: 150,
    status: 'Available'
  };
  
  const { data, error } = await supabase.from('inventory').insert(payload);
  if (error) {
    console.error('Insert Error:', error);
  } else {
    console.log('Insert Success:', data);
  }
}

testInsert();
