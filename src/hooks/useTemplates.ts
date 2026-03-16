import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { resolveByWidgetTitle } from '@/lib/referenceMappings';
import { findReferenceMapping } from '@/lib/referenceMappings';

type WidgetType = Database['public']['Enums']['widget_type'];

export interface TemplateWidget {
  type: string;
  title: string;
  description?: string;
  size: 'small' | 'medium' | 'large' | 'full';
  position: number;
  config: Record<string, unknown>;
}

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string | null;
  plan: number;
  category: string | null;
  widgets: TemplateWidget[];
  preview_image_url: string | null;
  is_active: boolean | null;
  usage_count: number | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const useTemplates = (planFilter?: number) => {
  return useQuery({
    queryKey: ['dashboard-templates', planFilter],
    queryFn: async () => {
      let query = supabase
        .from('dashboard_templates')
        .select('*')
        .eq('is_active', true)
        .order('plan', { ascending: true });

      if (planFilter) {
        query = query.lte('plan', planFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as unknown as DashboardTemplate[];
    },
  });
};

export const useAllTemplates = () => {
  return useQuery({
    queryKey: ['dashboard-templates-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_templates')
        .select('*')
        .order('plan', { ascending: true });
      
      if (error) throw error;
      return data as unknown as DashboardTemplate[];
    },
  });
};

export const useCreateTemplate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (template: Omit<DashboardTemplate, 'id' | 'created_at' | 'updated_at' | 'usage_count'>) => {
      const insertData = {
        name: template.name,
        description: template.description,
        plan: template.plan,
        category: template.category,
        widgets: JSON.parse(JSON.stringify(template.widgets)),
        preview_image_url: template.preview_image_url,
        is_active: template.is_active,
        created_by: template.created_by,
      };

      const { data, error } = await supabase
        .from('dashboard_templates')
        .insert(insertData as never)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-templates'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-templates-all'] });
      toast({
        title: 'Template criado',
        description: 'O template foi criado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateTemplate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...template }: Partial<DashboardTemplate> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      
      if (template.name !== undefined) updateData.name = template.name;
      if (template.description !== undefined) updateData.description = template.description;
      if (template.plan !== undefined) updateData.plan = template.plan;
      if (template.category !== undefined) updateData.category = template.category;
      if (template.widgets !== undefined) updateData.widgets = JSON.parse(JSON.stringify(template.widgets));
      if (template.preview_image_url !== undefined) updateData.preview_image_url = template.preview_image_url;
      if (template.is_active !== undefined) updateData.is_active = template.is_active;

      const { data, error } = await supabase
        .from('dashboard_templates')
        .update(updateData as never)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-templates'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-templates-all'] });
      toast({
        title: 'Template atualizado',
        description: 'As alterações foram salvas.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dashboard_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-templates'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-templates-all'] });
      toast({
        title: 'Template excluído',
        description: 'O template foi removido.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao excluir template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useDuplicateTemplate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (templateId: string) => {
      // First get the template
      const { data: original, error: fetchError } = await supabase
        .from('dashboard_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (fetchError) throw fetchError;
      if (!original) throw new Error('Template não encontrado');

      // Create a copy
      const { data, error } = await supabase
        .from('dashboard_templates')
        .insert({
          name: `${original.name} (Cópia)`,
          description: original.description,
          plan: original.plan,
          category: original.category,
          widgets: original.widgets,
          preview_image_url: original.preview_image_url,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-templates'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-templates-all'] });
      toast({
        title: 'Template duplicado',
        description: 'Uma cópia do template foi criada.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao duplicar template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useIncrementTemplateUsage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      // Get current count
      const { data: template, error: fetchError } = await supabase
        .from('dashboard_templates')
        .select('usage_count')
        .eq('id', templateId)
        .single();
      
      if (fetchError) throw fetchError;

      // Increment
      const { error } = await supabase
        .from('dashboard_templates')
        .update({ usage_count: (template?.usage_count || 0) + 1 })
        .eq('id', templateId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-templates'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-templates-all'] });
    },
  });
};

// Metric mapping type for applying templates with external data
export interface MetricMapping {
  /** Nome da coluna REAL na tabela de origem (sourceField) */
  field: string;
  /** Tipo de agregação (sum, count, avg, min, max) */
  aggregation: string;
  /** Tabela/view de origem (cada widget pode ter sua própria) */
  sourceTable?: string;
  /** Tipo de transformação/formato (none, date, number, currency, percentage) */
  transformation?: string;
  /** Campo de data/tempo real para groupBy em gráficos temporais */
  groupByField?: string;
}

