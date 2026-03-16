import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check, Building2, Database, MapPin, LayoutDashboard, CheckCircle2, LayoutTemplate } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useApplyTemplate, useIncrementTemplateUsage, DashboardTemplate, TemplateWidget } from '@/hooks/useTemplates';

import OrganizationStep from './steps/OrganizationStep';
import TemplateStep from './steps/TemplateStep';
import IntegrationStep, { type DataIntegration } from './steps/IntegrationStep';
import MappingStep, { type DataMapping } from './steps/MappingStep';
import PreviewStep, { type DashboardWidgetConfig } from './steps/PreviewStep';
import ConfirmationStep from './steps/ConfirmationStep';

interface ExistingOrgData {
  id: string;
  name: string;
  adminName: string;
  adminEmail: string;
  plan: 1 | 2 | 3 | 4;
}

export interface OnboardingWizardState {
  currentStep: number;
  organizationId?: string;
  organization: {
    name: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    plan: 1 | 2 | 3 | 4;
  };
  selectedTemplateId: string | null;
  selectedTemplate: DashboardTemplate | null;
  integration: DataIntegration | null;
  mappings: DataMapping[];
  selectedWidgets: DashboardWidgetConfig[];
  primaryTable: string | null; // Primary table (informative/fallback only - widgets use their own sourceTable from mappings)
  isComplete: boolean;
}

const STEPS = [
  { id: 1, title: 'Organização', icon: Building2, description: 'Dados básicos' },
  { id: 2, title: 'Template', icon: LayoutTemplate, description: 'Base do dashboard' },
  { id: 3, title: 'Integração', icon: Database, description: 'Fonte de dados' },
  { id: 4, title: 'Mapeamento', icon: MapPin, description: 'Campos e métricas' },
  { id: 5, title: 'Preview', icon: LayoutDashboard, description: 'Visualização' },
  { id: 6, title: 'Confirmação', icon: CheckCircle2, description: 'Finalizar' },
];

const OnboardingWizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  // Check if we're coming from NewOrganization with existing org data
  const existingOrg = (location.state as { existingOrg?: ExistingOrgData })?.existingOrg;
  
  const [state, setState] = useState<OnboardingWizardState>({
    currentStep: existingOrg ? 2 : 1, // Skip to step 2 if org already exists
    organizationId: existingOrg?.id,
    organization: existingOrg ? {
      name: existingOrg.name,
      adminName: existingOrg.adminName,
      adminEmail: existingOrg.adminEmail,
      adminPassword: '', // Already created via NewOrganization
      plan: existingOrg.plan,
    } : {
      name: '',
      adminName: '',
      adminEmail: '',
      adminPassword: '',
      plan: 2,
    },
    selectedTemplateId: null,
    selectedTemplate: null,
    integration: null,
    mappings: [],
    selectedWidgets: [],
    primaryTable: null,
    isComplete: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const applyTemplate = useApplyTemplate();
  
  // Filter steps if org already exists (skip step 1)
  const visibleSteps = existingOrg ? STEPS.filter(s => s.id !== 1) : STEPS;

  const progress = ((state.currentStep - (existingOrg ? 2 : 1)) / (visibleSteps.length - 1)) * 100;

  const canProceed = () => {
    switch (state.currentStep) {
      case 1:
        return state.organization.name && state.organization.adminEmail && state.organization.adminName && state.organization.adminPassword.length >= 6;
      case 2:
        // Template step - can always proceed (selecting a template is optional)
        return true;
      case 3:
        return state.integration && state.integration.status === 'connected';
      case 4:
        return state.mappings.length >= 2;
      case 5:
        // At least 3 widgets OR has a template selected
        return state.selectedWidgets.length >= 3 || state.selectedTemplate !== null;
      case 6:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (state.currentStep < STEPS.length) {
      setState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
    }
  };

  const handleBack = () => {
    const minStep = existingOrg ? 2 : 1;
    if (state.currentStep > minStep) {
      setState(prev => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    
    try {
      // 1. Find the dashboard for this organization
      const { data: dashboard, error: dashError } = await supabase
        .from('dashboards')
        .select('id')
        .eq('org_id', state.organizationId!)
        .eq('is_default', true)
        .single();

      if (dashError || !dashboard) {
        throw new Error('Dashboard não encontrado para esta organização');
      }

      // 2. Apply template if selected
      if (state.selectedTemplateId && state.selectedTemplate) {
        // Get primary table from state or first mapping's table (informative only - widgets use their own tables)
        // Since widgets can use multiple tables, we use the first mapping's table as a fallback
        const firstMappingTable = state.mappings[0]?.sourceTable;
        const dataSource = state.primaryTable 
          || firstMappingTable
          || state.integration?.tables?.[0]?.name 
          || null;

        // Build metric mappings from the mapping step - each mapping includes sourceTable + transformation
        const metricMappings = state.mappings.reduce((acc, m) => ({
          ...acc,
          [m.targetMetric]: {
            field: m.sourceField,
            aggregation: m.aggregation || 'count',
            sourceTable: m.sourceTable,
            transformation: m.transformation || 'none',
            groupByField: m.groupByField,
          },
        }), {} as Record<string, { field: string; aggregation: string; sourceTable?: string; transformation?: string; groupByField?: string }>);

        await applyTemplate.mutateAsync({
          templateId: state.selectedTemplateId,
          dashboardId: dashboard.id,
          dataSource: dataSource || undefined, // Fallback for backward compatibility
          metricMappings: Object.keys(metricMappings).length > 0 ? metricMappings : undefined,
        });
      } 
      // Or create widgets from manual selection — enriquecer com dataSource
      else if (state.selectedWidgets.length > 0) {
        const allTables = state.mappings.map(m => m.sourceTable).filter(Boolean);
        const primaryTable = state.primaryTable || allTables[0] || state.integration?.tables?.[0]?.name;

        // Helper: detecta view KPI agregada
        const isAggView = (t?: string | null): boolean => {
          if (!t) return false;
          const tl = t.toLowerCase();
          return /^vw_|^view_/i.test(tl) || /kpi|_30d|_60d|_7d|summary|overview|dashboard/i.test(tl);
        };

        const widgetsToCreate = state.selectedWidgets.map((w, index) => {
          const config = { ...(w.config || {}) } as Record<string, unknown>;

          // Garantir dataSource
          if (!config.dataSource && primaryTable) {
            config.dataSource = primaryTable;
          }
          // Sincronizar sourceTable
          if (config.dataSource && !config.sourceTable) {
            config.sourceTable = config.dataSource;
          }

          // Marcar se é view agregada (evita double-sum no engine)
          if (config.dataSource && config.isAggregatedView === undefined) {
            config.isAggregatedView = isAggView(config.dataSource as string);
            // Gráficos temporais nunca são agregados
            if (w.type === 'area_chart' || w.type === 'line_chart') {
              config.isAggregatedView = false;
            }
          }

          return {
            dashboard_id: dashboard.id,
            title: w.title,
            type: w.type,
            position: index,
            config,
            description: null,
          };
        });

        const { error: widgetError } = await supabase
          .from('dashboard_widgets')
          .insert(widgetsToCreate as never[]);

        if (widgetError) throw widgetError;
      }
      // Fallback final: se nenhum widget foi criado, criar set mínimo inteligente
      else if (state.mappings.length > 0) {
        const primaryTable = state.primaryTable || state.mappings[0]?.sourceTable || state.integration?.tables?.[0]?.name;
        if (primaryTable) {

          // Helper: detecta se uma tabela é view KPI agregada
          const isAggView = (t?: string | null): boolean => {
            if (!t) return false;
            const tl = t.toLowerCase();
            return /^vw_|^view_/i.test(tl) || /kpi|_30d|_60d|_7d|summary|overview|dashboard/i.test(tl);
          };

          // Helper: campo de data real nos mapeamentos
          const realDateField = state.mappings.find(m =>
            m.targetMetric === 'created_date' ||
            /^(day|dia|date|data|created_at|event_day)$/i.test(m.sourceField) ||
            /date|dia|day|created/i.test(m.sourceField)
          )?.sourceField || 'day';

          // View de séries temporais (daily/60d) para gráficos
          const timeseriesMapping = state.mappings.find(m => {
            const tl = m.sourceTable.toLowerCase();
            return /daily|diario|_60d|_90d/i.test(tl);
          });
          const timeseriesTable = timeseriesMapping?.sourceTable || primaryTable;

          const fallbackWidgets: Array<{
            dashboard_id: string;
            title: string;
            type: string;
            position: number;
            config: Record<string, unknown>;
            description: string | null;
          }> = [];

          // KPIs dos primeiros 3 mapeamentos — com config completo e correto
          state.mappings.slice(0, 3).forEach((m, i) => {
            const prettyTitle = m.targetMetric.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const table = m.sourceTable || primaryTable;
            fallbackWidgets.push({
              dashboard_id: dashboard.id,
              title: prettyTitle,
              type: 'metric_card',
              position: i,
              config: {
                dataSource: table,
                sourceTable: table,
                metric: m.sourceField,           // coluna real
                targetMetric: m.targetMetric,
                aggregation: m.aggregation || (m.transformation === 'percentage' ? 'avg' : 'sum'),
                format: m.transformation === 'currency' ? 'currency'
                  : m.transformation === 'percentage' ? 'percentage' : 'number',
                transformation: m.transformation || 'none',
                isAggregatedView: isAggView(table),
                showTrend: true,
                showSparkline: true,
              },
              description: null,
            });
          });

          // Gráfico de evolução — usa view daily e campo de data real
          fallbackWidgets.push({
            dashboard_id: dashboard.id,
            title: 'Evolução',
            type: 'area_chart',
            position: fallbackWidgets.length,
            config: {
              dataSource: timeseriesTable,
              sourceTable: timeseriesTable,
              metric: timeseriesMapping?.sourceField,
              groupBy: realDateField,
              aggregation: 'sum',
              format: 'number',
              isAggregatedView: false,  // séries temporais sempre multi-row
              gradientFill: true,
              showGrid: true,
            },
            description: 'Evolução ao longo do tempo',
          });

          // Tabela de dados
          fallbackWidgets.push({
            dashboard_id: dashboard.id,
            title: 'Dados Recentes',
            type: 'table',
            position: fallbackWidgets.length,
            config: {
              dataSource: primaryTable,
              sourceTable: primaryTable,
              pageSize: 10,
            },
            description: 'Registros mais recentes',
          });

          const { error: widgetError } = await supabase
            .from('dashboard_widgets')
            .insert(fallbackWidgets as never[]);

          if (widgetError) throw widgetError;
        }
      }

      // 3. Save integration if configured
      if (state.integration && state.organizationId) {
        const { error: intError } = await supabase
          .from('integrations')
          .insert({
            org_id: state.organizationId,
            type: state.integration.type as 'supabase' | 'google_sheets' | 'csv' | 'api',
            name: state.integration.name,
            config: state.integration.config || {},
            status: 'connected',
          });

        if (intError) throw intError;
      }

      // 4. Save data mappings if any
      // Note: This requires integration_id, so we need to handle this properly
      // For now, we'll skip this step as it requires more complex handling

      setState(prev => ({ ...prev, isComplete: true }));
      
      toast({
        title: 'Organização provisionada com sucesso!',
        description: `${state.organization.name} está pronta para uso.`,
      });

      // Navigate back to organizations after a short delay
      setTimeout(() => {
        navigate('/admin/organizations');
      }, 2000);
      
    } catch (error: any) {
      toast({
        title: 'Erro ao provisionar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateOrganization = (data: Partial<OnboardingWizardState['organization']>) => {
    setState(prev => ({
      ...prev,
      organization: { ...prev.organization, ...data },
    }));
  };

  const updateTemplate = (templateId: string | null, template: DashboardTemplate | null) => {
    setState(prev => ({
      ...prev,
      selectedTemplateId: templateId,
      selectedTemplate: template,
      // Pre-populate widgets from template for preview step
      selectedWidgets: template 
        ? (template.widgets || []).map((w, idx) => ({
            id: `template-widget-${idx}`,
            type: w.type as DashboardWidgetConfig['type'],
            title: w.title,
            description: w.description || '',
            position: { x: 0, y: idx * 2, w: 4, h: 2 },
            dataMapping: [],
            config: w.config,
          }))
        : [],
    }));
  };

  const updateIntegration = (integration: DataIntegration | null) => {
    setState(prev => ({ ...prev, integration }));
  };

  const updateMappings = (mappings: DataMapping[]) => {
    setState(prev => ({ ...prev, mappings }));
  };

  const updatePrimaryTable = (tableName: string) => {
    setState(prev => ({ ...prev, primaryTable: tableName }));
  };

  const updateWidgets = (widgets: DashboardWidgetConfig[]) => {
    setState(prev => ({ ...prev, selectedWidgets: widgets }));
  };

  const renderStep = () => {
    switch (state.currentStep) {
      case 1:
        return (
          <OrganizationStep
            data={state.organization}
            onUpdate={updateOrganization}
          />
        );
      case 2:
        return (
          <TemplateStep
            plan={state.organization.plan}
            selectedTemplateId={state.selectedTemplateId}
            selectedTemplate={state.selectedTemplate}
            onSelect={updateTemplate}
          />
        );
      case 3:
        return (
          <IntegrationStep
            integration={state.integration}
            onUpdate={updateIntegration}
          />
        );
      case 4:
        return (
          <MappingStep
            integration={state.integration}
            mappings={state.mappings}
            onUpdate={updateMappings}
            onPrimaryTableChange={updatePrimaryTable}
          />
        );
      case 5:
        return (
          <PreviewStep
            mappings={state.mappings}
            widgets={state.selectedWidgets}
            plan={state.organization.plan}
            onUpdate={updateWidgets}
            hasTemplate={!!state.selectedTemplateId}
            templateName={state.selectedTemplate?.name}
          />
        );
      case 6:
        return (
          <ConfirmationStep
            state={state}
            isSubmitting={isSubmitting}
            onSubmit={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Provisionar Nova Organização</h1>
        <p className="text-muted-foreground mt-1">
          Siga o passo a passo para configurar o cliente na plataforma
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <Progress value={progress} className="h-2" />
      </div>

      {/* Steps Navigation */}
      <div className="flex items-center justify-between mb-8">
        {visibleSteps.map((step, index) => {
          const Icon = step.icon;
          const isActive = state.currentStep === step.id;
          const isCompleted = state.currentStep > step.id;
          
          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                    isCompleted
                      ? "bg-accent text-accent-foreground"
                      : isActive
                        ? "bg-accent/20 text-accent border-2 border-accent"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p className={cn(
                    "text-sm font-medium",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {step.description}
                  </p>
                </div>
              </div>
              {index < visibleSteps.length - 1 && (
                <div 
                  className={cn(
                    "h-0.5 w-16 sm:w-24 mx-2 transition-colors",
                    isCompleted ? "bg-accent" : "bg-muted"
                  )} 
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card className="mb-8">
        <CardContent className="p-6">
          {renderStep()}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      {state.currentStep < 6 && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={state.currentStep === (existingOrg ? 2 : 1)}
          >
            Voltar
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {state.currentStep === 5 ? 'Revisar e Finalizar' : 'Próximo'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default OnboardingWizard;
