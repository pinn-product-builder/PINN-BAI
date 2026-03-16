import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Database,
  FileSpreadsheet,
  Search,
  MoreHorizontal,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  Calculator,
} from 'lucide-react';
import ConnectorDialog from '@/components/connectors/ConnectorDialog';
import MetricBuilder from '@/components/settings/MetricBuilder';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface Dataset {
  id: string;
  name: string;
  fileName: string;
  recordCount: number;
  status: 'ready' | 'processing' | 'error';
  createdAt: string;
  updatedAt: string;
  size: string;
}

const mockDatasets: Dataset[] = [
  {
    id: 'ds-1',
    name: 'Leads Março 2024',
    fileName: 'leads_marco_2024.xlsx',
    recordCount: 2450,
    status: 'ready',
    createdAt: '2024-03-15T10:30:00Z',
    updatedAt: '2024-03-15T10:35:00Z',
    size: '1.2 MB',
  },
  {
    id: 'ds-2',
    name: 'Leads Fevereiro 2024',
    fileName: 'leads_fevereiro_2024.csv',
    recordCount: 1890,
    status: 'ready',
    createdAt: '2024-02-20T14:00:00Z',
    updatedAt: '2024-02-20T14:12:00Z',
    size: '980 KB',
  },
  {
    id: 'ds-3',
    name: 'Importação Campanha Q1',
    fileName: 'campanha_q1_2024.xlsx',
    recordCount: 0,
    status: 'processing',
    createdAt: '2024-03-15T11:00:00Z',
    updatedAt: '2024-03-15T11:00:00Z',
    size: '2.5 MB',
  },
  {
    id: 'ds-4',
    name: 'Leads Janeiro 2024',
    fileName: 'leads_janeiro_2024.xlsx',
    recordCount: 1560,
    status: 'ready',
    createdAt: '2024-01-25T09:15:00Z',
    updatedAt: '2024-01-25T09:20:00Z',
    size: '850 KB',
  },
  {
    id: 'ds-5',
    name: 'Teste Importação',
    fileName: 'teste.csv',
    recordCount: 0,
    status: 'error',
    createdAt: '2024-03-10T16:00:00Z',
    updatedAt: '2024-03-10T16:01:00Z',
    size: '15 KB',
  },
];

const statusConfig = {
  ready: {
    label: 'Pronto',
    icon: CheckCircle,
    className: 'bg-success/10 text-success',
  },
  processing: {
    label: 'Processando',
    icon: Clock,
    className: 'bg-warning/10 text-warning',
  },
  error: {
    label: 'Erro',
    icon: AlertCircle,
    className: 'bg-destructive/10 text-destructive',
  },
};

const Datasets = () => {
  const { orgId } = useParams();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnectorOpen, setIsConnectorOpen] = useState(false);
  const [isMetricBuilderOpen, setIsMetricBuilderOpen] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>(mockDatasets);

  const handleOpenMetricBuilder = (dataset: Dataset) => {
    setSelectedDataset(dataset);
    setIsMetricBuilderOpen(true);
  };

  const handleConnectorSuccess = (config: any) => {
    const newDataset: Dataset = {
      id: `ds-${Date.now()}`,
      name: config.name,
      fileName: config.type === 'supabase' ? 'Supabase Table' : config.type === 'google_sheets' ? 'Google Sheet' : 'REST API',
      recordCount: 0,
      status: 'processing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      size: 'Remote Source',
    };

    setDatasets([newDataset, ...datasets]);

    toast({
      title: "Conector Registrado",
      description: `${config.name} foi adicionado aos seus conjuntos de dados.`,
    });
  };

  const filteredDatasets = datasets.filter(
    (ds) =>
      ds.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ds.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const stats = {
    total: datasets.length,
    totalRecords: datasets.reduce((acc, ds) => acc + ds.recordCount, 0),
    ready: datasets.filter((ds) => ds.status === 'ready').length,
    processing: datasets.filter((ds) => ds.status === 'processing').length,
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Datasets</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os conjuntos de dados importados
          </p>
        </div>
        <Button
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
          onClick={() => setIsConnectorOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Conectar Fonte Externa
        </Button>
      </div>

      <ConnectorDialog
        isOpen={isConnectorOpen}
        onOpenChange={setIsConnectorOpen}
        onSuccess={handleConnectorSuccess}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Datasets</p>
                <p className="text-3xl font-bold text-foreground">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Database className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Registros</p>
                <p className="text-3xl font-bold text-foreground">
                  {stats.totalRecords.toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Prontos</p>
                <p className="text-3xl font-bold text-success">{stats.ready}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Processando</p>
                <p className="text-3xl font-bold text-warning">{stats.processing}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Datasets Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Datasets</CardTitle>
              <CardDescription>{filteredDatasets.length} datasets encontrados</CardDescription>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dataset</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Registros</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Atualizado em</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDatasets.map((dataset) => {
                const status = statusConfig[dataset.status];
                const StatusIcon = status.icon;
                return (
                  <TableRow key={dataset.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileSpreadsheet className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{dataset.name}</p>
                          <p className="text-sm text-muted-foreground">{dataset.fileName}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={status.className}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {dataset.recordCount.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{dataset.size}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(dataset.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Download className="w-4 h-4 mr-2" />
                            Exportar
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Reprocessar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenMetricBuilder(dataset)}>
                            <Calculator className="w-4 h-4 mr-2" />
                            Métricas Calculadas
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isMetricBuilderOpen} onOpenChange={setIsMetricBuilderOpen}>
        <DialogContent className="sm:max-w-[600px] border-sidebar-border bg-sidebar shadow-2xl">
          <MetricBuilder
            columns={['leads', 'vendas', 'receita', 'visitantes', 'custo_ads']} // Mock columns for now
            onSave={(metric) => {
              toast({
                title: "Métrica Salva",
                description: `A métrica '${metric.name}' foi adicionada à camada semântica.`,
              });
              setIsMetricBuilderOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div >
  );
};

export default Datasets;
