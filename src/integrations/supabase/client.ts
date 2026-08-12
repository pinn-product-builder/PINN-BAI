import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function resolveSupabaseEnv(): { url: string; key: string } {
  const url = import.meta.env.VITE_SUPABASE_URL ?? "";
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

  if (url && key) {
    return { url, key };
  }

  if (import.meta.env.MODE === "test") {
    return {
      url: "https://test.supabase.local",
      key: "test-anon-key",
    };
  }

  // Nunca lançar aqui: um throw quebra todo o bundle na inicialização → tela branca no browser.
  console.error(
    "[Supabase] Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env (veja .env.example). " +
      "Em produção/Docker, passe essas variáveis no build do Vite.",
  );
  return {
    url: url || "https://placeholder.supabase.co",
    key: key || "placeholder-anon-key",
  };
}

const { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY } = resolveSupabaseEnv();

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
