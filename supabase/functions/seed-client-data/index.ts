import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const internalSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { orgId, action } = await req.json();

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: "orgId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get integration config
    const { data: integration, error: intError } = await internalSupabase
      .from("integrations")
      .select("*")
      .eq("org_id", orgId)
      .eq("type", "supabase")
      .eq("status", "connected")
      .maybeSingle();

    if (intError || !integration) {
      return new Response(
        JSON.stringify({ error: "Integration not found", details: intError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = integration.config as { projectUrl?: string; anonKey?: string };
    if (!config.projectUrl || !config.anonKey) {
      return new Response(
        JSON.stringify({ error: "Invalid integration config" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const externalSupabase = createClient(config.projectUrl, config.anonKey);

    // First, check current schema by fetching one row
    const { data: sample, error: sampleError } = await externalSupabase
      .from("kommo_leads")
      .select("*")
      .limit(1);

    if (sampleError) {
      return new Response(
        JSON.stringify({ error: `Cannot access kommo_leads: ${sampleError.message}`, hint: "Check RLS policies on external DB" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If action is "schema", just return the schema
    if (action === "schema") {
      return new Response(
        JSON.stringify({ success: true, schema: sample?.[0] ? Object.keys(sample[0]) : [], sampleRow: sample?.[0] || null, count: sample?.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clear existing data first
    if (action === "clear" || action === "seed") {
      const { error: delError } = await externalSupabase
        .from("kommo_leads")
        .delete()
        .neq("lead_id", -99999); // Delete all

      if (delError) {
        console.error("Delete error:", delError);
        return new Response(
          JSON.stringify({ error: `Cannot delete: ${delError.message}`, hint: "RLS may block deletes. Run TRUNCATE TABLE kommo_leads; on external DB SQL editor." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (action === "clear") {
      return new Response(
        JSON.stringify({ success: true, message: "Table cleared" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate realistic funnel data (30 days)
    const leads: any[] = [];
    const now = new Date();

    // Realistic funnel: 100% encaminhado → ~60% atendimento → ~35% reunião confirmada → ~20% reunião realizada → ~8% venda
    // ~15% desqualificado
    for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
      const date = new Date(now);
      date.setDate(date.getDate() - dayOffset);
      const dateStr = date.toISOString().split("T")[0];

      // 3-8 leads per day
      const dailyLeads = Math.floor(Math.random() * 6) + 3;

      for (let j = 0; j < dailyLeads; j++) {
        const rand = Math.random();
        const encaminhado = true; // All leads are forwarded
        const desqualificado = rand < 0.15;
        const atendimento_feito = !desqualificado && rand < 0.85;
        const reuniao_confirmada = atendimento_feito && rand < 0.55;
        const reuniao_realizada = reuniao_confirmada && rand < 0.35;
        const venda = reuniao_realizada && rand < 0.15;

        leads.push({
          lead_id: leads.length + 1,
          created_at_iso: `${dateStr}T${String(8 + Math.floor(Math.random() * 12)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}:00`,
          encaminhado,
          atendimento_feito,
          reuniao_confirmada,
          reuniao_realizada,
          venda,
          desqualificado,
        });
      }
    }

    // Insert in batches of 50
    const batchSize = 50;
    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      const { error: insertError } = await externalSupabase
        .from("kommo_leads")
        .insert(batch);

      if (insertError) {
        errors.push(`Batch ${i}: ${insertError.message}`);
        console.error("Insert error:", insertError);
      } else {
        inserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        message: `Inserted ${inserted} leads across 30 days`,
        totalGenerated: leads.length,
        inserted,
        errors: errors.length > 0 ? errors : undefined,
        summary: {
          total: leads.length,
          encaminhados: leads.filter(l => l.encaminhado).length,
          atendimento_feito: leads.filter(l => l.atendimento_feito).length,
          reuniao_confirmada: leads.filter(l => l.reuniao_confirmada).length,
          reuniao_realizada: leads.filter(l => l.reuniao_realizada).length,
          vendas: leads.filter(l => l.venda).length,
          desqualificados: leads.filter(l => l.desqualificado).length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
