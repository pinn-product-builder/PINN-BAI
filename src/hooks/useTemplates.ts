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

      // Create widgets based on template with injected dataSource
      const widgetsToCreate = templateWidgets.map((tw, index) => {
        const templateMetric = (tw.config as Record<string, unknown>)?.metric as string | undefined;
        let mapping = templateMetric && metricMappings ? metricMappings[templateMetric] : null;
        
        // If no mapping found, try to infer from widget title
        if (!mapping && tw.title) {
          const titleLower = tw.title.toLowerCase();
          
          // Try to find matching mapping by target metric name
          const matchingMapping = Object.entries(metricMappings || {}).find(([targetMetric]) => {
            const metricLower = targetMetric.toLowerCase();
            return (
              titleLower.includes(metricLower) ||
              (titleLower.includes('lead') && metricLower.includes('lead')) ||
              (titleLower.includes('receita') && metricLower.includes('revenue')) ||
              (titleLower.includes('revenue') && metricLower.includes('revenue')) ||
              (titleLower.includes('convers') && metricLower.includes('conversion')) ||
              (titleLower.includes('taxa') && metricLower.includes('rate'))
            );
          });
          
          if (matchingMapping) {
            mapping = matchingMapping[1];
            console.log('[useTemplates] Found mapping by title match:', tw.title, '->', matchingMapping[0]);
          }
        }
        
        // Log for debugging
        console.log('[useTemplates] Creating widget:', {
          title: tw.title,
          templateMetric,
          mapping: mapping ? { field: mapping.field, aggregation: mapping.aggregation } : null,
          availableMappings: Object.keys(metricMappings || {}),
        });

        return {
          dashboard_id: dashboardId,
          title: tw.title,
          type: tw.type as WidgetType,
          position: index,
          size: tw.size,
          config: {
            ...tw.config,
            // Inject dataSource if available (required for external data fetch)
            dataSource: dataSource || null,
            // Apply metric mapping if available
            ...(mapping && {
              metric: mapping.field,
              aggregation: mapping.aggregation,
            }),
            // Store target metric for reference
            ...(templateMetric && { targetMetric: templateMetric }),
          },
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
