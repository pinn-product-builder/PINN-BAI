import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Building2, Plus, Database, Trash2, ExternalLink, Loader2, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useOrganizations, useCreateOrganization, useDeleteOrganization } from '@/hooks/useOrganizations';
import { planNames } from '@/lib/mock-data';

const OrganizationsSettingsCard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: organizations = [], isLoading: isLoadingOrgs } = useOrganizations();
  const createOrganization = useCreateOrganization();
  const deleteOrganization = useDeleteOrganization();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newOrgData, setNewOrgData] = useState({
    name: '',
    adminName: '',
    adminEmail: '',
    plan: '1' as string,
  });

  const handleCreateOrg = async () => {
    try {
      await createOrganization.mutateAsync({
        name: newOrgData.name,
        plan: parseInt(newOrgData.plan),
        admin_name: newOrgData.adminName,
        admin_email: newOrgData.adminEmail,
      });

      setNewOrgData({ name: '', adminName: '', adminEmail: '', plan: '1' });
      setIsDialogOpen(false);

      toast({
        title: 'Organização criada com sucesso',
        description: `${newOrgData.name} foi provisionada.`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao criar organização',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteOrg = async (orgId: string, orgName: string) => {
    try {
      await deleteOrganization.mutateAsync(orgId);
      toast({
        title: 'Organização removida',
        description: `${orgName} foi removida permanentemente.`,
        variant: 'destructive',
      });
    } catch (error) {
      toast({
        title: 'Erro ao remover organização',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Ativo</Badge>;
      case 'suspended':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Suspenso</Badge>;
      case 'trial':
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Trial</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-accent" />
            </div>
            <div>
              <CardTitle>Gestão de Organizações</CardTitle>
              <CardDescription>Crie, configure e gerencie clientes da plataforma</CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => navigate('/admin/organizations/onboarding')}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Wizard Completo
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Rápido
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Criar Nova Organização</DialogTitle>
                <DialogDescription>
                  Preencha os dados para provisionar um novo cliente
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Nome da Organização</Label>
                  <Input
                    id="org-name"
                    placeholder="Ex: TechCorp Solutions"
                    value={newOrgData.name}
                    onChange={(e) => setNewOrgData({ ...newOrgData, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-name">Nome do Admin</Label>
                    <Input
                      id="admin-name"
                      placeholder="Ex: João Silva"
                      value={newOrgData.adminName}
                      onChange={(e) => setNewOrgData({ ...newOrgData, adminName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email do Admin</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@empresa.com"
                      value={newOrgData.adminEmail}
                      onChange={(e) => setNewOrgData({ ...newOrgData, adminEmail: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan">Plano</Label>
                  <Select
                    value={newOrgData.plan}
                    onValueChange={(value) => setNewOrgData({ ...newOrgData, plan: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o plano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Starter - até 3 usuários</SelectItem>
                      <SelectItem value="2">Professional - até 10 usuários</SelectItem>
                      <SelectItem value="3">Business - até 25 usuários</SelectItem>
                      <SelectItem value="4">Enterprise - ilimitado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateOrg}
                  disabled={createOrganization.isPending || !newOrgData.name || !newOrgData.adminEmail}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {createOrganization.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Organização'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoadingOrgs ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : organizations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma organização cadastrada. Crie uma nova para começar.
          </div>
        ) : (
          organizations.map((org, index) => (
            <div key={org.id}>
              {index > 0 && <Separator className="my-4" />}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{org.name}</p>
                      {getStatusBadge(org.status)}
                      <Badge variant="outline">{planNames[org.plan]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {org.admin_email || 'Sem email'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/client/${org.id}/dashboard`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Abrir dashboard da organização"
                  >
                    <Button variant="outline" size="icon">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </a>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover Organização</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja remover <strong>{org.name}</strong>? Esta ação é irreversível e todos os dados serão perdidos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteOrg(org.id, org.name)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default OrganizationsSettingsCard;