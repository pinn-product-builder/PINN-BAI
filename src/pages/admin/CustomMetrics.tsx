import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { 
  Search, 
  Trash2, 
  TrendingUp, 
  Building2, 
  BarChart3, 
  Loader2,
  Hash,
  Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SavedMetric {
  id: string;
  org_id: string;
  metric_name: string;
  display_label: string;
  description: string | null;
  transformation: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

interface Organization {
  id: string;
  name: string;
}

const CustomMetrics = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<string>('all');

  // Fetch all organizations
  const { data: organizations = [] } = useQuery({
    queryKey: ['admin-orgs-for-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data as Organization[];
    },
  });

  // Fetch all saved metrics
  const { data: metrics = [], isLoading } = useQuery({
    queryKey: ['admin-all-metrics', selectedOrg],
    queryFn: async () => {
      let query = supabase
        .from('saved_custom_metrics')
        .select('*')
        .order('usage_count', { ascending: false });

      if (selectedOrg !== 'all') {
        query = query.eq('org_id', selectedOrg);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as SavedMetric[];
    },
  });

  // Delete metric mutation
  const deleteMutation = useMutation({
    mutationFn: async (metricId: string) => {
      const { error } = await supabase
        .from('saved_custom_metrics')
        .delete()
        .eq('id', metricId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-metrics'] });
      toast({
        title: 'Métrica removida',
        description: 'A métrica customizada foi excluída com sucesso.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro ao remover',
        description: 'Não foi possível excluir a métrica.',
        variant: 'destructive',
      });
    },
  });

  // Filter metrics by search
  const filteredMetrics = metrics.filter(metric => 
    metric.metric_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    metric.display_label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get org name by id
  const getOrgName = (orgId: string | null) => {
    if (!orgId) return 'Sem organização';
    const org = organizations.find(o => o.id === orgId);
    return org?.name || 'Organização desconhecida';
  };

  // Stats
  const totalMetrics = metrics.length;
  const totalUsage = metrics.reduce((sum, m) => sum + (m.usage_count || 0), 0);
  const orgsWithMetrics = new Set(metrics.map(m => m.org_id)).size;

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Métricas Customizadas</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie as métricas personalizadas salvas por cada organização
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border/50 bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-accent/10">
                <BarChart3 className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Métricas</p>
                <p className="text-2xl font-bold text-foreground">{totalMetrics}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-accent/10">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Uso Total</p>
                <p className="text-2xl font-bold text-foreground">{totalUsage}x</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-accent/10">
                <Building2 className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Orgs com Métricas</p>
                <p className="text-2xl font-bold text-foreground">{orgsWithMetrics}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome da métrica..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedOrg} onValueChange={setSelectedOrg}>
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue placeholder="Filtrar por organização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as organizações</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Table */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Métricas Salvas</CardTitle>
          <CardDescription>
            {filteredMetrics.length} métrica{filteredMetrics.length !== 1 ? 's' : ''} encontrada{filteredMetrics.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredMetrics.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-xl">
              <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">Nenhuma métrica encontrada</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery || selectedOrg !== 'all' 
                  ? 'Tente ajustar os filtros de busca.'
                  : 'Métricas customizadas aparecerão aqui quando criadas no onboarding.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Métrica</TableHead>
                  <TableHead>Organização</TableHead>
                  <TableHead>Transformação</TableHead>
                  <TableHead className="text-center">Uso</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMetrics.map((metric) => (
                  <TableRow key={metric.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{metric.display_label}</p>
                        <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {metric.metric_name}
                        </code>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{getOrgName(metric.org_id)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {metric.transformation || 'none'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Hash className="w-3 h-3 text-muted-foreground" />
                        <span className="font-medium">{metric.usage_count || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(metric.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover métrica?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. A métrica "{metric.display_label}" será 
                              permanentemente removida e não aparecerá mais nas sugestões.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(metric.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomMetrics;
