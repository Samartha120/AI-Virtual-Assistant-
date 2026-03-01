const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
    console.error('Please copy .env.example to .env and fill in your Supabase credentials.');
    process.exit(1); // Stop server — backend cannot function without DB credentials
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
