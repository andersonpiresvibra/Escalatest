const { createClient } = require('@supabase/supabase-js');

const url = 'https://vefyegxmvjficncbetyp.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZnllZ3htdmpmaWNuY2JldHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNjYwMjksImV4cCI6MjA5Nzg0MjAyOX0.ioaZkwS98123Jb2xw2l6vev3FgoLwIVwsitg7pTew7c';

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('colaboradores').select('*').limit(1);
  if (error) {
    console.error('Error fetching:', error);
  } else {
    console.log('Row properties:', data[0] ? Object.keys(data[0]) : 'Empty table');
    console.log('Sample row:', data[0]);
  }
}

run();
