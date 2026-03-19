import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  orgId: string;
}

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientSupabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const internalSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await clientSupabase.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Invalid auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orgId }: RequestBody = await req.json();
    if (!orgId) {
      return new Response(JSON.stringify({ error: "orgId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    const { data: profile } = await internalSupabase
      .from("profiles")
      .select("org_id")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: userRoles } = await internalSupabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isPlatformAdmin = (userRoles || []).some(r => r.role === "platform_admin");
    const canAccessOrg = isPlatformAdmin || profile?.org_id === orgId;
    if (!canAccessOrg) {
      return new Response(JSON.stringify({ error: "Access denied for this organization" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: rfmRows, error: rfmError } = await internalSupabase
      .from("customer_rfm_scores")
      .select("*")
      .eq("org_id", orgId);

    if (rfmError) {
      return new Response(JSON.stringify({ error: `Failed to load RFM scores: ${rfmError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!rfmRows || rfmRows.length === 0) {
      return new Response(JSON.stringify({ error: "No RFM scores found. Run calculate-rfm first." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = rfmRows.map(row => {
      const recencyRisk = clamp((Number(row.recency_days) || 0) / 90);
      const frequencyRisk = 1 - clamp((Number(row.frequency) || 0) / 8);
      const monetaryRisk = 1 - clamp((Number(row.monetary) || 0) / 10000);
      const lowRScoreRisk = 1 - clamp((Number(row.r_score) || 1) / 5);
      const lowFScoreRisk = 1 - clamp((Number(row.f_score) || 1) / 5);

      const churnProbability = clamp(
        recencyRisk * 0.4 +
        frequencyRisk * 0.2 +
        monetaryRisk * 0.15 +
        lowRScoreRisk * 0.15 +
        lowFScoreRisk * 0.1,
      );

      let churnRiskBand = "baixo";
      if (churnProbability >= 0.7) churnRiskBand = "alto";
      else if (churnProbability >= 0.4) churnRiskBand = "medio";

      const reasons: string[] = [];
      if (recencyRisk >= 0.7) reasons.push("Sem atividade recente");
      if (frequencyRisk >= 0.6) reasons.push("Baixa recorrência");
      if (monetaryRisk >= 0.6) reasons.push("Baixo valor acumulado");
      if (reasons.length === 0) reasons.push("Padrão de risco estável");

      return {
        org_id: orgId,
        customer_key: row.customer_key,
        source_table: row.source_table,
        churn_probability: Number(churnProbability.toFixed(5)),
        churn_risk_band: churnRiskBand,
        churn_reasons: reasons,
        calculated_at: new Date().toISOString(),
      };
    });

    const { error: upsertError } = await internalSupabase
      .from("customer_churn_scores")
      .upsert(payload, { onConflict: "org_id,customer_key" });

    if (upsertError) {
      return new Response(JSON.stringify({ error: `Failed to persist churn scores: ${upsertError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const highRiskCount = payload.filter(p => p.churn_risk_band === "alto").length;
    const mediumRiskCount = payload.filter(p => p.churn_risk_band === "medio").length;
    const lowRiskCount = payload.filter(p => p.churn_risk_band === "baixo").length;

    return new Response(
      JSON.stringify({
        success: true,
        count: payload.length,
        summary: {
          highRiskCount,
          mediumRiskCount,
          lowRiskCount,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
