import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, orgId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch organization data context
    let dataContext = "";
    
    if (orgId) {
      // Get organization info
      const { data: org } = await supabase
        .from("organizations")
        .select("name, plan, status")
        .eq("id", orgId)
        .single();

      // Get recent leads summary
      const { data: leads } = await supabase
        .from("leads")
        .select("id, name, status, source, value, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(100);

      // Get integrations
      const { data: integrations } = await supabase
        .from("integrations")
        .select("name, type, status, last_sync_at")
        .eq("org_id", orgId);

      // Get dashboard widgets
      const { data: dashboards } = await supabase
        .from("dashboards")
        .select("id, name, dashboard_widgets(title, type)")
        .eq("org_id", orgId);

      // Build context summary
      const leadsCount = leads?.length || 0;
      const convertedLeads = leads?.filter(l => l.status === "converted").length || 0;
      const totalValue = leads?.reduce((sum, l) => sum + (l.value || 0), 0) || 0;
      
      const leadsBySource = leads?.reduce((acc, l) => {
        const src = l.source || "unknown";
        acc[src] = (acc[src] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const leadsByStatus = leads?.reduce((acc, l) => {
        const st = l.status || "unknown";
        acc[st] = (acc[st] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Recent leads (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentLeads = leads?.filter(l => new Date(l.created_at) >= sevenDaysAgo) || [];

      dataContext = `
## Contexto dos Dados da Organização "${org?.name || 'Cliente'}"

### Resumo de Leads (últimos 100 registros)
- Total de Leads: ${leadsCount}
- Leads Convertidos: ${convertedLeads}
- Taxa de Conversão: ${leadsCount > 0 ? ((convertedLeads / leadsCount) * 100).toFixed(1) : 0}%
- Valor Total em Pipeline: R$ ${totalValue.toLocaleString('pt-BR')}

### Distribuição por Fonte
${Object.entries(leadsBySource).map(([src, count]) => `- ${src}: ${count} leads`).join('\n')}

### Distribuição por Status
${Object.entries(leadsByStatus).map(([st, count]) => `- ${st}: ${count} leads`).join('\n')}

### Leads Recentes (últimos 7 dias)
- Novos leads: ${recentLeads.length}
- Valor médio: R$ ${recentLeads.length > 0 ? (recentLeads.reduce((s, l) => s + (l.value || 0), 0) / recentLeads.length).toFixed(2) : 0}

### Integrações Ativas
${integrations?.map(i => `- ${i.name} (${i.type}): ${i.status}`).join('\n') || 'Nenhuma integração configurada'}

### Dashboards
${dashboards?.map(d => `- ${d.name}: ${d.dashboard_widgets?.length || 0} widgets`).join('\n') || 'Nenhum dashboard configurado'}

### Top 5 Leads por Valor
${leads?.sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 5).map(l => `- ${l.name}: R$ ${(l.value || 0).toLocaleString('pt-BR')} (${l.status})`).join('\n') || 'Sem dados'}
`;
    }

    const systemPrompt = `Você é o Pinn AI, um assistente inteligente especializado em análise de dados de negócios.
Você tem acesso aos dados reais da organização do usuário e deve responder perguntas sobre métricas, leads, conversões e tendências.

Seja objetivo, use dados concretos e forneça insights acionáveis.
Quando apropriado, sugira visualizações ou análises adicionais.
Responda sempre em português brasileiro.

${dataContext}

IMPORTANTE: 
- Use os dados acima para responder perguntas do usuário.
- Se for perguntado algo que não está nos dados, informe educadamente.
- Arredonde valores monetários para facilitar leitura.
- Para tendências, compare períodos quando possível.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("ai-data-chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
