import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Cliente dedicado ao Supabase da Mari v2.
// Configure no .env do PINN-BAI:
//   VITE_MARI_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_MARI_SUPABASE_KEY=eyJ...
const MARI_URL = (import.meta.env.VITE_MARI_SUPABASE_URL ?? '').trim();
const MARI_KEY = (import.meta.env.VITE_MARI_SUPABASE_KEY ?? '').trim();

export const isMariSupabaseConfigured = Boolean(MARI_URL && MARI_KEY);

/** `null` quando as env não estão definidas — evita crash global ao importar o módulo. */
export const mariSupabase: SupabaseClient | null = isMariSupabaseConfigured
  ? createClient(MARI_URL, MARI_KEY, {
      auth: { persistSession: false },
    })
  : null;
