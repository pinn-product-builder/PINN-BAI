import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Loader2, Database, AlertTriangle, List, Triangle } from 'lucide-react';
import { useTheme } from '@mui/material/styles';
import { getChartSeriesColors } from '@/theme/chartColors';
import { cn } from '@/lib/utils';
import { formatStageName } from '@/lib/stageNames';

// Conversão calculada com amostra pequena (< N leads no estágio anterior) não
// vira número apresentável — vira "—" com tooltip explicando. Evita o caso da
// Kitou em que o funil "disparos" tem 1-2 leads e exibia 100% como se fosse
// performance, criando dado mentiroso na tela.
const MIN_SAMPLE_SIZE = 5;
// Cap superior: conversões >= 95% sem volume suficiente são consideradas
// suspeitas e ganham marca visual de aviso.
const SUSPICIOUS_HIGH_THRESHOLD = 95;
const SUSPICIOUS_HIGH_MIN_VOLUME = 20;

interface FunnelStageDatum {
  stage: string;
  value: number;
  color?: string;
}

interface FunnelPipelineOption {
  /** Identificador do funil (ex: pipeline_id do Kommo). */
  id: string;
  /** Nome amigável exibido no dropdown (ex: "Disparos", "Tráfego Pago"). */
  label: string;
  /** Etapas desse funil específico, em ordem. */
  data: FunnelStageDatum[];
}

interface FunnelWidgetProps {
  title: string;
  description: string;
  /** Dados do funil único (compat com chamadas antigas). Ignorado se `pipelines` for fornecido. */
  data?: FunnelStageDatum[];
  /**
   * Lista de funis disponíveis. Quando passada, o widget mostra dropdown e usa
   * o funil selecionado como fonte. Sem isso, comporta-se como funil único.
   * Caso Kitou: dois funis cadastrados no Kommo (disparos / tráfego pago).
   */
  pipelines?: FunnelPipelineOption[];
  /** Mostra etapas com 0 leads (funil mapeado do CRM = snapshot exato, igual ao Kommo). */
  showEmptyStages?: boolean;
  isLoading?: boolean;
}

// Mapeamento técnico → PT-BR e fallback amigável vivem em lib/stageNames.ts.
const prettifyStage = (raw: string): string => formatStageName(raw);

