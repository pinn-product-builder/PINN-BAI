import { createClient } from '@supabase/supabase-js';

// Cliente dedicado ao Supabase da Mari v2.
// Configure no .env do PINN-BAI:
//   VITE_MARI_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_MARI_SUPABASE_KEY=eyJ...
const MARI_URL = import.meta.env.VITE_MARI_SUPABASE_URL as string;
const MARI_KEY = import.meta.env.VITE_MARI_SUPABASE_KEY as string;

export const mariSupabase = createClient(MARI_URL, MARI_KEY, {
  auth: { persistSession: false },
});