// =====================================================================
// Apply a template to a dashboard — GENÉRICO para qualquer cliente
// Fluxo: template.targetMetric → userMapping → widget.metric/dataSource
// =====================================================================
export const useApplyTemplate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const incrementUsage = useIncrementTemplateUsage();

  return useMutation({
    mutationFn: async ({
      templateId,
      dashboardId,
      dataSource,
      metricMappings,
    }: {
      templateId: string;
      dashboardId: string;
      dataSource?: string;
      metricMappings?: Record<string, MetricMapping>;
    }) => {
      // 1. Buscar template
      const { data: template, error: fetchError } = await supabase
        .from('dashboard_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (fetchError || !template) {
        throw new Error('Template não encontrado');
      }

      const templateWidgets = template.widgets as unknown as TemplateWidget[];
      const mappingEntries = Object.entries(metricMappings || {});

      // 2. Resolver mapeamento: encontra o MetricMapping mais adequado para um widget
      const resolveMapping = (widget: TemplateWidget): MetricMapping | null => {
        const cfg = widget.config as Record<string, unknown>;
        const targetMetric = (cfg?.targetMetric as string) || (cfg?.metric as string) || '';
        const titleLower = (widget.title || '').toLowerCase();

        if (mappingEntries.length === 0) return null;

        // A) Match direto por targetMetric
        if (targetMetric && metricMappings![targetMetric]) {
          return metricMappings![targetMetric];
        }

        // B) Match por targetMetric parcial (ex: "total_leads" vs mapeamento "leads")
        if (targetMetric) {
          const match = mappingEntries.find(([key]) => {
            const kl = key.toLowerCase();
            const tl = targetMetric.toLowerCase();
            return kl === tl || kl.includes(tl) || tl.includes(kl);
          });
          if (match) return match[1];
        }

        // C) Match semântico por título do widget (PT + EN)
        const semanticRules: Array<{ keywords: string[]; metricHints: string[] }> = [
          { keywords: ['total de leads', 'total leads'], metricHints: ['total_leads', 'leads', 'lead'] },
          { keywords: ['novos leads', 'new leads', 'novo lead'], metricHints: ['new_leads', 'leads_new'] },
          { keywords: ['mensagem', 'message', 'msg'], metricHints: ['messages', 'mensagens', 'msg_in'] },
          { keywords: ['reunião agendada', 'meetings scheduled', 'reuniões agendadas'], metricHints: ['meetings_scheduled', 'reunioes'] },
          { keywords: ['reunião realizada', 'meetings done', 'reuniões realizadas'], metricHints: ['meetings_done', 'reunioes_realizadas'] },
          { keywords: ['reunião conclu', 'meetings completed', 'reuniões conclu'], metricHints: ['meetings_completed', 'meetings_done'] },
          { keywords: ['investimento', 'investment', 'spend'], metricHints: ['investment', 'spend', 'custo_total', 'investimento'] },
          { keywords: ['cpl', 'custo por lead', 'cost per lead'], metricHints: ['cost_per_lead', 'cpl'] },
          { keywords: ['custo por reunião', 'cost per meeting'], metricHints: ['cost_per_meeting', 'cpm', 'cp_meeting'] },
          { keywords: ['conv', 'taxa', 'rate', 'conversão'], metricHints: ['conversion_rate', 'lead_to_meeting', 'taxa'] },
          { keywords: ['receita', 'revenue', 'mrr'], metricHints: ['revenue', 'mrr', 'receita'] },
          { keywords: ['funil', 'funnel', 'pipeline'], metricHints: ['funnel', 'pipeline', 'stage'] },
          { keywords: ['origem', 'source', 'canal'], metricHints: ['source', 'origem', 'canal'] },
          { keywords: ['evolução', 'evolution', 'diária', 'daily'], metricHints: ['daily', 'evolution', 'trend'] },
        ];

        for (const rule of semanticRules) {
          if (rule.keywords.some(kw => titleLower.includes(kw))) {
            const match = mappingEntries.find(([key]) => {
              const kl = key.toLowerCase();
              return rule.metricHints.some(h => kl.includes(h) || h.includes(kl));
            });
            if (match) return match[1];
          }
        }

        // D) Match por palavras parciais (última tentativa)
        const titleWords = titleLower.split(/[\s\-→]+/).filter(w => w.length >= 3);
        const partialMatch = mappingEntries.find(([key]) => {
          const keyWords = key.toLowerCase().split(/[_\s]+/);
          return titleWords.some(tw => keyWords.some(kw => tw.includes(kw) || kw.includes(tw)));
        });
        if (partialMatch) return partialMatch[1];

        return null;
      };

      // 3. Resolver formato a partir do widget config ou título
      const resolveFormat = (widget: TemplateWidget): 'number' | 'currency' | 'percentage' => {
        const cfg = widget.config as Record<string, unknown>;
        if (cfg?.format && ['currency', 'percentage', 'number'].includes(cfg.format as string)) {
          return cfg.format as 'number' | 'currency' | 'percentage';
        }
        const tl = (widget.title || '').toLowerCase();
        if (['investimento', 'receita', 'revenue', 'custo', 'cpl', 'mrr', 'spend', 'valor'].some(k => tl.includes(k))) return 'currency';
        if (['taxa', 'rate', 'conv', 'percent', '%'].some(k => tl.includes(k))) return 'percentage';
        return 'number';
      };

      // 4. Analisar tabelas disponíveis a partir dos mapeamentos do usuário
      // Descobrir a melhor tabela para cada tipo de widget
      const tableFrequency = new Map<string, number>();
      const tablesByPurpose: Record<string, string | null> = {
        kpi: null,       // Tabela com KPIs pré-calculados (1 row)
        timeseries: null, // Tabela com dados diários/temporais
        funnel: null,     // Tabela com estágios/funil
        leads: null,      // Tabela principal de leads/contatos
        general: null,    // Tabela mais usada (fallback)
      };

      // Classificar tabelas pelos mapeamentos
      for (const [, mapping] of mappingEntries) {
        if (!mapping.sourceTable) continue;
        const t = mapping.sourceTable.toLowerCase();
        tableFrequency.set(mapping.sourceTable, (tableFrequency.get(mapping.sourceTable) || 0) + 1);

        // KPI views (agregadas) — detectar por padrão de nome
        if (t.includes('kpi') || t.includes('_30d') || t.includes('_7d') || t.includes('summary') || t.includes('overview') ||
            /^vw_|^view_/i.test(t)) {
          tablesByPurpose.kpi = mapping.sourceTable;
        }
        // Daily/time-series views
        if (t.includes('daily') || t.includes('_60d') || t.includes('_90d') || t.includes('time') || t.includes('dia') || t.includes('day')) {
          tablesByPurpose.timeseries = mapping.sourceTable;
        }
        // Funnel/pipeline
        if (t.includes('funnel') || t.includes('pipeline') || t.includes('stage') || t.includes('funil')) {
          tablesByPurpose.funnel = mapping.sourceTable;
        }
        // Leads/contacts
        if (t.includes('lead') || t.includes('contact') || t.includes('cliente') || t.includes('customer') || t.includes('prospect')) {
          tablesByPurpose.leads = mapping.sourceTable;
        }
      }

      // Tabela mais usada = general fallback
      let maxFreq = 0;
      for (const [table, freq] of tableFrequency) {
        if (freq > maxFreq) {
          maxFreq = freq;
          tablesByPurpose.general = table;
        }
      }

      // Fallback global
      const globalFallback = dataSource || tablesByPurpose.general || tablesByPurpose.leads;

      // Resolver a melhor tabela para cada tipo de widget
      const resolveTableForWidget = (widgetType: string, title: string): string | null => {
        const tl = title.toLowerCase();
        switch (widgetType) {
          case 'metric_card':
            // KPIs preferem view agregada, senão leads, senão geral
            return tablesByPurpose.kpi || tablesByPurpose.leads || globalFallback;
          case 'area_chart':
          case 'line_chart':
            // Séries temporais preferem view diária
            return tablesByPurpose.timeseries || globalFallback;
          case 'funnel':
            // Funil precisa da view de pipeline
            return tablesByPurpose.funnel || globalFallback;
          case 'pie_chart':
          case 'bar_chart':
            // Distribuição — leads ou geral
            return tablesByPurpose.leads || globalFallback;
          case 'table':
            // Tabelas usam leads/contatos
            if (tl.includes('lead') || tl.includes('contato')) return tablesByPurpose.leads || globalFallback;
            if (tl.includes('reuni') || tl.includes('meeting')) return tablesByPurpose.timeseries || globalFallback;
            return tablesByPurpose.leads || globalFallback;
          case 'insight_card':
            return null; // Insights IA não precisam de tabela
          default:
            return globalFallback;
        }
      };

      console.log('[useApplyTemplate] Tables detected:', tablesByPurpose);

      // 5. Descobrir nomes reais de colunas dos mapeamentos do usuario
      // Isso é CRITICO: os nomes no template (created_date, lead_source, funnel_stage)
      // não existem na tabela real do cliente — precisamos usar os nomes reais
      const realColumnNames = new Set<string>();
      const realDateColumns: string[] = [];
      const realCategoricalColumns: string[] = [];
      
      for (const [, mapping] of mappingEntries) {
        // groupByField salvo no onboarding tem prioridade máxima
        if ((mapping as any).groupByField) {
          realDateColumns.unshift((mapping as any).groupByField);
        }
        if (mapping.field) {
          realColumnNames.add(mapping.field);
          const fl = mapping.field.toLowerCase();
          if (fl.includes('date') || fl.endsWith('_at') || fl.includes('dia') ||
              fl === 'day' || fl === 'dia' || fl.includes('data') ||
              fl.includes('created') || fl.includes('updated') || fl.includes('event_day')) {
            if (!realDateColumns.includes(mapping.field)) {
              realDateColumns.push(mapping.field);
            }
          }
          if (fl.includes('source') || fl.includes('origem') || fl.includes('canal') ||
              fl.includes('status') || fl.includes('stage') || fl.includes('tipo') ||
              fl.includes('type') || fl.includes('category') || fl.includes('etapa')) {
            realCategoricalColumns.push(mapping.field);
          }
        }
      }
      
      console.log('[useApplyTemplate] Real columns detected:', { realDateColumns, realCategoricalColumns, allColumns: [...realColumnNames] });

      // 6. Construir widgets com mapeamento inteligente
      const widgetsToCreate = templateWidgets.map((tw, index) => {
        const cfg = tw.config as Record<string, unknown>;
        const mapping = resolveMapping(tw);
        const format = resolveFormat(tw);

        // NÃO copiar cegamente o cfg do template — as colunas do template não existem
        // nos dados do cliente. Copiar só campos de layout/comportamento, não de dados.
        const widgetConfig: Record<string, unknown> = {
          format,
          showTrend: cfg?.showTrend,
          showSparkline: cfg?.showSparkline,
          maxInsights: cfg?.maxInsights,
          includeRecommendations: cfg?.includeRecommendations,
          pageSize: cfg?.pageSize,
          targetMetric: cfg?.targetMetric,
        };

        // ================================================================
        // ESTRATÉGIA DE RESOLUÇÃO MULTI-CAMADA (Afonsina → Mapping → Fallback)
        // ================================================================
        
        // Camada 1: Verificar se temos configuração Afonsina para este widget
        const afonsinaConfig = resolveByWidgetTitle(tw.title, []);
        
        // Lista de views disponíveis nos mapeamentos do usuário
        const userAvailableViews = [...new Set(mappingEntries.map(([, m]) => m.sourceTable).filter(Boolean))] as string[];
        
        if (afonsinaConfig && userAvailableViews.includes(afonsinaConfig.viewName)) {
          // Afonsina config + view existe nos dados do cliente → MATCH PERFEITO
          console.log(`[useApplyTemplate] Afonsina match: ${tw.title} → ${afonsinaConfig.viewName}.${afonsinaConfig.fieldName}`);
          widgetConfig.dataSource = afonsinaConfig.viewName;
          widgetConfig.sourceTable = afonsinaConfig.viewName;
          widgetConfig.metric = afonsinaConfig.fieldName;
          widgetConfig.aggregation = afonsinaConfig.aggregation as WidgetConfig['aggregation'];
          // format and groupBy not available on ResolvedMapping
        } else if (afonsinaConfig) {
          // Afonsina config existe mas a view NÃO está nos mapeamentos do usuário
          // Tentar reference mapping com views disponíveis
          const targetMetric = (cfg?.targetMetric as string) || '';
          const refMapping = targetMetric ? findReferenceMapping(targetMetric, userAvailableViews) : null;
          
          if (refMapping && userAvailableViews.includes(refMapping.viewName)) {
            console.log(`[useApplyTemplate] Reference mapping: ${tw.title} → ${refMapping.viewName}.${refMapping.fieldName}`);
            widgetConfig.dataSource = refMapping.viewName;
            widgetConfig.sourceTable = refMapping.viewName;
            widgetConfig.metric = refMapping.fieldName;
            widgetConfig.aggregation = refMapping.aggregation;
            if (afonsinaConfig.groupBy) widgetConfig.groupBy = afonsinaConfig.groupBy;
          } else if (mapping) {
            // Fallback para mapeamento do usuário
            widgetConfig.metric = mapping.field;
            widgetConfig.aggregation = mapping.aggregation || cfg?.aggregation || 'count';
            widgetConfig.transformation = mapping.transformation || 'none';
            if (mapping.sourceTable) {
              widgetConfig.dataSource = mapping.sourceTable;
              widgetConfig.sourceTable = mapping.sourceTable;
            }
          }
        } else if (mapping) {
          // Camada 2: Sem Afonsina config → usar mapeamento do usuário
          widgetConfig.metric = mapping.field;
          widgetConfig.aggregation = mapping.aggregation || cfg?.aggregation || 'count';
          widgetConfig.transformation = mapping.transformation || 'none';
          if (mapping.sourceTable) {
            widgetConfig.dataSource = mapping.sourceTable;
            widgetConfig.sourceTable = mapping.sourceTable;
          }
          // Propagar groupByField do mapping quando disponível
          if (mapping.groupByField && !widgetConfig.groupBy) {
            widgetConfig.groupBy = mapping.groupByField;
          }
        } else {
          // Camada 3: SEM mapeamento → usar defaults inteligentes por tipo
          widgetConfig.aggregation = cfg?.aggregation || 'count';
        }

        // Definir groupBy inteligente por tipo de widget (usando colunas REAIS)
        // Prioridade: groupByField do mapping > realDateColumns > fallback 'day'
        const widgetType = tw.type;
        if (!widgetConfig.groupBy) {
          if (widgetType === 'area_chart' || widgetType === 'line_chart') {
            // Tentar groupByField do mapping resolvido primeiro
            const mappingGroupBy = mapping?.groupByField;
            widgetConfig.groupBy = mappingGroupBy || realDateColumns[0] || 'day';
          } else if (widgetType === 'pie_chart' || widgetType === 'bar_chart') {
            widgetConfig.groupBy = realCategoricalColumns[0] || 'source';
            if (!widgetConfig.aggregation || widgetConfig.aggregation === 'count') {
              widgetConfig.aggregation = 'count';
            }
          } else if (widgetType === 'funnel') {
            const stageCol = realCategoricalColumns.find(c => {
              const cl = c.toLowerCase();
              return cl.includes('stage') || cl.includes('etapa') || cl.includes('status') || cl.includes('fase');
            }) || realCategoricalColumns[0] || 'status';
            widgetConfig.groupBy = stageCol;
            if (!widgetConfig.aggregation) widgetConfig.aggregation = 'count';
          } else if (widgetType === 'table') {
            delete widgetConfig.columns;
          }
        }
        
        // Se ainda sem dataSource, usar resolução inteligente por tipo de widget
        if (!widgetConfig.dataSource) {
          const bestTable = resolveTableForWidget(tw.type, tw.title);
          if (bestTable) {
            widgetConfig.dataSource = bestTable;
            widgetConfig.sourceTable = bestTable;
          }
        }

        // Fallback final: usar dataSource global
        if (!widgetConfig.dataSource && globalFallback) {
          widgetConfig.dataSource = globalFallback;
          widgetConfig.sourceTable = globalFallback;
        }

        // Garantir sourceTable sincronizado com dataSource
        if (widgetConfig.dataSource && !widgetConfig.sourceTable) {
          widgetConfig.sourceTable = widgetConfig.dataSource;
        }

        // Marcar se é view agregada (evita double-aggregation no engine)
        if (widgetConfig.dataSource) {
          const ds = String(widgetConfig.dataSource).toLowerCase();
          widgetConfig.isAggregatedView =
            /^vw_|^view_/i.test(ds) ||
            /kpi|_30d|_60d|_7d|summary|overview/i.test(ds);
          // Séries temporais NUNCA são views agregadas (têm múltiplos rows)
          if (tw.type === 'area_chart' || tw.type === 'line_chart') {
            widgetConfig.isAggregatedView = false;
          }
        }

        console.log('[useApplyTemplate]', tw.title, '→', {
          metric: widgetConfig.metric,
          targetMetric: widgetConfig.targetMetric,
          dataSource: widgetConfig.dataSource,
          aggregation: widgetConfig.aggregation,
          groupBy: widgetConfig.groupBy,
          format: widgetConfig.format,
          isAggregatedView: widgetConfig.isAggregatedView,
          mappingFound: !!mapping,
        });

        return {
          dashboard_id: dashboardId,
          title: tw.title,
          type: tw.type as WidgetType,
          position: index,
          size: tw.size,
          config: widgetConfig,
          description: tw.description || null,
        };
      });

      // 5. Inserir widgets
      const { error: insertError } = await supabase
        .from('dashboard_widgets')
        .insert(widgetsToCreate as never[]);

      if (insertError) throw insertError;

      // 6. Incrementar contagem de uso
      await incrementUsage.mutateAsync(templateId);

      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] });
      toast({
        title: 'Template aplicado',
        description: 'Dashboard criado com sucesso a partir do template.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao aplicar template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};
