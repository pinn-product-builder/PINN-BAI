import { useState } from 'react';
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
import { Building2, Plus, Settings, Database, Trash2, Edit, ExternalLink, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { mockOrganizations, planNames, type Organization } from '@/lib/mock-data';

const OrganizationsSettingsCard = () => {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>(mockOrganizations);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSupabaseDialogOpen, setIsSupabaseDialogOpen] = useState(false);
  const [newOrgData, setNewOrgData] = useState({
    name: '',
    adminName: '',
    adminEmail: '',
    plan: '1' as string,
  });
  const [supabaseConfig, setSupabaseConfig] = useState({
    projectUrl: '',
    anonKey: '',
  });

  const handleCreateOrg = async () => {
    setIsCreating(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const newOrg: Organization = {
      id: `org-${Date.now()}`,
      name: newOrgData.name,
      slug: newOrgData.name.toLowerCase().replace(/\s+/g, '-'),
      plan: parseInt(newOrgData.plan) as 1 | 2 | 3 | 4,
      status: 'trial',
      createdAt: new Date().toISOString(),
      adminEmail: newOrgData.adminEmail,
      adminName: newOrgData.adminName,
      totalUsers: 1,
      totalLeads: 0,
      settings: {
        theme: 'light',
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
        dataRefreshInterval: 10,
        allowUserUploads: true,
        maxFileSize: 25,
        retentionDays: 60,
      },
    };

    setOrganizations([...organizations, newOrg]);
    setNewOrgData({ name: '', adminName: '', adminEmail: '', plan: '1' });
    setIsDialogOpen(false);
    setIsCreating(false);

    toast({
      title: 'Organização criada com sucesso',
      description: `${newOrg.name} foi provisionada com o plano ${planNames[newOrg.plan]}.`,
    });
  };

  const handleConnectSupabase = async () => {
    if (!selectedOrg) return;

    setIsCreating(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const updatedOrgs = organizations.map((org) =>
      org.id === selectedOrg.id
        ? {
            ...org,
            supabaseConfig: {
              projectUrl: supabaseConfig.projectUrl,
              anonKey: supabaseConfig.anonKey,
              isConnected: true,
              lastSync: new Date().toISOString(),
            },
          }
        : org
    );

    setOrganizations(updatedOrgs);
    setSupabaseConfig({ projectUrl: '', anonKey: '' });
    setIsSupabaseDialogOpen(false);
    setSelectedOrg(null);
    setIsCreating(false);

    toast({
      title: 'Supabase conectado',
      description: `Integração configurada para ${selectedOrg.name}.`,
    });
  };

  const handleDeleteOrg = (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    setOrganizations(organizations.filter((o) => o.id !== orgId));
    toast({
      title: 'Organização removida',
      description: `${org?.name} foi removida permanentemente.`,
      variant: 'destructive',
    });
  };

  const handleStatusChange = (orgId: string, status: 'active' | 'suspended' | 'trial') => {
    setOrganizations(organizations.map((org) =>
      org.id === orgId ? { ...org, status } : org
    ));
    toast({
      title: 'Status atualizado',
      description: `Status alterado para ${status}.`,
    });
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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Nova Organização
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
                  disabled={isCreating || !newOrgData.name || !newOrgData.adminEmail}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {isCreating ? (
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
      </CardHeader>
      <CardContent className="space-y-4">
        {organizations.map((org, index) => (
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
                    {org.adminEmail} • {org.totalUsers} usuários • {org.totalLeads.toLocaleString()} leads
                  </p>
                  {org.supabaseConfig?.isConnected && (
                    <p className="text-xs text-emerald-500 flex items-center gap-1 mt-1">
                      <Database className="w-3 h-3" />
                      Supabase conectado
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={org.status}
                  onValueChange={(value) => handleStatusChange(org.id, value as 'active' | 'suspended' | 'trial')}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setSelectedOrg(org);
                    setSupabaseConfig({
                      projectUrl: org.supabaseConfig?.projectUrl || '',
                      anonKey: org.supabaseConfig?.anonKey || '',
                    });
                    setIsSupabaseDialogOpen(true);
                  }}
                >
                  <Database className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={`/client/${org.id}/dashboard`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
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
                        onClick={() => handleDeleteOrg(org.id)}
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
        ))}

        {/* Supabase Integration Dialog */}
        <Dialog open={isSupabaseDialogOpen} onOpenChange={setIsSupabaseDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Integração Supabase</DialogTitle>
              <DialogDescription>
                Configure a conexão com o Supabase de {selectedOrg?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="supabase-url">URL do Projeto</Label>
                <Input
                  id="supabase-url"
                  placeholder="https://xxxxx.supabase.co"
                  value={supabaseConfig.projectUrl}
                  onChange={(e) => setSupabaseConfig({ ...supabaseConfig, projectUrl: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Encontre em: Project Settings → API → Project URL
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supabase-key">Anon Key</Label>
                <Input
                  id="supabase-key"
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseConfig.anonKey}
                  onChange={(e) => setSupabaseConfig({ ...supabaseConfig, anonKey: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Encontre em: Project Settings → API → anon public key
                </p>
              </div>
              {selectedOrg?.supabaseConfig?.isConnected && (
                <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <p className="text-sm text-emerald-600 font-medium">✓ Conectado</p>
                  <p className="text-xs text-muted-foreground">
                    Última sincronização: {new Date(selectedOrg.supabaseConfig.lastSync || '').toLocaleString('pt-BR')}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSupabaseDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleConnectSupabase}
                disabled={isCreating || !supabaseConfig.projectUrl || !supabaseConfig.anonKey}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  'Salvar Conexão'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default OrganizationsSettingsCard;
