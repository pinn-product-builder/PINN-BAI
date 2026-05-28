import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    // true = escuta em todas as interfaces (IPv4 + IPv6); evita falha ao abrir localhost em alguns setups
    host: true,
    port: 8080,
    hmr: {
      // mostra overlay vermelho do Vite quando há erro de compilação (antes estava false e “some” o diagnóstico)
      overlay: true,
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      // Backend Python (FastAPI) em dev — Email Outreach (SmartLead), CRM
      // Auditor, etc. Em prod, o Nginx do compose faz o mesmo proxy.
      // Sobrescreva via VITE_DEV_BACKEND_URL para apontar pra outra máquina/porta.
      ...Object.fromEntries(
        ["/email", "/crm", "/hub", "/ads", "/kpi", "/webhook", "/adapters", "/whatsapp", "/linkedin", "/health"].map(
          (prefix) => [
            prefix,
            {
              target: process.env.VITE_DEV_BACKEND_URL || "http://127.0.0.1:8010",
              changeOrigin: true,
              // Enroll de campanha WhatsApp pode levar minutos pra lotes 500+,
              // pq cada lead = 2-3 calls Supabase no Mari Brain. Default do
              // http-proxy é 120s e cortava com 504 (caso real 2026-05-27).
              timeout: 600_000,        // 10min — matches backend mari_client.enroll_leads
              proxyTimeout: 600_000,
            },
          ],
        ),
      ),
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query"],
  },
  optimizeDeps: {
    include: ["@tanstack/react-query"],
  },
}));
