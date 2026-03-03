import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
}

// Client-side Supabase instance — uses the ANON key only (safe for the browser)
// Used for user-facing auth flows: verifyOtp, signIn, signOut
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
