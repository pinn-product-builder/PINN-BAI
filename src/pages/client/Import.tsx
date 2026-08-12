import { useState, useCallback, useMemo } from 'react';
import { Link, useNavigate, useParams, Outlet, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateIntegration } from '@/hooks/useIntegrations';
import type { IntegrationType } from '@/lib/types';
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
import { useOrganizationBranding } from '@/contexts/OrganizationBrandingContext';
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
  const { organization } = useOrganizationBranding();
  const { profile, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const providerSlug = searchParams.get('provider') as IntegrationType | null;
  const createIntegration = useCreateIntegration();
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [connectionName, setConnectionName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  type FieldDef = {
    key: string;
    label: string;
    type?: string;
    placeholder?: string;
    validate?: (v: string) => string | null;
  };

  const validators = useMemo(() => ({
    url: (v: string) => {
      if (!v.trim()) return 'Campo obrigatório.';
      try {
        const u = new URL(v.trim());
        if (!u.protocol.startsWith('http')) return 'Use http(s)://';
        return null;
      } catch { return 'URL inválida.'; }
    },
    minLen: (n: number) => (v: string) =>
      !v.trim() ? 'Campo obrigatório.' : v.trim().length < n ? `Mínimo ${n} caracteres.` : null,
    required: (v: string) => (!v.trim() ? 'Campo obrigatório.' : null),
  }), []);

  const PROVIDER_FORMS: Record<IntegrationType, { name: string; logo: string; fields: FieldDef[] }> = useMemo(() => ({
    supabase: {
      name: 'Supabase', logo: '⚡',
      fields: [
        { key: 'url', label: 'Project URL', placeholder: 'https://xxx.supabase.co', validate: validators.url },
        { key: 'anon_key', label: 'Anon Public Key', type: 'password', validate: validators.minLen(20) },
      ],
    },
    google_sheets: {
      name: 'Google Sheets', logo: '🟩',
      fields: [
        { key: 'spreadsheet_id', label: 'ID da Planilha', placeholder: 'Cole o ID entre /d/ e /edit', validate: validators.minLen(10) },
        { key: 'sheet_name', label: 'Nome da Aba', placeholder: 'Sheet1', validate: validators.required },
      ],
    },
    csv: {
      name: 'Upload CSV', logo: '📄',
      fields: [{ key: 'file_name', label: 'Nome do arquivo', placeholder: 'leads.csv', validate: validators.required }],
    },
    api: {
      name: 'API REST', logo: '🔌',
      fields: [
        { key: 'base_url', label: 'URL Base', placeholder: 'https://api.exemplo.com', validate: validators.url },
        { key: 'api_key', label: 'API Key / Token', type: 'password', validate: validators.minLen(8) },
      ],
    },
    ploomes: {
      name: 'Ploomes CRM', logo: '🟦',
      fields: [{ key: 'user_key', label: 'User-Key', type: 'password', placeholder: 'Sua chave do Ploomes', validate: validators.minLen(16) }],
    },
    coldmail: {
      name: 'Cold Mail Hackers', logo: '✉️',
      fields: [{ key: 'api_key', label: 'API Key (CMH)', type: 'password', validate: validators.minLen(8) }],
    },
    smartlead: {
      name: 'Smartlead', logo: '📧',
      fields: [{ key: 'api_key', label: 'API Key (Smartlead)', type: 'password', validate: validators.minLen(8) }],
    },
  }), [validators]);

  const providerForm = providerSlug ? PROVIDER_FORMS[providerSlug] : null;

  const fieldErrors = useMemo(() => {
    if (!providerForm) return {} as Record<string, string | null>;
    return Object.fromEntries(
      providerForm.fields.map((f) => [f.key, f.validate ? f.validate(creds[f.key] ?? '') : null]),
    );
  }, [providerForm, creds]);

  const hasErrors = Object.values(fieldErrors).some(Boolean);

  const handleProviderConnect = async () => {
    if (!orgId || !providerSlug || !providerForm) return;
    if (hasErrors) {
      toast({ variant: 'destructive', title: 'Corrija os campos destacados antes de conectar.' });
      return;
    }
    setIsConnecting(true);
    try {
      await createIntegration.mutateAsync({
        org_id: orgId,
        name: connectionName.trim() || providerForm.name,
        type: providerSlug,
        config: creds as never,
      });
      toast({ title: 'Integração conectada com sucesso!' });
      navigate(`/client/${orgId}/integrations`);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Falha ao conectar',
        description: err instanceof Error ? err.message : 'Verifique as credenciais.',
      });
    } finally {
      setIsConnecting(false);
    }
  };


  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [detectedColumns, setDetectedColumns] = useState<DetectedColumn[]>([]);

  // CSV pre-validation state
  const EXPECTED_COLUMNS = ['nome', 'email', 'telefone', 'empresa', 'origem', 'status', 'valor'];
  type CsvPreview = {
    headers: string[];
    rows: string[][];
    rowCount: number;
    types: Record<string, 'number' | 'date' | 'email' | 'string'>;
    missingExpected: string[];
    matchedExpected: string[];
    issues: string[];
  };
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [csvValidating, setCsvValidating] = useState(false);

  function detectType(values: string[]): 'number' | 'date' | 'email' | 'string' {
    const clean = values.filter((v) => v && v.trim() !== '');
    if (clean.length === 0) return 'string';
    const isNum = clean.every((v) => !isNaN(Number(v.replace(',', '.'))));
    if (isNum) return 'number';
    const isEmail = clean.every((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
    if (isEmail) return 'email';
    const isDate = clean.every((v) => !isNaN(Date.parse(v)));
    if (isDate) return 'date';
    return 'string';
  }

  function parseCsvLine(line: string, delim: string): string[] {
    const out: string[] = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === delim && !inQuotes) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  }

  async function parseCsvFile(file: File): Promise<{ headers: string[]; rows: string[][]; delim: string }> {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
    if (!lines.length) return { headers: [], rows: [], delim: ',' };
    const delim = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
    const headers = parseCsvLine(lines[0], delim);
    const rows = lines.slice(1).map((l) => parseCsvLine(l, delim));
    return { headers, rows, delim };
  }

  function rowsToObjects(headers: string[], rows: string[][]): Record<string, string>[] {
    return rows.map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])));
  }

  // Heurística: tenta combinar header com um campo do sistema (lead.*)
  function autoSuggestMapping(header: string): string {
    const h = header.toLowerCase().trim();
    if (/(^|\W)(nome|name|nome_completo|fullname|full_name)(\W|$)/.test(h)) return 'lead.name';
    if (/(^|\W)(email|e-mail|correio)(\W|$)/.test(h)) return 'lead.email';
    if (/(^|\W)(telefone|phone|celular|whatsapp|mobile|tel|fone)(\W|$)/.test(h)) return 'lead.phone';
    if (/(^|\W)(empresa|company|organizacao|organization|cliente)(\W|$)/.test(h)) return 'lead.company';
    if (/(^|\W)(origem|source|canal|channel|midia)(\W|$)/.test(h)) return 'lead.source';
    if (/(^|\W)(status|etapa|stage|fase|situacao)(\W|$)/.test(h)) return 'lead.status';
    if (/(^|\W)(valor|value|preco|price|deal|ticket|receita)(\W|$)/.test(h)) return 'lead.value';
    if (/(^|\W)(data|date|created_at|criado|cadastro|criacao)(\W|$)/.test(h)) return 'lead.created_at';
    return 'ignore';
  }

  // Mapeia source livre pro enum lead_source. Fallback: 'organic'.
  function normalizeLeadSource(raw: string): string {
    const v = raw.toLowerCase().trim();
    if (/google|ads/.test(v)) return 'google_ads';
    if (/linkedin/.test(v)) return 'linkedin';
    if (/referral|indica/.test(v)) return 'referral';
    if (/email|e-mail|coldmail/.test(v)) return 'email';
    if (/organic|sit[eo]|seo/.test(v)) return 'organic';
    return 'organic';
  }

  // Mapeia status livre pro enum lead_status. Fallback: 'new'.
  function normalizeLeadStatus(raw: string): string {
    const v = raw.toLowerCase().trim();
    if (/qualifi/.test(v)) return 'qualified';
    if (/analis|analy/.test(v)) return 'in_analysis';
    if (/propost|proposal/.test(v)) return 'proposal';
    if (/convert|ganh|won|fechad/.test(v)) return 'converted';
    return 'new';
  }

  async function validateCsv(file: File) {
    setCsvValidating(true);
    setCsvPreview(null);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
      if (lines.length === 0) {
        setCsvPreview({
          headers: [], rows: [], rowCount: 0, types: {},
          missingExpected: EXPECTED_COLUMNS, matchedExpected: [],
          issues: ['Arquivo vazio.'],
        });
        return;
      }
      const delim = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
      const headers = parseCsvLine(lines[0], delim);
      const dataLines = lines.slice(1);
      const sample = dataLines.slice(0, 20).map((l) => parseCsvLine(l, delim));

      const types: Record<string, 'number' | 'date' | 'email' | 'string'> = {};
      headers.forEach((h, i) => {
        types[h] = detectType(sample.map((r) => r[i] ?? ''));
      });

      const lower = headers.map((h) => h.toLowerCase());
      const matchedExpected = EXPECTED_COLUMNS.filter((e) => lower.some((h) => h.includes(e)));
      const missingExpected = EXPECTED_COLUMNS.filter((e) => !matchedExpected.includes(e));

      const issues: string[] = [];
      if (headers.length < 2) issues.push('Apenas uma coluna detectada — verifique o delimitador.');
      if (new Set(headers).size !== headers.length) issues.push('Existem cabeçalhos duplicados.');
      if (headers.some((h) => !h)) issues.push('Há cabeçalhos vazios.');
      if (dataLines.length === 0) issues.push('Nenhuma linha de dados encontrada.');
      const inconsistent = sample.filter((r) => r.length !== headers.length).length;
      if (inconsistent > 0) issues.push(`${inconsistent} linha(s) com número de colunas inconsistente.`);

      setCsvPreview({
        headers, rows: sample, rowCount: dataLines.length,
        types, missingExpected, matchedExpected, issues,
      });
    } catch (e) {
      setCsvPreview({
        headers: [], rows: [], rowCount: 0, types: {},
        missingExpected: [], matchedExpected: [],
        issues: [e instanceof Error ? e.message : 'Falha ao ler arquivo.'],
      });
    } finally {
      setCsvValidating(false);
    }
  }

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
      if (file.name.endsWith('.csv')) validateCsv(file);
      else setCsvPreview(null);
    } else {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, selecione um arquivo .xlsx, .xls ou .csv',
        variant: 'destructive',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.name.endsWith('.csv')) validateCsv(file);
      else setCsvPreview(null);
    }
  };

  const handleAnalyze = async () => {
    setCurrentStep('analyze');
    setIsAnalyzing(true);

    try {
      if (!selectedFile) throw new Error('Nenhum arquivo selecionado.');
      if (!selectedFile.name.endsWith('.csv')) {
        throw new Error('Apenas .csv suportado por enquanto. Para Excel, exporte como CSV.');
      }

      // csvPreview já tem o sample (20 linhas) calculado em validateCsv — usar isso pra perfilar.
      if (!csvPreview || csvPreview.headers.length === 0) {
        throw new Error('Pré-visualização do CSV indisponível. Recarregue o arquivo.');
      }

      const sampleObjects = rowsToObjects(csvPreview.headers, csvPreview.rows);
      const profiled = DataProfiler.profile(sampleObjects);

      const cols: DetectedColumn[] = profiled.map((p) => ({
        name: p.name,
        type: p.type as any,
        sample: sampleObjects.slice(0, 3).map((o) => String(o[p.name] ?? '')).filter(Boolean),
        suggestedMapping: autoSuggestMapping(p.name),
      }));

      setDetectedColumns(cols);
      // Pré-popular mapeamento com as sugestões automáticas (usuário pode editar).
      setMappings(Object.fromEntries(cols.map((c) => [c.name, c.suggestedMapping ?? 'ignore'])));
      setCurrentStep('mapping');
    } catch (err) {
      toast({
        title: 'Erro ao analisar arquivo',
        description: err instanceof Error ? err.message : 'Erro desconhecido.',
        variant: 'destructive',
      });
      setCurrentStep('upload');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (!orgId || !selectedFile) return;

    setCurrentStep('confirm');
    setIsImporting(true);

    try {
      // 1. Re-ler o arquivo inteiro (csvPreview tem só sample).
      const { headers, rows } = await parseCsvFile(selectedFile);
      if (!headers.length) throw new Error('Arquivo vazio.');

      const allObjects = rowsToObjects(headers, rows);

      // 2. Construir leads a partir do mapeamento.
      type LeadInsert = {
        org_id: string;
        integration_id?: string | null;
        name: string;
        email?: string | null;
        phone?: string | null;
        company?: string | null;
        source: string;
        status: string;
        value: number;
        metadata: Record<string, string>;
      };

      const reverseMap: Record<string, string> = {};
      for (const [csvCol, leadField] of Object.entries(mappings)) {
        if (leadField && leadField !== 'ignore' && leadField !== 'custom') {
          reverseMap[leadField] = csvCol;
        }
      }

      const leadsToInsert: LeadInsert[] = allObjects.map((obj) => {
        const name = reverseMap['lead.name'] ? obj[reverseMap['lead.name']] : '';
        const email = reverseMap['lead.email'] ? obj[reverseMap['lead.email']] : '';
        const phone = reverseMap['lead.phone'] ? obj[reverseMap['lead.phone']] : '';
        const company = reverseMap['lead.company'] ? obj[reverseMap['lead.company']] : '';
        const sourceRaw = reverseMap['lead.source'] ? obj[reverseMap['lead.source']] : '';
        const statusRaw = reverseMap['lead.status'] ? obj[reverseMap['lead.status']] : '';
        const valueRaw = reverseMap['lead.value'] ? obj[reverseMap['lead.value']] : '';

        // Coletar colunas não mapeadas em metadata pra não perder info.
        const metadata: Record<string, string> = {};
        for (const h of headers) {
          const map = mappings[h];
          if (!map || map === 'ignore') continue;
          if (map === 'custom') metadata[h] = obj[h];
        }

        return {
          org_id: orgId,
          name: (name || email || 'Sem nome').trim(),
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          company: company?.trim() || null,
          source: sourceRaw ? normalizeLeadSource(sourceRaw) : 'organic',
          status: statusRaw ? normalizeLeadStatus(statusRaw) : 'new',
          value: valueRaw ? (parseFloat(valueRaw.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0) : 0,
          metadata,
        };
      }).filter((l) => l.name || l.email || l.phone);

      // 3. Criar registro de integration (type=csv) com mapeamento salvo em config.
      const integration = await createIntegration.mutateAsync({
        org_id: orgId,
        name: connectionName.trim() || selectedFile.name,
        type: 'csv',
        config: {
          file_name: selectedFile.name,
          column_count: headers.length,
          row_count: allObjects.length,
          imported_count: leadsToInsert.length,
          mappings,
          columns: headers,
        } as never,
      });

      // 4. Inserir leads em batches de 500.
      if (leadsToInsert.length > 0) {
        const withIntegration = leadsToInsert.map((l) => ({ ...l, integration_id: integration.id }));
        for (let i = 0; i < withIntegration.length; i += 500) {
          const batch = withIntegration.slice(i, i + 500);
          const { error: leadsError } = await supabase.from('leads').insert(batch as any);
          if (leadsError) throw new Error(`Erro ao inserir leads (lote ${i / 500 + 1}): ${leadsError.message}`);
        }
      }

      // 5. Criar dashboard automaticamente a partir das colunas reais perfiladas.
      const profiled = DataProfiler.profile(allObjects.slice(0, 100));
      const recommendations = DataProfiler.recommendWidgets(profiled, String(organization?.plan || 1));

      const { data: dashboard, error: dashError } = await supabase
        .from('dashboards')
        .insert({
          org_id: orgId,
          name: `Dashboard - ${selectedFile.name.replace(/\.[^.]+$/, '')}`,
          is_default: false,
          layout: {} as Json,
        })
        .select()
        .single();

      if (dashError) throw dashError;

      if (recommendations.length > 0) {
        const widgetsToInsert = recommendations.map((rec, idx) => ({
          dashboard_id: dashboard.id,
          type: rec.type,
          title: rec.title,
          description: rec.description,
          config: { ...rec.config, dataSource: 'leads' } as any,
          width: rec.width,
          height: rec.height,
          position_x: (idx % 3) * 4,
          position_y: Math.floor(idx / 3) * 2,
          is_visible: true,
        }));

        const { error: widgetError } = await supabase
          .from('dashboard_widgets')
          .insert(widgetsToInsert as any);

        if (widgetError) throw widgetError;
      }

      toast({
        title: 'Importação concluída!',
        description: `${leadsToInsert.length} leads importados de ${allObjects.length} linhas. Dashboard criado.`,
      });

      navigate(`/client/${orgId}/dashboard`);
    } catch (error: unknown) {
      toast({
        title: 'Erro na importação',
        description: error instanceof Error ? error.message : 'Erro desconhecido.',
        variant: 'destructive',
      });
      setCurrentStep('mapping');
    } finally {
      setIsImporting(false);
    }
  };

  if (providerForm) {
    return (
      <div className="p-6 space-y-6 pb-24 max-w-7xl mx-auto">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate(`/client/${orgId}/integrations`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar à Central de Integrações
        </Button>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <span>{providerForm.logo}</span>
              Conectar {providerForm.name}
            </CardTitle>
            <CardDescription>
              Informe as credenciais para autorizar o Pinn a sincronizar seus dados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome da conexão</Label>
              <Input
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder={`Ex.: ${providerForm.name} — Conta Principal`}
              />
            </div>

            {providerForm.fields.map((field) => {
              const value = creds[field.key] ?? '';
              const err = value.length > 0 ? fieldErrors[field.key] : null;
              return (
                <div key={field.key} className="space-y-1.5">
                  <Label>
                    {field.label} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type={field.type === 'password' ? 'password' : 'text'}
                    placeholder={field.placeholder}
                    value={value}
                    aria-invalid={!!err}
                    className={err ? 'border-destructive focus-visible:ring-destructive' : ''}
                    onChange={(e) => setCreds((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                  {err && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />{err}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => navigate(`/client/${orgId}/integrations`)}
              >
                Cancelar
              </Button>
              <Button onClick={handleProviderConnect} disabled={isConnecting || hasErrors}>
                {isConnecting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Conectar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 pb-24 max-w-7xl mx-auto">
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
        <div className="flex items-center justify-between max-w-2xl mx-auto">
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
                        ? 'bg-primary text-primary-foreground'
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
      <div className="max-w-4xl mx-auto">
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
                  ? 'border-primary bg-primary/5'
                  : selectedFile
                    ? 'border-success bg-success/5'
                    : 'border-muted-foreground/25 hover:border-primary'
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
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Button variant="outline" asChild>
                        <span>Selecionar arquivo</span>
                      </Button>
                    </label>
                  </div>
                )}
              </div>

              {selectedFile && selectedFile.name.endsWith('.csv') && (
                <div className="mt-6 space-y-3">
                  {csvValidating && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Validando CSV (cabeçalhos, tipos e amostra)...
                    </div>
                  )}
                  {csvPreview && (
                    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                        <span><strong>{csvPreview.rowCount}</strong> linhas</span>
                        <span><strong>{csvPreview.headers.length}</strong> colunas</span>
                        <span className="text-emerald-600">
                          {csvPreview.matchedExpected.length}/{EXPECTED_COLUMNS.length} colunas esperadas detectadas
                        </span>
                      </div>

                      {csvPreview.issues.length > 0 && (
                        <div className="text-xs space-y-1 text-destructive">
                          {csvPreview.issues.map((i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5" />{i}
                            </div>
                          ))}
                        </div>
                      )}

                      {csvPreview.missingExpected.length > 0 && (
                        <div className="text-xs text-amber-600">
                          Colunas esperadas ausentes (opcional): {csvPreview.missingExpected.join(', ')}
                        </div>
                      )}

                      {csvPreview.headers.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="text-xs w-full border-collapse">
                            <thead>
                              <tr className="border-b">
                                {csvPreview.headers.map((h) => (
                                  <th key={h} className="text-left p-1.5 font-semibold">
                                    <div>{h || <em className="text-destructive">vazio</em>}</div>
                                    <div className="text-[10px] text-muted-foreground font-normal">
                                      {csvPreview.types[h] ?? 'string'}
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {csvPreview.rows.slice(0, 5).map((row, ri) => (
                                <tr key={ri} className="border-b border-border/30">
                                  {csvPreview.headers.map((_, ci) => (
                                    <td key={ci} className="p-1.5 text-muted-foreground truncate max-w-[180px]">
                                      {row[ci] ?? ''}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={handleAnalyze}
                      disabled={csvValidating || (csvPreview?.issues.length ?? 0) > 0}
                    >
                      Continuar
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {selectedFile && !selectedFile.name.endsWith('.csv') && (
                <div className="mt-6 flex justify-end">
                  <Button
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
                <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
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
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
                    <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
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
