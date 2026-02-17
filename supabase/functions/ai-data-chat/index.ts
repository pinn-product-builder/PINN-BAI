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
        .limit(500);

      // Get integrations
      const { data: integrations } = await supabase
        .from("integrations")
        .select("name, type, status, last_sync_at, config")
        .eq("org_id", orgId);

      // Get dashboard widgets for context
      const { data: dashboards } = await supabase
        .from("dashboards")
        .select("id, name, description, dashboard_widgets(title, type, config)")
        .eq("org_id", orgId);

      // Get data mappings
      const { data: mappings } = await supabase
        .from("data_mappings")
        .select("source_table, source_column, target_metric, transform_type")
        .eq("org_id", orgId);

      // Also fetch external data if integration exists
      let externalDataContext = "";
      if (integrations && integrations.length > 0) {
        const supabaseIntegration = integrations.find(i => i.type === "supabase" && i.status === "connected");
        if (supabaseIntegration) {
          const config = supabaseIntegration.config as any;
          if (config?.supabaseUrl && config?.supabaseAnonKey) {
            try {
              const extClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
              
              // Try to fetch from common views/tables
              const viewsToTry = [
                "vw_dashboard_kpis_30d_v3",
                "vw_afonsina_custos_funil_dia",
                "vw_dashboard_daily_60d_v3",
                "vw_funnel_current_v3",
              ];

              for (const viewName of viewsToTry) {
                try {
                  const { data: viewData, error } = await extClient
                    .from(viewName)
                    .select("*")
                    .limit(30);

                  if (!error && viewData && viewData.length > 0) {
                    externalDataContext += `\n### Dados de ${viewName} (${viewData.length} registros)\n`;
                    externalDataContext += `Colunas: ${Object.keys(viewData[0]).join(", ")}\n`;
                    
                    // Add sample data (first 5 rows)
                    externalDataContext += `Dados:\n`;
                    viewData.slice(0, 10).forEach((row, i) => {
                      const vals = Object.entries(row)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ");
                      externalDataContext += `  ${i + 1}. ${vals}\n`;
                    });

                    // Add aggregations for numeric fields
                    const numericFields = Object.keys(viewData[0]).filter(k => typeof viewData[0][k] === 'number');
                    if (numericFields.length > 0) {
                      externalDataContext += `Totais:\n`;
                      for (const field of numericFields) {
                        const values = viewData.map(r => Number(r[field]) || 0);
                        const sum = values.reduce((a, b) => a + b, 0);
                        const avg = sum / values.length;
                        externalDataContext += `  ${field}: soma=${sum.toFixed(2)}, média=${avg.toFixed(2)}, min=${Math.min(...values).toFixed(2)}, max=${Math.max(...values).toFixed(2)}\n`;
                      }
                    }
                  }
                } catch {
                  // View doesn't exist, skip
                }
              }
            } catch (e) {
              console.error("Error fetching external data:", e);
            }
          }
        }
      }

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

      // Last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const monthLeads = leads?.filter(l => new Date(l.created_at) >= thirtyDaysAgo) || [];

      dataContext = `
## Contexto dos Dados da Organização "${org?.name || 'Cliente'}"

### Resumo de Leads (últimos ${leadsCount} registros disponíveis)
- Total de Leads: ${leadsCount}
- Leads Convertidos: ${convertedLeads}
- Taxa de Conversão: ${leadsCount > 0 ? ((convertedLeads / leadsCount) * 100).toFixed(1) : 0}%
- Valor Total em Pipeline: R$ ${totalValue.toLocaleString('pt-BR')}

### Leads últimos 30 dias
- Novos leads no mês: ${monthLeads.length}
- Convertidos no mês: ${monthLeads.filter(l => l.status === 'converted').length}

### Leads últimos 7 dias
- Novos leads na semana: ${recentLeads.length}
- Valor médio: R$ ${recentLeads.length > 0 ? (recentLeads.reduce((s, l) => s + (l.value || 0), 0) / recentLeads.length).toFixed(2) : 0}

### Distribuição por Fonte
${Object.entries(leadsBySource).map(([src, count]) => `- ${src}: ${count} leads`).join('\n')}

### Distribuição por Status
${Object.entries(leadsByStatus).map(([st, count]) => `- ${st}: ${count} leads`).join('\n')}

### Integrações Ativas
${integrations?.map(i => `- ${i.name} (${i.type}): ${i.status}`).join('\n') || 'Nenhuma integração configurada'}

### Dashboards Configurados
${dashboards?.map(d => `- ${d.name}: ${d.dashboard_widgets?.length || 0} widgets`).join('\n') || 'Nenhum dashboard configurado'}

### Mapeamentos de Dados
${mappings?.map(m => `- ${m.source_table}.${m.source_column} → ${m.target_metric} (${m.transform_type})`).join('\n') || 'Sem mapeamentos'}

### Top 10 Leads por Valor
${leads?.sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 10).map(l => `- ${l.name}: R$ ${(l.value || 0).toLocaleString('pt-BR')} (${l.status})`).join('\n') || 'Sem dados'}

${externalDataContext ? `### Dados Externos (Supabase do Cliente)\n${externalDataContext}` : ''}
`;
    }

    const systemPrompt = `Você é o Pinn AI, um assistente inteligente especializado em análise de dados de negócios.
Você tem acesso aos dados reais da organização do usuário e deve responder perguntas sobre métricas, leads, conversões e tendências.

SUAS CAPACIDADES:
- Analisar tendências de leads e conversões
- Identificar padrões de performance por canal
- Gerar relatórios textuais detalhados
- Alertar sobre anomalias nos dados
- Recomendar ações baseadas nos dados
- Explicar métricas e KPIs de forma clara

REGRAS:
- Seja objetivo, use dados concretos e forneça insights acionáveis.
- Sempre que possível, inclua números, porcentagens e comparações.
- Quando apropriado, sugira visualizações ou análises adicionais.
- Responda sempre em português brasileiro.
- Use formatação Markdown para melhor legibilidade (negrito, listas, tabelas).
- Se for perguntado algo que não está nos dados, informe educadamente.
- Arredonde valores monetários para facilitar leitura.
- Para tendências, compare períodos quando possível.

${dataContext}`;

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
