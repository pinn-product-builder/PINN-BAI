import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card } from '@/components/ui/card';
import { Building2, Users, Zap, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { planNames, planLimits } from '@/lib/mock-data';

interface OrganizationStepProps {
  data: {
    name: string;
    adminName: string;
    adminEmail: string;
    plan: 1 | 2 | 3 | 4;
  };
  onUpdate: (data: Partial<OrganizationStepProps['data']>) => void;
}

const planIcons = {
  1: Users,
  2: Zap,
  3: Building2,
  4: Crown,
};

const OrganizationStep = ({ data, onUpdate }: OrganizationStepProps) => {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Dados da Organização
        </h2>
        <p className="text-muted-foreground">
          Preencha as informações básicas do novo cliente
        </p>
      </div>

      {/* Basic Info */}
      <div className="grid gap-6">
        <div className="space-y-2">
          <Label htmlFor="org-name">Nome da Organização *</Label>
          <Input
            id="org-name"
            placeholder="Ex: TechCorp Solutions"
            value={data.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="max-w-md"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <div className="space-y-2">
            <Label htmlFor="admin-name">Nome do Administrador *</Label>
            <Input
              id="admin-name"
              placeholder="Ex: João Silva"
              value={data.adminName}
              onChange={(e) => onUpdate({ adminName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email do Administrador *</Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="admin@empresa.com"
              value={data.adminEmail}
              onChange={(e) => onUpdate({ adminEmail: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Plan Selection */}
      <div className="space-y-4">
        <div>
          <Label className="text-base">Selecione o Plano</Label>
          <p className="text-sm text-muted-foreground">
            Escolha o plano que melhor atende às necessidades do cliente
          </p>
        </div>

        <RadioGroup
          value={data.plan.toString()}
          onValueChange={(value) => onUpdate({ plan: parseInt(value) as 1 | 2 | 3 | 4 })}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {([1, 2, 3, 4] as const).map((plan) => {
            const Icon = planIcons[plan];
            const limits = planLimits[plan];
            const isSelected = data.plan === plan;

            return (
              <Label key={plan} className="cursor-pointer">
                <RadioGroupItem value={plan.toString()} className="sr-only" />
                <Card
                  className={cn(
                    "p-4 transition-all hover:border-accent/50",
                    isSelected && "border-accent bg-accent/5 ring-2 ring-accent/20"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      isSelected ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{planNames[plan]}</p>
                      <p className="text-sm text-muted-foreground">
                        {limits.users === -1 ? 'Ilimitado' : `Até ${limits.users} usuários`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <ul className="space-y-1">
                      {limits.features.slice(0, 3).map((feature, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-accent" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              </Label>
            );
          })}
        </RadioGroup>
      </div>

      {/* Preview what will be created */}
      <div className="p-4 bg-muted/50 rounded-lg border border-dashed">
        <h4 className="text-sm font-medium text-foreground mb-2">
          O que será criado automaticamente:
        </h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Organização com ID único e slug baseado no nome</li>
          <li>• Usuário administrador com credenciais de acesso</li>
          <li>• Dashboard inicial baseado no plano selecionado</li>
          <li>• Estrutura de dados pronta para integração</li>
        </ul>
      </div>
    </div>
  );
};

export default OrganizationStep;
