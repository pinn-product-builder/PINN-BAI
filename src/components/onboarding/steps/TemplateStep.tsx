import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LayoutTemplate, Sparkles, FileX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTemplates, DashboardTemplate } from '@/hooks/useTemplates';
import TemplatePreviewCard from '@/components/admin/TemplatePreviewCard';

interface TemplateStepProps {
  plan: 1 | 2 | 3 | 4;
  selectedTemplateId: string | null;
  selectedTemplate: DashboardTemplate | null;
  onSelect: (templateId: string | null, template: DashboardTemplate | null) => void;
}

const TemplateStep = ({ plan, selectedTemplateId, selectedTemplate, onSelect }: TemplateStepProps) => {
  const { data: templates, isLoading, error } = useTemplates(plan);

  const handleSelectTemplate = (template: DashboardTemplate) => {
    if (selectedTemplateId === template.id) {
      // Deselect
      onSelect(null, null);
    } else {
      onSelect(template.id, template);
    }
  };

  const handleStartFromScratch = () => {
    onSelect(null, null);
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Erro ao carregar templates: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Escolha um Template Base
        </h2>
        <p className="text-muted-foreground">
          Selecione um modelo pronto ou comece do zero. O template define os widgets iniciais do dashboard.
        </p>
      </div>

      {/* Start from scratch option */}
      <Card
        className={cn(
          "p-4 cursor-pointer transition-all border-dashed",
          selectedTemplateId === null && selectedTemplate === null
            ? "ring-2 ring-accent border-accent bg-accent/5"
            : "hover:border-accent/50"
        )}
        onClick={handleStartFromScratch}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
            <FileX className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Começar do Zero</h3>
            <p className="text-sm text-muted-foreground">
              Configure os widgets manualmente no próximo passo
            </p>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-sm text-muted-foreground">ou escolha um template</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="p-4 border-b">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div>
                    <Skeleton className="h-5 w-32 mb-2" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              </div>
              <div className="p-4">
                <Skeleton className="h-16 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : templates && templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <TemplatePreviewCard
              key={template.id}
              template={template}
              isSelected={selectedTemplateId === template.id}
              onSelect={() => handleSelectTemplate(template)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <LayoutTemplate className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Nenhum template disponível para este plano
          </h3>
          <p className="text-muted-foreground mb-4">
            Você pode configurar os widgets manualmente no próximo passo
          </p>
        </div>
      )}

      {/* Selected template summary */}
      {selectedTemplate && (
        <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-accent" />
            <div>
              <p className="font-medium text-foreground">
                Template selecionado: {selectedTemplate.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {(selectedTemplate.widgets || []).length} widgets serão adicionados ao dashboard
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateStep;
