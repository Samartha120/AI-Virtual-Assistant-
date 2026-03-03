const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    console.error('FATAL: Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY in environment variables.');
    console.error('Please copy .env.example to .env and fill in your Supabase credentials.');
    process.exit(1);
}

// Service role client — for database/admin operations ONLY (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Anon key client — for user-facing auth operations (signUp, verifyOtp, resend, signIn)
// NEVER use the service role key for auth flows — it won't work correctly for OTP
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

module.exports = { supabase, supabaseAuth };

