import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FetchRequest {
  orgId: string;
  tableName: string;
  columns?: string[];
  filters?: Record<string, unknown>;
  limit?: number;
  orderBy?: string;
  orderAsc?: boolean;
}

interface ApiIntegrationConfig {
  baseUrl?: string;
  endpoint?: string;
  method?: 'GET' | 'POST';
  authType?: 'none' | 'bearer' | 'api_key' | 'basic';
  authValue?: string;
  apiKeyHeader?: string;
  headers?: Record<string, string>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify authorization (just check presence, JWT validation done by Supabase Auth)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create internal client with service role key to bypass RLS for integration lookup
    const internalSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { orgId, tableName, columns, filters, limit = 1000, orderBy, orderAsc = true }: FetchRequest = await req.json();

    if (!orgId || !tableName) {
      return new Response(
        JSON.stringify({ error: "orgId and tableName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get connected integrations for this org (supabase/api)
    const { data: integrations, error: integrationError } = await internalSupabase
      .from("integrations")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "connected")
      .in("type", ["supabase", "api"])
      .order("updated_at", { ascending: false });

    if (integrationError) {
      console.error("Integration fetch error:", integrationError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch integration config" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!integrations || integrations.length === 0) {
      return new Response(
        JSON.stringify({ error: "No connected integration found for this organization" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const apiIntegration = integrations.find((i) => i.type === "api");
    const supabaseIntegration = integrations.find((i) => i.type === "supabase");

    if (apiIntegration) {
      const config = (apiIntegration.config || {}) as ApiIntegrationConfig;
      if (!config.baseUrl) {
        return new Response(
          JSON.stringify({ error: "Invalid API integration configuration (missing baseUrl)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const baseUrl = config.baseUrl.replace(/\/$/, "");
      const action = tableName.startsWith("api:") ? tableName.replace("api:", "") : tableName;

      const requestHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...(config.headers || {}),
      };

      if (config.authType === "bearer" && config.authValue) {
        requestHeaders.Authorization = `Bearer ${config.authValue}`;
      } else if (config.authType === "api_key" && config.authValue) {
        requestHeaders[config.apiKeyHeader || "X-API-Key"] = config.authValue;
      } else if (config.authType === "basic" && config.authValue) {
        requestHeaders.Authorization = `Basic ${btoa(config.authValue)}`;
      }

      const query = new URLSearchParams();
      const endpoint = (config.endpoint || "").trim();
      let url = "";

      if (endpoint) {
        if (endpoint.startsWith("?")) {
          url = `${baseUrl}${endpoint}`;
        } else if (endpoint.includes("?")) {
          url = `${baseUrl}/${endpoint.replace(/^\//, "")}`;
        } else if (endpoint.startsWith("/")) {
          url = `${baseUrl}${endpoint}`;
        } else {
          url = `${baseUrl}/${endpoint}`;
        }
      } else {
        query.set("action", action);
        if (typeof limit === "number") query.set("limit", String(limit));
        if (typeof filters?.offset === "number") query.set("offset", String(filters.offset));
      }

      if (!endpoint || !endpoint.includes("action=")) {
        query.set("action", action);
      }

      if (filters && typeof filters === "object") {
        for (const [k, v] of Object.entries(filters)) {
          if (v === null || v === undefined) continue;
          if (k === "offset" || k === "action") continue;
          query.set(k, String(v));
        }
      }

      const queryStr = query.toString();
      const baseRequestUrl = url || baseUrl;
      const finalUrl = queryStr
        ? `${baseRequestUrl}${baseRequestUrl.includes("?") ? "&" : "?"}${queryStr}`
        : baseRequestUrl;

      const response = await fetch(finalUrl, {
        method: config.method || "GET",
        headers: requestHeaders,
      });

      if (!response.ok) {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({
            error: `API returned ${response.status} for '${action}': ${errorText.substring(0, 200)}`,
          }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const payload = await response.json();
      const normalized = normalizeApiPayload(payload, action);

      return new Response(
        JSON.stringify({
          success: true,
          data: normalized.data,
          count: normalized.count,
          tableName,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!supabaseIntegration) {
      return new Response(
        JSON.stringify({ error: "No compatible integration found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = supabaseIntegration.config as { projectUrl?: string; anonKey?: string };
    if (!config.projectUrl || !config.anonKey) {
      return new Response(
        JSON.stringify({ error: "Invalid Supabase integration configuration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client to EXTERNAL Supabase (client's database)
    const externalSupabase = createClient(config.projectUrl, config.anonKey);

    // Build query
    const selectColumns = columns && columns.length > 0 ? columns.join(", ") : "*";
    let query = externalSupabase
      .from(tableName)
      .select(selectColumns, { count: "exact" });

    // Apply filters if provided
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== null && value !== undefined) {
          query = query.eq(key, value);
        }
      }
    }

    // Apply ordering
    if (orderBy) {
      query = query.order(orderBy, { ascending: orderAsc });
    }

    // Apply limit
    query = query.limit(limit);

    const { data, error, count } = await query;

    if (error) {
      console.error("External query error:", error);
      return new Response(
        JSON.stringify({ 
          error: `Failed to fetch data from ${tableName}: ${error.message}`,
          details: error
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: data || [],
        count: count || 0,
        tableName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in fetch-client-data:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function normalizeApiPayload(payload: unknown, action: string): { data: Record<string, unknown>[]; count: number } {
  if (Array.isArray(payload)) {
    const rows = payload.filter((item) => typeof item === "object" && item !== null) as Record<string, unknown>[];
    return { data: rows, count: rows.length };
  }

  if (typeof payload !== "object" || payload === null) {
    return { data: [{ value: payload }], count: 1 };
  }

  const obj = payload as Record<string, unknown>;

  const arrayKeysByAction: Record<string, string> = {
    campaigns: "campaigns",
    leads: "leads",
    timeline: "timeline",
    "lead-lists": "lead_lists",
    "lead-list-items": "items",
  };

  const objectKeysByAction: Record<string, string> = {
    stats: "stats",
    pipeline: "pipeline",
    "linkedin-metrics": "linkedin_metrics",
    campaign: "campaign",
    lead: "lead",
  };

  const preferredArrayKey = arrayKeysByAction[action];
  if (preferredArrayKey && Array.isArray(obj[preferredArrayKey])) {
    const rows = (obj[preferredArrayKey] as unknown[]).filter((item) => typeof item === "object" && item !== null) as Record<string, unknown>[];
    const count = typeof obj.total === "number" ? obj.total : rows.length;
    return { data: rows, count };
  }

  const anyArray = Object.values(obj).find((v) => Array.isArray(v)) as unknown[] | undefined;
  if (anyArray) {
    const rows = anyArray.filter((item) => typeof item === "object" && item !== null) as Record<string, unknown>[];
    const count = typeof obj.total === "number" ? obj.total : rows.length;
    return { data: rows, count };
  }

  const preferredObjectKey = objectKeysByAction[action];
  if (preferredObjectKey && typeof obj[preferredObjectKey] === "object" && obj[preferredObjectKey] !== null) {
    return { data: [obj[preferredObjectKey] as Record<string, unknown>], count: 1 };
  }

  return { data: [obj], count: 1 };
}