const FunnelWidget = ({
  title,
  description,
  data = [],
  pipelines,
  showEmptyStages = false,
  isLoading = false,
}: FunnelWidgetProps) => {
  const theme = useTheme();
  const funnelColors = getChartSeriesColors(theme);

  // Pipeline ativo: se há múltiplos, começa no primeiro.
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(
    pipelines && pipelines.length > 0 ? pipelines[0].id : null
  );
  const activePipeline = pipelines?.find((p) => p.id === selectedPipelineId) ?? null;
  const effectiveData: FunnelStageDatum[] = activePipeline ? activePipeline.data : data;

  // Prettify stage names. Funil mapeado do CRM mostra todas as etapas (snapshot
  // exato = igual ao Kommo); os demais filtram etapas zeradas.
  const cleanData = effectiveData
    .filter(d => showEmptyStages || d.value > 0)
    .map(d => ({ ...d, stage: prettifyStage(d.stage) }));
  const hasRealData = cleanData.length > 0;
  // Distinção importante: "sem dados" pode ser (a) widget não configurado/erro
  // (effectiveData vazio) ou (b) o filtro temporal zerou tudo (effectiveData
  // tem etapas mas todas value=0). Para o caso (b), mostramos mensagem
  // explicando — evita o user achar que o sistema quebrou.
  const filteredToZero = !hasRealData && effectiveData.length > 0
    && effectiveData.every(d => (d.value ?? 0) === 0);
  const maxValue = hasRealData ? Math.max(...cleanData.map((d) => d.value)) : 0;
  const firstValue = hasRealData ? cleanData[0].value : 0;
  const lastValue = hasRealData ? cleanData[cleanData.length - 1].value : 0;
  const totalConversionRaw = firstValue > 0 ? (lastValue / firstValue) * 100 : null;
  const totalConversionLowSample = firstValue > 0 && firstValue < MIN_SAMPLE_SIZE;
  const totalConversionSuspicious =
    totalConversionRaw !== null
    && totalConversionRaw >= SUSPICIOUS_HIGH_THRESHOLD
    && firstValue < SUSPICIOUS_HIGH_MIN_VOLUME;
  const totalConversionLabel = totalConversionRaw === null
    ? '—'
    : totalConversionLowSample
      ? '—'
      : `${totalConversionRaw.toFixed(1)}%`;

  // F12 — toggle entre lista (barras horizontais) e funil clássico (triângulo
  // invertido). Persistido só em estado local — quem quer alterar o default
  // ajusta no widget config via WidgetEditorDialog.
  const [viewMode, setViewMode] = useState<'list' | 'funnel'>('list');

  if (isLoading) {
    return (
      <Card className="rounded-xl h-full flex items-center justify-center min-h-[350px] bg-card/80 backdrop-blur-sm border-border/50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Carregando...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('rounded-xl bg-card/80 backdrop-blur-sm border-border/50', !hasRealData && 'opacity-60')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">{description}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {hasRealData && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Funil atual por etapas
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {pipelines && pipelines.length > 1 && (
              <select
                value={selectedPipelineId ?? ''}
                onChange={(e) => setSelectedPipelineId(e.target.value)}
                className="text-[11px] font-medium border border-border/50 bg-background rounded-md px-2 py-1 outline-none focus:border-primary"
                title="Selecionar funil"
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            )}
            {hasRealData && cleanData.length > 1 && (
              <div className="inline-flex rounded-md border border-border/50 bg-background overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors',
                    viewMode === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                  title="Visualizar como lista de barras"
                >
                  <List className="w-3 h-3" /> Lista
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('funnel')}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors border-l border-border/50',
                    viewMode === 'funnel' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                  title="Visualizar como funil clássico (triângulo invertido)"
                >
                  <Triangle className="w-3 h-3 rotate-180" /> Funil
                </button>
              </div>
            )}
            {!hasRealData && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                Sem dados
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasRealData ? (
          <div className="h-[250px] flex items-center justify-center">
            <div className="text-center text-muted-foreground px-4">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
              {filteredToZero ? (
                <>
                  <p className="text-sm font-medium">Nenhuma atividade no período selecionado</p>
                  <p className="text-xs mt-1 max-w-xs mx-auto text-muted-foreground/80">
                    O funil existe mas não teve movimentação no recorte atual. Tente abrir o filtro para "Mês atual" ou "Personalizado" com janela maior.
                  </p>
                </>
              ) : (
                <p className="text-sm">Sem dados disponíveis</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {cleanData.length === 1 && (
              <div className="text-center py-4 space-y-3">
                <p className="text-3xl font-bold text-foreground tabular-nums">{cleanData[0].value.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-muted-foreground">{cleanData[0].stage}</p>
                <div className="w-full h-3 rounded-full bg-muted/40 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: funnelColors[0] }} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Configure uma view de funil com múltiplos estágios para ver a conversão
                </p>
              </div>
            )}
            {cleanData.length > 1 && viewMode === 'funnel' && (
              <div className="flex flex-col items-center gap-0 py-3 px-2">
                {cleanData.map((item, index) => {
                  const prevValueF = index > 0 ? cleanData[index - 1].value : item.value;
                  const sampleOk = index === 0 || prevValueF >= MIN_SAMPLE_SIZE;
                  const dropPct = index === 0 || prevValueF <= 0
                    ? null
                    : sampleOk
                      ? (1 - item.value / prevValueF) * 100
                      : null;
                  // Largura proporcional ao próprio valor (não ao máximo) — dá
                  // a sensação clássica do triângulo invertido com afunilamento
                  // gradual. Largura mínima 22% pra label não ficar ilegível.
                  const widthPct = firstValue > 0 ? (item.value / firstValue) * 100 : 0;
                  const color = item.color || funnelColors[index % funnelColors.length];
                  return (
                    <div key={item.stage} className="w-full flex flex-col items-center" style={{ animationDelay: `${index * 80}ms` }}>
                      {index > 0 && dropPct !== null && dropPct > 0 && (
                        <div
                          className={cn(
                            'text-[10px] tabular-nums my-1 px-2 py-0.5 rounded-full',
                            dropPct >= 50 ? 'text-red-600 bg-red-500/10' : dropPct >= 25 ? 'text-amber-600 bg-amber-500/10' : 'text-muted-foreground bg-muted/40',
                          )}
                        >
                          ↓ {dropPct.toFixed(0)}% entre etapas
                        </div>
                      )}
                      <div
                        className="relative h-14 flex items-center justify-between gap-3 px-5 transition-all duration-700 shadow-sm"
                        style={{
                          width: `${Math.max(widthPct, 22)}%`,
                          background: `linear-gradient(135deg, ${color}f5, ${color}c8)`,
                          clipPath: 'polygon(6% 0%, 94% 0%, 88% 100%, 12% 100%)',
                          minWidth: 220,
                        }}
                      >
                        <span className="text-[12px] font-semibold text-white truncate drop-shadow" title={item.stage}>
                          {item.stage}
                        </span>
                        <div className="flex flex-col items-end">
                          <span className="text-base font-extrabold text-white tabular-nums drop-shadow">
                            {item.value.toLocaleString('pt-BR')}
                          </span>
                          {firstValue > 0 && (
                            <span className="text-[10px] text-white/80 tabular-nums">
                              {((item.value / firstValue) * 100).toFixed(1)}% do topo
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {cleanData.length > 1 && viewMode === 'list' && cleanData.map((item, index) => {
              const widthPercent = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
              const prevValue = index > 0 ? cleanData[index - 1].value : item.value;
              // Conversão por estágio com guarda anti-100%-falso. Sem amostra
              // suficiente no estágio anterior, mostra "—" em vez de número.
              const conversionLowSample = index > 0 && prevValue < MIN_SAMPLE_SIZE;
              const conversionRateNum = index === 0 || prevValue <= 0
                ? null
                : (item.value / prevValue) * 100;
              const conversionSuspicious =
                conversionRateNum !== null
                && conversionRateNum >= SUSPICIOUS_HIGH_THRESHOLD
                && prevValue < SUSPICIOUS_HIGH_MIN_VOLUME;
              const conversionRateLabel = conversionRateNum === null
                ? null
                : conversionLowSample
                  ? '—'
                  : `${conversionRateNum.toFixed(0)}%`;
              const color = item.color || funnelColors[index % funnelColors.length];

              return (
                <div
                  key={item.stage}
                  className="group"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  {/* Stage row: label — bar — count */}
                  <div className="flex items-center gap-3">
                    {/* Stage name */}
                    <div className="w-28 shrink-0">
                      <span className="text-xs font-semibold text-foreground truncate block" title={item.stage}>
                        {item.stage}
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{item.value.toLocaleString('pt-BR')}</span>
                    </div>

                    {/* Bar */}
                    <div className="flex-1 relative h-7 rounded-md overflow-hidden bg-muted/30">
                      <div
                        className={cn(
                          'h-full rounded-md transition-all duration-700 ease-out relative',
                          'before:absolute before:inset-0 before:bg-gradient-to-r before:from-white/0 before:via-white/5 before:to-white/0',
                        )}
                        style={{
                          width: `${Math.max(widthPercent, 4)}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>

                    {/* Value + conversion */}
                    <div className="w-16 shrink-0 text-right">
                      <span className="text-sm font-bold text-foreground tabular-nums">
                        {item.value.toLocaleString('pt-BR')}
                      </span>
                      {index > 0 && conversionRateLabel !== null && (
                        <span className={cn(
                          'block text-[10px] tabular-nums inline-flex items-center gap-0.5 justify-end',
                          conversionSuspicious ? 'text-amber-600' : 'text-muted-foreground',
                        )}>
                          {conversionSuspicious && (
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="w-2.5 h-2.5" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">
                                  Conversão alta com baixo volume ({prevValue} {prevValue === 1 ? 'lead' : 'leads'} no estágio anterior). Pode ser ruído da amostra, não performance real.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {conversionLowSample ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <span className="cursor-help">—</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">
                                  Amostra pequena: {prevValue} {prevValue === 1 ? 'lead' : 'leads'} no estágio anterior. Conversão não calculada (mínimo de {MIN_SAMPLE_SIZE}).
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            conversionRateLabel
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Conversion summary */}
            {cleanData.length > 1 && (
              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground font-medium">Conversão Total</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3 h-3 text-muted-foreground/40 hover:text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs whitespace-pre-line">
                        Percentual de oportunidades que percorrem o funil inteiro.{"\n\n"}
                        Como é calculado: leads na última etapa ÷ leads na primeira etapa × 100.{"\n\n"}
                        Conversões com amostra menor que {MIN_SAMPLE_SIZE} leads são suprimidas (mostram &quot;—&quot;) para evitar ruído de baixo volume.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className={cn(
                  'text-base font-bold tabular-nums inline-flex items-center gap-1',
                  totalConversionSuspicious ? 'text-amber-600' : 'text-foreground',
                )}>
                  {totalConversionSuspicious && (
                    <Tooltip>
                      <TooltipTrigger>
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs">
                          Valor suspeito: {totalConversionRaw?.toFixed(1)}% com só {firstValue} {firstValue === 1 ? 'lead' : 'leads'} no topo do funil. Provavelmente ruído da amostra.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {totalConversionLowSample ? (
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="cursor-help">—</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs">
                          Apenas {firstValue} {firstValue === 1 ? 'lead' : 'leads'} no topo do funil. Conversão não calculada (mínimo de {MIN_SAMPLE_SIZE}).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    totalConversionLabel
                  )}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FunnelWidget;
