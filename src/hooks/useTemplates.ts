import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

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
  field: string;
  aggregation: string;
}

// Apply a template to a dashboard - creates widgets based on template
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
      // Fetch template
      const { data: template, error: fetchError } = await supabase
        .from('dashboard_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (fetchError || !template) {
        throw new Error('Template não encontrado');
      }

      const templateWidgets = template.widgets as unknown as TemplateWidget[];

      // Get available views from integration or use common ones
      const availableViews: string[] = [];
      if (dataSource) {
        availableViews.push(dataSource);
      }
      // Add common views from reference project
      availableViews.push(
        'vw_dashboard_kpis_30d_v3',
        'vw_dashboard_daily_60d_v3',
        'vw_afonsina_custos_funil_dia',
        'vw_funnel_current_v3',
        'leads_v2',
      );

      // Smart mapping function - finds the best mapping for a widget
      const findBestMapping = (widget: TemplateWidget): MetricMapping | null => {
        const templateMetric = (widget.config as Record<string, unknown>)?.metric as string | undefined;
        const titleLower = (widget.title || '').toLowerCase();
        
        // Priority 1: Direct metric match from user mappings
        if (templateMetric && metricMappings?.[templateMetric]) {
          return metricMappings[templateMetric];
        }
        
        // Priority 2: Smart title-based matching with multiple strategies from user mappings
        if (metricMappings && Object.keys(metricMappings).length > 0) {
          // Strategy 1: Exact metric name in title
          const exactMatch = Object.entries(metricMappings).find(([targetMetric]) => {
            const metricLower = targetMetric.toLowerCase();
            return titleLower.includes(metricLower) || metricLower.includes(titleLower);
          });
          if (exactMatch) return exactMatch[1];
          
          // Strategy 2: Semantic matching (Portuguese + English)
          const semanticMatches: Array<{ keywords: string[]; metrics: string[] }> = [
            { keywords: ['lead', 'leads', 'lead'], metrics: ['total_leads', 'new_leads', 'leads'] },
            { keywords: ['receita', 'revenue', 'valor', 'value', 'amount'], metrics: ['revenue', 'total_revenue', 'mrr'] },
            { keywords: ['convers', 'conversion'], metrics: ['conversions', 'conversion'] },
            { keywords: ['taxa', 'rate', 'percent'], metrics: ['conversion_rate', 'growth_rate', 'rate'] },
            { keywords: ['novo', 'new'], metrics: ['new_leads', 'new'] },
            { keywords: ['total'], metrics: ['total_leads', 'total', 'total_revenue'] },
            { keywords: ['mrr', 'recorrente', 'recurring'], metrics: ['mrr', 'recurring'] },
            { keywords: ['ativo', 'active', 'usuário', 'user'], metrics: ['active_users', 'users'] },
            { keywords: ['mensagem', 'message'], metrics: ['mensagens', 'messages'] },
            { keywords: ['reunião', 'meeting'], metrics: ['reuniões_agendadas', 'meetings'] },
          ];
          
          for (const semantic of semanticMatches) {
            const hasKeyword = semantic.keywords.some(kw => titleLower.includes(kw));
            if (hasKeyword) {
              const match = Object.entries(metricMappings).find(([targetMetric]) => {
                const metricLower = targetMetric.toLowerCase();
                return semantic.metrics.some(m => metricLower.includes(m) || m.includes(metricLower));
              });
              if (match) return match[1];
            }
          }
          
          // Strategy 3: Partial word matching
          const partialMatch = Object.entries(metricMappings).find(([targetMetric]) => {
            const metricWords = targetMetric.toLowerCase().split(/[_\s]+/);
            const titleWords = titleLower.split(/[\s-]+/);
            return metricWords.some(mw => titleWords.some(tw => tw.includes(mw) || mw.includes(tw)));
          });
          if (partialMatch) return partialMatch[1];
        }
        
        // Priority 3: Use reference mappings from Afonsina project
        // Import reference mappings dynamically to avoid circular dependencies
        const { findFieldByWidgetTitle } = require('@/lib/referenceMappings');
        const referenceMapping = findFieldByWidgetTitle(widget.title || '', availableViews, []);
        
        if (referenceMapping) {
          console.log('[useTemplates] Using reference mapping for widget:', widget.title, referenceMapping);
          return {
            field: referenceMapping.fieldName,
            aggregation: referenceMapping.aggregation as 'sum' | 'avg' | 'count',
            sourceTable: referenceMapping.viewName,
          };
        }
        
        return null;
      };
      
      // Create widgets based on template with smart mapping
      const widgetsToCreate = templateWidgets.map((tw, index) => {
        const mapping = findBestMapping(tw);
        const templateMetric = (tw.config as Record<string, unknown>)?.metric as string | undefined;
        
        // Determine format based on widget title/config
        let format: 'number' | 'currency' | 'percentage' = 'number';
        const titleLower = (tw.title || '').toLowerCase();
        if (titleLower.includes('receita') || titleLower.includes('revenue') || titleLower.includes('valor') || titleLower.includes('mrr')) {
          format = 'currency';
        } else if (titleLower.includes('taxa') || titleLower.includes('rate') || titleLower.includes('percent')) {
          format = 'percentage';
        } else if (tw.config?.format) {
          format = tw.config.format as 'number' | 'currency' | 'percentage';
        }
        
        // Use mapping's sourceTable if available, otherwise fallback to dataSource
        const widgetTable = (mapping as any)?.sourceTable || dataSource || null;
        
        const widgetConfig: Record<string, unknown> = {
          ...tw.config,
          dataSource: widgetTable, // Each widget can use its own table
          sourceTable: widgetTable, // Also set sourceTable for consistency
          format,
        };
        
        // Apply mapping if found
        if (mapping) {
          widgetConfig.metric = mapping.field;
          widgetConfig.aggregation = mapping.aggregation;
          widgetConfig.targetMetric = templateMetric || Object.keys(metricMappings || {}).find(
            k => metricMappings![k] === mapping
          ) || null;
          
          // Ensure sourceTable is set from mapping
          if ((mapping as any).sourceTable) {
            widgetConfig.dataSource = (mapping as any).sourceTable;
            widgetConfig.sourceTable = (mapping as any).sourceTable;
          }
        } else {
          // Priority 1: Try Afonsina widget config (most accurate)
          const { findWidgetConfig } = require('@/lib/afonsinaWidgetConfig');
          const afonsinaConfig = findWidgetConfig(tw.title, tw.type);
          
          if (afonsinaConfig) {
            console.log('[useTemplates] Using Afonsina widget config for:', tw.title, afonsinaConfig);
            widgetConfig.metric = afonsinaConfig.metricField;
            widgetConfig.aggregation = afonsinaConfig.aggregation;
            widgetConfig.dataSource = afonsinaConfig.viewName;
            widgetConfig.sourceTable = afonsinaConfig.viewName;
            widgetConfig.format = afonsinaConfig.format || format;
            if (afonsinaConfig.groupBy) {
              widgetConfig.groupBy = afonsinaConfig.groupBy;
            }
          } else {
            // Priority 2: Try reference mappings as fallback
            const { findFieldByWidgetTitle } = require('@/lib/referenceMappings');
            const referenceMapping = findFieldByWidgetTitle(tw.title || '', availableViews, []);
            
            if (referenceMapping) {
              console.log('[useTemplates] Using reference mapping as fallback for widget:', tw.title, referenceMapping);
              widgetConfig.metric = referenceMapping.fieldName;
              widgetConfig.aggregation = referenceMapping.aggregation;
              widgetConfig.dataSource = referenceMapping.viewName;
              widgetConfig.sourceTable = referenceMapping.viewName;
            } else {
              // Last resort: try to use template metric as fallback (but warn)
              if (templateMetric) {
                console.warn('[useTemplates] No mapping found for widget:', tw.title, 'using template metric:', templateMetric);
                widgetConfig.targetMetric = templateMetric;
              } else {
                console.warn('[useTemplates] No mapping found for widget:', tw.title, 'and no template metric available');
              }
            }
          }
        }
        
        console.log('[useTemplates] Creating widget:', {
          title: tw.title,
          type: tw.type,
          templateMetric,
          mapping: mapping ? { field: mapping.field, aggregation: mapping.aggregation } : 'NOT FOUND',
          format,
          availableMappings: Object.keys(metricMappings || {}),
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

      const { error: insertError } = await supabase
        .from('dashboard_widgets')
        .insert(widgetsToCreate as never[]);

      if (insertError) throw insertError;

      // Increment usage count
      await incrementUsage.mutateAsync(templateId);

      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] });
      toast({
        title: 'Template aplicado',
        description: 'Os widgets do template foram criados no dashboard.',
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
