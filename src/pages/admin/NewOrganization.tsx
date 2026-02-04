import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Building2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { planNames } from '@/lib/mock-data';

const NewOrganization = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    adminName: '',
    adminEmail: '',
    plan: '1',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const baseSlug = formData.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      const uniqueSuffix = crypto.randomUUID().substring(0, 8);
      const slug = `${baseSlug}-${uniqueSuffix}`;

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: formData.name,
          slug,
          plan: parseInt(formData.plan),
          admin_name: formData.adminName,
          admin_email: formData.adminEmail,
          status: 'active'
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Create initial dashboard for the org (empty - widgets will be added via template in wizard)
      const { data: dash, error: dashError } = await supabase
        .from('dashboards')
        .insert({
          org_id: org.id,
          name: 'Main Executive View',
          is_default: true
        })
        .select()
        .single();

      if (dashError) throw dashError;

      toast({
        title: 'Organização criada com sucesso',
        description: `${formData.name} foi criada. Configure a integração de dados.`,
      });

      // Navigate to onboarding wizard step 2 (integration) with org data
      navigate('/admin/organizations/onboarding', {
        state: {
          existingOrg: {
            id: org.id,
            name: formData.name,
            adminName: formData.adminName,
            adminEmail: formData.adminEmail,
            plan: parseInt(formData.plan) as 1 | 2 | 3 | 4,
          }
        }
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao criar organização',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/admin/organizations"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para organizações
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Nova Organização</h1>
        <p className="text-muted-foreground mt-1">
          Provisione um novo cliente na plataforma Pinn BAI
        </p>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Dados da Organização</CardTitle>
                <CardDescription>
                  Preencha as informações para criar a organização e o usuário admin
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Organização</Label>
                <Input
                  id="name"
                  placeholder="Ex: TechCorp Solutions"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adminName">Nome do Admin</Label>
                  <Input
                    id="adminName"
                    placeholder="Ex: João Silva"
                    value={formData.adminName}
                    onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Email do Admin</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    placeholder="admin@empresa.com"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan">Plano</Label>
                <Select
                  value={formData.plan}
                  onValueChange={(value) => setFormData({ ...formData, plan: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-accent">Pinn Agent Sales</span>
                        <span className="text-xs text-muted-foreground">- Lead tracking & conversion</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-accent">Pinn Revenue OS</span>
                        <span className="text-xs text-muted-foreground">- Revenue forecasting & pipeline</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-accent">Pinn Growth Engine</span>
                        <span className="text-xs text-muted-foreground">- Attribution & LTV/CAC</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-accent">Pinn Process Automation Hub</span>
                        <span className="text-xs text-muted-foreground">- Bot ROI & throughput</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-accent font-bold">Pinn MicroSaaS Studio</span>
                        <span className="text-xs text-muted-foreground">- Universal BI & Semantic Layer</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="text-sm font-medium text-foreground mb-2">
                  O que será criado automaticamente:
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Organização com ID único e slug</li>
                  <li>• Usuário admin com credenciais de acesso</li>
                  <li>• Dashboard inicial baseado no template do plano</li>
                  <li>• Estrutura de dados pronta para importação</li>
                </ul>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/admin/organizations')}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Organização'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NewOrganization;
