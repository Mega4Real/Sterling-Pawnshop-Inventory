const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dlnmkxjucbmsfgspleea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsbm1reGp1Y2Jtc2Znc3BsZWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzUwNTgsImV4cCI6MjA5MzY1MTA1OH0.KyperX3vYIX69-xqPv5Fkpmluot63e9x0PxzxvFEbf4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const id = 'e241d99b-64a5-4447-8b1e-e59ac3af807d';
  console.log('Attempting to delete item:', id);
  const { error } = await supabase.from('inventory').delete().eq('id', id);
  
  if (error) {
    console.error('Delete Error:', error);
  } else {
    console.log('Delete successful!');
  }
}

test();
