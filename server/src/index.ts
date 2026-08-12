import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { serve } from "@hono/node-server";

const __here = dirname(fileURLToPath(import.meta.url));
/** Raiz do repo `.env`, depois `server/.env` (este sobrescreve se existir). */
loadDotenv({ path: resolve(__here, "../../.env") });
loadDotenv({ path: resolve(__here, "../.env") });
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.js";
import { registerCrmAuditorRoutes } from "./modules/crm-auditor/routes.js";

const env = loadEnv();
const composioConfigured = Boolean(env.composioApiKey);

const corsOrigins = env.corsOrigin
  ? env.corsOrigin.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

type Variables = { userId: string; db: SupabaseClient };

const app = new Hono<{ Variables: Variables }>();

app.use(
  "*",
  cors({
    origin: corsOrigins.length === 0 ? "*" : corsOrigins,
    allowHeaders: ["Authorization", "Content-Type"],
  }),
);

app.get("/health", (c) => c.json({ ok: true, service: "pinn-bai-api" }));

registerCrmAuditorRoutes(app, {
  supabaseUrl: env.supabaseUrl,
  anonKey: env.supabaseAnonKey,
  composioConfigured,
  composioApiKey: env.composioApiKey,
  composioKommoAuthConfigId: env.composioKommoAuthConfigId,
  composioExecuteBaseUrl: env.composioExecuteBaseUrl,
  composioConnectedAccountId: env.composioConnectedAccountId,
  publicAppUrl: env.publicAppUrl,
});

serve({
  fetch: app.fetch,
  port: env.port,
});

console.log(`pinn-bai-api listening on http://0.0.0.0:${env.port}`);
