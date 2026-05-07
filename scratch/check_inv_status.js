const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dlnmkxjucbmsfgspleea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsbm1reGp1Y2Jtc2Znc3BsZWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzUwNTgsImV4cCI6MjA5MzY1MTA1OH0.KyperX3vYIX69-xqPv5Fkpmluot63e9x0PxzxvFEbf4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data, error } = await supabase.from('inventory')
    .select('*')
    .eq('id', 'e241d99b-64a5-4447-8b1e-e59ac3af807d')
    .single();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Inventory item:', JSON.stringify(data, null, 2));
}

test();
