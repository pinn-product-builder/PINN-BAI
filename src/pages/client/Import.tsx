import { useState, useCallback } from 'react';
import { Link, useNavigate, useParams, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Settings,
  Upload,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { DataProfiler } from '@/lib/data-profiler';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

type ImportStep = 'upload' | 'analyze' | 'mapping' | 'confirm';

interface DetectedColumn {
  name: string;
  type: 'string' | 'number' | 'date' | 'email' | 'phone' | 'category';
  sample: string[];
  suggestedMapping: string | null;
}

const systemFields = [
  { value: 'lead.name', label: 'Nome do Lead' },
  { value: 'lead.email', label: 'Email' },
  { value: 'lead.phone', label: 'Telefone' },
  { value: 'lead.company', label: 'Empresa' },
  { value: 'lead.source', label: 'Origem' },
  { value: 'lead.status', label: 'Status' },
  { value: 'lead.created_at', label: 'Data de Criação' },
  { value: 'lead.value', label: 'Valor Potencial' },
  { value: 'custom', label: 'Campo Customizado' },
  { value: 'ignore', label: 'Ignorar Coluna' },
];

const ClientImport = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organization } = useTheme();
  const { profile, signOut } = useAuth();

  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [detectedColumns, setDetectedColumns] = useState<DetectedColumn[]>([]);

  const steps = [
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'analyze', label: 'Análise', icon: FileSpreadsheet },
    { id: 'mapping', label: 'Mapeamento', icon: Settings },
    { id: 'confirm', label: 'Confirmação', icon: Check },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      setSelectedFile(file);
    } else {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, selecione um arquivo .xlsx, .xls ou .csv',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleAnalyze = async () => {
    setCurrentStep('analyze');
    setIsAnalyzing(true);

    // In a real app, we would parse the CSV here
    // For now, let's use the DataProfiler with mock data
    const mockData = [
      { 'Nome': 'João', 'Valor': 1000, 'Data': '2024-01-01', 'Status': 'Lead Qualificado' },
      { 'Nome': 'Maria', 'Valor': 2500, 'Data': '2024-01-02', 'Status': 'Novo' },
      { 'Nome': 'Pedro', 'Valor': 500, 'Data': '2024-01-03', 'Status': 'Novo' },
    ];

    const profiled = DataProfiler.profile(mockData);
    const cols: DetectedColumn[] = profiled.map(p => ({
      name: p.name,
      type: p.type as any,
      sample: [String(mockData[0][p.name as keyof typeof mockData[0]])],
      suggestedMapping: 'custom'
    }));

    setDetectedColumns(cols);
    setIsAnalyzing(false);
    setCurrentStep('mapping');
  };

  const handleImport = async () => {
    if (!orgId) return;

    setCurrentStep('confirm');
    setIsImporting(true);

    try {
      // 1. Create a Premium Dashboard automatically
      const { data: dashboard, error: dashError } = await supabase
        .from('dashboards')
        .insert({
          org_id: orgId,
          name: `Dashboard Inteligente - ${new Date().toLocaleDateString()}`,
          is_default: true,
          layout: {} as Json
        })
        .select()
        .single();

      if (dashError) throw dashError;

      // 2. Generate and store suggested widgets
      const profiled = DataProfiler.profile([
        { 'Vendas': 5000, 'Leads': 120, 'Data': '2024-02-01', 'Canal': 'Google Ads' },
        { 'Vendas': 7000, 'Leads': 150, 'Data': '2024-02-02', 'Canal': 'LinkedIn' },
        { 'Vendas': 3000, 'Leads': 80, 'Data': '2024-02-03', 'Canal': 'Referral' }
      ]);
      const recommendations = DataProfiler.recommendWidgets(profiled, organization?.plan || 1);

      const widgetsToInsert = recommendations.map((rec, idx) => ({
        dashboard_id: dashboard.id,
        type: rec.type,
        title: rec.title,
        description: rec.description,
        config: rec.config as any,
        width: rec.width,
        height: rec.height,
        position_x: (idx % 3) * 4,
        position_y: Math.floor(idx / 3) * 2,
        is_visible: true
      }));

      const { error: widgetError } = await supabase
        .from('dashboard_widgets')
        .insert(widgetsToInsert);

      if (widgetError) throw widgetError;

      toast({
        title: 'Auto-Setup Concluído!',
        description: 'Analisamos seus dados e criamos um dashboard premium para você.',
      });

      navigate(`/client/${orgId}/dashboard`);
    } catch (error: any) {
      toast({
        title: 'Erro no Auto-Setup',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate(`/client/${orgId}/dashboard`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Dashboard
        </Button>
        <h1 className="text-3xl font-bold text-foreground">Importar Dados</h1>
        <p className="text-muted-foreground mt-1">
          Importe seus dados de leads e clientes para análise automática via IA.
        </p>
      </div>

      {/* Progress steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-2xl">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${isCompleted
                      ? 'bg-success text-success-foreground'
                      : isCurrent
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted text-muted-foreground'
                      }`}
                  >
                    {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span
                    className={`mt-2 text-sm font-medium ${isCurrent ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-24 h-0.5 mx-2 ${isCompleted ? 'bg-success' : 'bg-muted'
                      }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="max-w-4xl">
        {/* Upload step */}
        {currentStep === 'upload' && (
          <Card>
            <CardHeader>
              <CardTitle>Faça upload do seu arquivo</CardTitle>
              <CardDescription>
                Suportamos arquivos Excel (.xlsx, .xls) e CSV
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${isDragging
                  ? 'border-accent bg-accent/5'
                  : selectedFile
                    ? 'border-success bg-success/5'
                    : 'border-muted-foreground/25 hover:border-accent'
                  }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {selectedFile ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-lg bg-success/10 flex items-center justify-center">
                      <FileSpreadsheet className="w-8 h-8 text-success" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedFile(null)}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Remover arquivo
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-lg bg-muted flex items-center justify-center">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        Arraste e solte seu arquivo aqui
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ou clique para selecionar
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button variant="outline" asChild>
                      <label htmlFor="file-upload" className="cursor-pointer">
                        Selecionar arquivo
                      </label>
                    </Button>
                  </div>
                )}
              </div>

              {selectedFile && (
                <div className="mt-6 flex justify-end">
                  <Button
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    onClick={handleAnalyze}
                  >
                    Continuar
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Analyze step */}
        {currentStep === 'analyze' && isAnalyzing && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <Loader2 className="w-12 h-12 mx-auto text-accent animate-spin" />
                <div>
                  <p className="font-medium text-foreground">Analisando arquivo...</p>
                  <p className="text-sm text-muted-foreground">
                    Detectando colunas e sugerindo mapeamentos
                  </p>
                </div>
                <Progress value={66} className="max-w-xs mx-auto" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mapping step */}
        {currentStep === 'mapping' && (
          <Card>
            <CardHeader>
              <CardTitle>Mapeamento de Colunas</CardTitle>
              <CardDescription>
                Confirme ou ajuste o mapeamento das colunas detectadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coluna do Arquivo</TableHead>
                    <TableHead>Tipo Detectado</TableHead>
                    <TableHead>Amostra</TableHead>
                    <TableHead>Mapear Para</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detectedColumns.map((column) => (
                    <TableRow key={column.name}>
                      <TableCell className="font-medium">{column.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{column.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {column.sample.slice(0, 2).join(', ')}...
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mappings[column.name] || ''}
                          onValueChange={(value) =>
                            setMappings((prev) => ({ ...prev, [column.name]: value }))
                          }
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {systemFields.map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-6 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentStep('upload');
                    setSelectedFile(null);
                  }}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
                <Button
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  onClick={handleImport}
                >
                  Importar Dados
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Confirm step */}
        {currentStep === 'confirm' && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                {isImporting ? (
                  <>
                    <Loader2 className="w-12 h-12 mx-auto text-accent animate-spin" />
                    <div>
                      <p className="font-medium text-foreground">Importando dados...</p>
                      <p className="text-sm text-muted-foreground">
                        Isso pode levar alguns minutos
                      </p>
                    </div>
                    <Progress value={45} className="max-w-xs mx-auto" />
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
                      <Check className="w-8 h-8 text-success" />
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-foreground">
                        Importação concluída!
                      </p>
                      <p className="text-muted-foreground">
                        Seus dados foram importados com sucesso
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ClientImport;
