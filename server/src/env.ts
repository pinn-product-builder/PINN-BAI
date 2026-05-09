function req(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return v.trim();
}

/** API usa apenas Supabase URL + anon key + JWT do usuário (RLS). Service role opcional para futuros jobs. */
export function loadEnv() {
  return {
    port: Number(process.env.PORT || "8787"),
    supabaseUrl: req("SUPABASE_URL"),
    supabaseAnonKey: req("SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "",
    composioApiKey: process.env.COMPOSIO_API_KEY?.trim() || "",
    /** Auth Config do Kommo no dashboard Composio (mesmo projeto da BF Company). */
    composioKommoAuthConfigId: process.env.COMPOSIO_KOMMO_AUTH_CONFIG_ID?.trim() || "",
    /** Mesmo endpoint que o CRM Auditor standalone (`kommo_composio.py`). */
    composioExecuteBaseUrl:
      process.env.COMPOSIO_EXECUTE_BASE_URL?.trim() || "https://backend.composio.dev/api/v3.1",
    /**
     * Origem do front onde o usuário volta após OAuth (ex.: https://app.seudominio.com ou http://localhost:8080).
     * Opcional em dev se o browser enviar Origin.
     */
    publicAppUrl: process.env.PUBLIC_APP_URL?.trim() || "",
    /** Aceita `CORS_ORIGIN` ou `CORS_ORIGINS` (nome do auditor standalone). */
    corsOrigin:
      process.env.CORS_ORIGIN?.trim() || process.env.CORS_ORIGINS?.trim() || "",
    /** Fallback dev / mesmo fluxo do standalone: conta já ligada sem OAuth no tenant. */
    composioConnectedAccountId: process.env.COMPOSIO_CONNECTED_ACCOUNT_ID?.trim() || "",
  };
}
