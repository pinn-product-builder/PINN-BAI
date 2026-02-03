import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check, Building2, Database, MapPin, LayoutDashboard, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

import OrganizationStep from './steps/OrganizationStep';
import IntegrationStep, { type DataIntegration } from './steps/IntegrationStep';
import MappingStep, { type DataMapping } from './steps/MappingStep';
import PreviewStep, { type DashboardWidgetConfig } from './steps/PreviewStep';
import ConfirmationStep from './steps/ConfirmationStep';

interface OnboardingWizardState {
  currentStep: number;
  organization: {
    name: string;
    adminName: string;
    adminEmail: string;
    plan: 1 | 2 | 3 | 4;
  };
  integration: DataIntegration | null;
  mappings: DataMapping[];
  selectedWidgets: DashboardWidgetConfig[];
  isComplete: boolean;
}

const STEPS = [
  { id: 1, title: 'Organização', icon: Building2, description: 'Dados básicos' },
  { id: 2, title: 'Integração', icon: Database, description: 'Fonte de dados' },
  { id: 3, title: 'Mapeamento', icon: MapPin, description: 'Campos e métricas' },
  { id: 4, title: 'Preview', icon: LayoutDashboard, description: 'Visualização' },
  { id: 5, title: 'Confirmação', icon: CheckCircle2, description: 'Finalizar' },
];

const OnboardingWizard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [state, setState] = useState<OnboardingWizardState>({
    currentStep: 1,
    organization: {
      name: '',
      adminName: '',
      adminEmail: '',
      plan: 2,
    },
    integration: null,
    mappings: [],
    selectedWidgets: [],
    isComplete: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const progress = ((state.currentStep - 1) / (STEPS.length - 1)) * 100;

  const canProceed = () => {
    switch (state.currentStep) {
      case 1:
        return state.organization.name && state.organization.adminEmail && state.organization.adminName;
      case 2:
        return state.integration && state.integration.status === 'connected';
      case 3:
        return state.mappings.length >= 2;
      case 4:
        return state.selectedWidgets.length >= 3;
      case 5:
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
    if (state.currentStep > 1) {
      setState(prev => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    
    // Simulate API call to create everything
    await new Promise(resolve => setTimeout(resolve, 2500));

    setState(prev => ({ ...prev, isComplete: true }));
    setIsSubmitting(false);

    toast({
      title: 'Organização provisionada com sucesso!',
      description: `${state.organization.name} está pronta para uso.`,
    });

    // Navigate back to organizations after a short delay
    setTimeout(() => {
      navigate('/admin/organizations');
    }, 2000);
  };

  const updateOrganization = (data: Partial<OnboardingWizardState['organization']>) => {
    setState(prev => ({
      ...prev,
      organization: { ...prev.organization, ...data },
    }));
  };

  const updateIntegration = (integration: DataIntegration | null) => {
    setState(prev => ({ ...prev, integration }));
  };

  const updateMappings = (mappings: DataMapping[]) => {
    setState(prev => ({ ...prev, mappings }));
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
          <IntegrationStep
            integration={state.integration}
            onUpdate={updateIntegration}
          />
        );
      case 3:
        return (
          <MappingStep
            integration={state.integration}
            mappings={state.mappings}
            onUpdate={updateMappings}
          />
        );
      case 4:
        return (
          <PreviewStep
            mappings={state.mappings}
            widgets={state.selectedWidgets}
            plan={state.organization.plan}
            onUpdate={updateWidgets}
          />
        );
      case 5:
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
        {STEPS.map((step, index) => {
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
              {index < STEPS.length - 1 && (
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
      {state.currentStep < 5 && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={state.currentStep === 1}
          >
            Voltar
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {state.currentStep === 4 ? 'Revisar e Finalizar' : 'Próximo'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default OnboardingWizard;
