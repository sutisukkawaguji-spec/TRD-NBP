const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://vznbkqbmysinxtspsskl.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bmJrcWJteXNpbnh0c3Bzc2tsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjcyMTYsImV4cCI6MjA5MjYwMzIxNn0.mF7LRqXEg1KP1QL1seEx4wFlmx978WaS6u4jWETg_PQ');

async function test() {
    const payload = {
        UUID: 'test_' + Date.now(),
        Date: '2026-05-04',
        Time: '12:00:00',
        UserId: 'testuser',
        UserName: 'Test User',
        Virtue: 'volunteer',
        Note: 'Test note',
        Happy: 3,
        Image: '',
        Tagged: '',
        Privacy: 'public',
        JSON: JSON.stringify({ likes: [], verifies: [] }),
        Status: 'waiting_verify',
        Score: 0
    };
    console.log('Sending:', payload);
    const { data, error } = await supabase.from('Activities').insert(payload);
    if (error) console.error('ERROR:', error);
    else console.log('SUCCESS:', data);
}
test();
