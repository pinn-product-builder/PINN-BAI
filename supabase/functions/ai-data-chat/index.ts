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
    const { messages, orgId, mode } = await req.json();
    
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

      // Fetch external data from client's Supabase
      let externalDataContext = "";
      if (integrations && integrations.length > 0) {
        const supabaseIntegration = integrations.find(i => i.type === "supabase" && i.status === "connected");
        if (supabaseIntegration) {
          const config = supabaseIntegration.config as any;
          // Support both field name conventions
          const projectUrl = config?.projectUrl || config?.supabaseUrl;
          const anonKey = config?.anonKey || config?.supabaseAnonKey;
          
          if (projectUrl && anonKey) {
            try {
              const extClient = createClient(projectUrl, anonKey);
              
              // Get the tables configured for this org's widgets
              const widgetTables = new Set<string>();
              dashboards?.forEach(d => {
                (d.dashboard_widgets as any[])?.forEach(w => {
                  const wConfig = w.config as any;
                  const table = wConfig?.dataSource || wConfig?.sourceTable;
                  if (table) widgetTables.add(table);
                });
              });

              // Fetch data from each configured table
              for (const tableName of widgetTables) {
                try {
                  const { data: tableData, error } = await extClient
                    .from(tableName)
                    .select("*")
                    .limit(50);

                  if (!error && tableData && tableData.length > 0) {
                    externalDataContext += `\n### Tabela: ${tableName} (${tableData.length} registros)\n`;
                    externalDataContext += `Colunas: ${Object.keys(tableData[0]).join(", ")}\n`;
                    
                    // Add all data rows (up to 50)
                    externalDataContext += `Dados:\n`;
                    tableData.forEach((row, i) => {
                      const vals = Object.entries(row)
                        .filter(([_, v]) => v !== null && v !== undefined && v !== '')
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ");
                      if (vals) externalDataContext += `  ${i + 1}. ${vals}\n`;
                    });

                    // Add aggregations for numeric fields
                    const numericFields = Object.keys(tableData[0]).filter(k => typeof tableData[0][k] === 'number');
                    if (numericFields.length > 0) {
                      externalDataContext += `Totais:\n`;
                      for (const field of numericFields) {
                        const values = tableData.map(r => Number(r[field]) || 0);
                        const sum = values.reduce((a, b) => a + b, 0);
                        const avg = sum / values.length;
                        externalDataContext += `  ${field}: soma=${sum.toFixed(2)}, média=${avg.toFixed(2)}, min=${Math.min(...values).toFixed(2)}, max=${Math.max(...values).toFixed(2)}\n`;
                      }
                    }
                    
                    // Add boolean field summaries
                    const boolFields = Object.keys(tableData[0]).filter(k => typeof tableData[0][k] === 'boolean');
                    if (boolFields.length > 0) {
                      externalDataContext += `Campos booleanos:\n`;
                      for (const field of boolFields) {
                        const trueCount = tableData.filter(r => r[field] === true).length;
                        externalDataContext += `  ${field}: ${trueCount} verdadeiros de ${tableData.length} (${((trueCount/tableData.length)*100).toFixed(1)}%)\n`;
                      }
                    }
                    
                    // Add text field distribution (top values)
                    const textFields = Object.keys(tableData[0]).filter(k => {
                      const v = tableData[0][k];
                      return typeof v === 'string' && !k.includes('id') && !k.includes('_at') && !k.includes('link') && !k.includes('resumo');
                    });
                    if (textFields.length > 0) {
                      externalDataContext += `Distribuição por campo:\n`;
                      for (const field of textFields) {
                        const dist: Record<string, number> = {};
                        tableData.forEach(r => {
                          const val = r[field];
                          if (val && String(val).trim()) {
                            dist[String(val)] = (dist[String(val)] || 0) + 1;
                          }
                        });
                        if (Object.keys(dist).length > 0 && Object.keys(dist).length <= 20) {
                          externalDataContext += `  ${field}: ${Object.entries(dist).map(([k, v]) => `${k}(${v})`).join(', ')}\n`;
                        }
                      }
                    }
                  }
                } catch {
                  // Table doesn't exist, skip
                }
              }
            } catch (e) {
              console.error("Error fetching external data:", e);
            }
          }
        }
      }

      // Get internal leads too
      const { data: leads } = await supabase
        .from("leads")
        .select("id, name, status, source, value, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(100);

      const leadsCount = leads?.length || 0;
      const convertedLeads = leads?.filter(l => l.status === "converted").length || 0;

      dataContext = `
## Contexto dos Dados da Organização "${org?.name || 'Cliente'}"

### Leads Internos (Pinn)
- Total: ${leadsCount}
- Convertidos: ${convertedLeads}

### Integrações Ativas
${integrations?.map(i => `- ${i.name} (${i.type}): ${i.status}`).join('\n') || 'Nenhuma'}

### Dashboards Configurados
${dashboards?.map(d => `- ${d.name}: ${(d.dashboard_widgets as any[])?.length || 0} widgets`).join('\n') || 'Nenhum'}

### Mapeamentos
${mappings?.map(m => `- ${m.source_table}.${m.source_column} → ${m.target_metric}`).join('\n') || 'Sem mapeamentos'}

${externalDataContext ? `### Dados Externos (Supabase do Cliente)\n${externalDataContext}` : '### Sem dados externos conectados'}
`;
    }

    // Mode-specific system prompts
    let systemPrompt: string;
    
    if (mode === 'insights') {
      systemPrompt = `Você é o Pinn AI, especialista em análise de dados de negócios. 
Analise os dados fornecidos e gere exatamente 3 insights acionáveis no formato JSON.

REGRAS:
- Responda APENAS com JSON válido, sem markdown ou texto extra
- Use os dados REAIS fornecidos, nunca invente números
- Cada insight deve ter: type (recommendation|alert|trend), priority (high|medium|low), content (texto conciso em pt-BR)
- Priorize insights sobre: conversão, oportunidades perdidas, padrões de comportamento

Formato esperado:
[
  {"type": "recommendation", "priority": "high", "content": "..."},
  {"type": "alert", "priority": "medium", "content": "..."},
  {"type": "trend", "priority": "low", "content": "..."}
]

${dataContext}`;

      // Non-streaming for insights mode
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
            { role: "user", content: "Gere 3 insights baseados nos dados acima." },
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "Payment required" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errorText = await response.text();
        console.error("AI gateway error:", status, errorText);
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiResult = await response.json();
      const rawContent = aiResult.choices?.[0]?.message?.content || "[]";
      
      // Parse JSON from AI response (may have markdown fences)
      let insights;
      try {
        const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        insights = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse insights JSON:", rawContent);
        insights = [
          { type: "recommendation", priority: "medium", content: "Dados insuficientes para gerar insights automáticos. Adicione mais registros." }
        ];
      }

      return new Response(JSON.stringify({ insights }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: streaming chat mode
    systemPrompt = `Você é o Pinn AI, um assistente inteligente especializado em análise de dados de negócios.
Você tem acesso aos dados reais da organização do usuário.

CAPACIDADES:
- Analisar tendências de leads e conversões
- Identificar padrões de performance
- Gerar relatórios detalhados
- Alertar sobre anomalias
- Recomendar ações baseadas nos dados
- Explicar métricas e KPIs

REGRAS:
- Seja objetivo, use dados concretos
- Inclua números, porcentagens e comparações
- Responda em português brasileiro
- Use Markdown para legibilidade
- Se algo não está nos dados, informe

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
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
