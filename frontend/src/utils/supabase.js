import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

let supabase = null;

if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('Supabase Client SDK initialized.');
  } catch (error) {
    console.error('Supabase initialization error:', error);
  }
} else {
  console.log('Supabase credentials missing. Magic link login will run in simulated mode.');
}

export { supabase, isSupabaseConfigured };
