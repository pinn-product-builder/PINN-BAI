import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Building2, 
  Database, 
  MapPin, 
  LayoutDashboard, 
  CheckCircle2, 
  Loader2,
  Users,
  Mail,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OnboardingWizardState } from '@/lib/mock-data';
import { planNames } from '@/lib/mock-data';

interface ConfirmationStepProps {
  state: OnboardingWizardState;
  isSubmitting: boolean;
  onSubmit: () => void;
}

const ConfirmationStep = ({ state, isSubmitting, onSubmit }: ConfirmationStepProps) => {
  const { organization, integration, mappings, selectedWidgets, isComplete } = state;

  if (isComplete) {
    return (
      <div className="py-12 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Organização Provisionada!
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          <strong>{organization.name}</strong> foi configurada com sucesso. 
          O administrador receberá um email com as credenciais de acesso.
        </p>
        <div className="mt-8 p-4 bg-muted/50 rounded-lg max-w-sm mx-auto">
          <p className="text-sm text-muted-foreground">Redirecionando para a lista de organizações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Confirmar Configuração
        </h2>
        <p className="text-muted-foreground">
          Revise todas as informações antes de provisionar a organização
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4">
        {/* Organization Info */}
        <Card className="p-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">Organização</h3>
                <Badge>{planNames[organization.plan]}</Badge>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-foreground font-medium">{organization.name}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {organization.adminName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {organization.adminEmail}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Integration Info */}
        <Card className="p-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">Integração de Dados</h3>
                <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">
                  Conectado
                </Badge>
              </div>
              <div className="mt-2">
                <p className="text-sm text-foreground">{integration?.name || 'N/A'}</p>
                {integration?.tables && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {integration.tables.length} tabelas detectadas • 
                    {integration.tables.reduce((acc, t) => acc + t.rowCount, 0).toLocaleString()} registros
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Mappings Info */}
        <Card className="p-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-purple-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-foreground">Mapeamento de Dados</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {mappings.map((mapping) => (
                  <Badge key={mapping.id} variant="secondary" className="text-xs">
                    {mapping.sourceField} → {mapping.targetMetric}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Dashboard Info */}
        <Card className="p-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <LayoutDashboard className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-foreground">Dashboard</h3>
              <div className="mt-2">
                <p className="text-sm text-muted-foreground">
                  {selectedWidgets.length} widgets configurados
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedWidgets.slice(0, 6).map((widget) => (
                    <Badge key={widget.id} variant="outline" className="text-xs">
                      {widget.title}
                    </Badge>
                  ))}
                  {selectedWidgets.length > 6 && (
                    <Badge variant="outline" className="text-xs">
                      +{selectedWidgets.length - 6} mais
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Separator />

      {/* What will be created */}
      <div className="p-4 bg-muted/50 rounded-lg border border-dashed">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">
              O que será criado automaticamente:
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Organização com ID único e configurações iniciais</li>
              <li>• Usuário administrador com credenciais de acesso</li>
              <li>• Conexão com a fonte de dados configurada</li>
              <li>• Dashboard completo com {selectedWidgets.length} widgets</li>
              <li>• Estrutura de permissões e RLS ativado</li>
              <li>• Email de boas-vindas enviado para {organization.adminEmail}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-center pt-4">
        <Button
          size="lg"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="bg-accent hover:bg-accent/90 text-accent-foreground min-w-[250px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Provisionando...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Provisionar Organização
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default ConfirmationStep;
