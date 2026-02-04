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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create internal client to fetch integration config
    const internalSupabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { orgId, tableName, columns, filters, limit = 1000, orderBy, orderAsc = true }: FetchRequest = await req.json();

    if (!orgId || !tableName) {
      return new Response(
        JSON.stringify({ error: "orgId and tableName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the integration for this org (should be Supabase type)
    const { data: integration, error: integrationError } = await internalSupabase
      .from("integrations")
      .select("*")
      .eq("org_id", orgId)
      .eq("type", "supabase")
      .eq("status", "connected")
      .maybeSingle();

    if (integrationError) {
      console.error("Integration fetch error:", integrationError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch integration config" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!integration) {
      return new Response(
        JSON.stringify({ error: "No connected Supabase integration found for this organization" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract config
    const config = integration.config as { projectUrl?: string; anonKey?: string };
    if (!config.projectUrl || !config.anonKey) {
      return new Response(
        JSON.stringify({ error: "Invalid integration configuration" }),
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
