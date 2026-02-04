import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    BarChart,
    Activity,
    Info,
    AlertCircle,
    Sparkles,
    Trash2,
    Database,
    RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DashboardWidget } from '@/lib/types';
import { useExternalData } from '@/hooks/useExternalData';

// Widget renderer that fetches data from external Supabase
const WidgetRenderer = ({
    widget,
    orgId,
    activeFilter,
    onFilter,
    onDelete
}: {
    widget: DashboardWidget;
    orgId: string;
    activeFilter: { column: string; value: string } | null;
    onFilter: (column: string, value: string) => void;
    onDelete: (id: string) => void;
}) => {
    const isFiltered = activeFilter && widget.title.toLowerCase().includes(activeFilter.column);

    // Get widget config for data source
    const config = widget.config as {
        dataSource?: string;
        metric?: string;
        aggregation?: string;
        columns?: string[];
    };

    // Fetch data from external Supabase if widget has dataSource configured
    const { data: externalData, isLoading: isLoadingExternal, error: externalError, refetch } = useExternalData(
        orgId,
        config.dataSource ? {
            tableName: config.dataSource,
            columns: config.columns,
            limit: 100,
        } : null
    );

    // Calculate metric value based on aggregation
    const calculateMetric = () => {
        if (!externalData?.data || externalData.data.length === 0) return null;

        const data = externalData.data;
        const metricField = config.metric;

        if (!metricField) {
            // Just count
            return { value: externalData.count || data.length, label: 'registros' };
        }

        const values = data
            .map((row) => {
                const val = row[metricField];
                return typeof val === 'number' ? val : parseFloat(String(val)) || 0;
            })
            .filter((v) => !isNaN(v));

        switch (config.aggregation) {
            case 'sum':
                return { value: values.reduce((a, b) => a + b, 0), label: metricField };
            case 'avg':
                return { value: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0, label: `avg ${metricField}` };
            case 'min':
                return { value: values.length > 0 ? Math.min(...values) : 0, label: `min ${metricField}` };
            case 'max':
                return { value: values.length > 0 ? Math.max(...values) : 0, label: `max ${metricField}` };
            case 'count':
            default:
                return { value: values.length, label: metricField };
        }
    };

    const metricResult = config.dataSource ? calculateMetric() : null;

    const formatValue = (value: number) => {
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
        return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    };

    return (
        <Card
            className={`h-full border-none shadow-xl overflow-hidden group transition-all hover:shadow-2xl cursor-pointer
                ${isFiltered ? 'ring-2 ring-accent bg-accent/5' : 'bg-card'}
            `}
            onClick={() => onFilter(widget.title.split(' ')[0].toLowerCase(), 'Sample Value')}
        >
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg transition-transform group-hover:scale-110 
                            ${isFiltered ? 'bg-accent text-accent-foreground' : 'bg-accent/10 text-accent'}
                        `}>
                            {widget.type === 'metric_card' || (widget.type as string) === 'metric' ? <Activity size={18} /> : <BarChart size={18} />}
                        </div>
                        <div>
                            <CardTitle className="text-sm font-bold tracking-tight">{widget.title}</CardTitle>
                            {config.dataSource && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Database size={10} />
                                    {config.dataSource}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        {config.dataSource && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    refetch();
                                }}
                            >
                                <RefreshCw size={14} />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(widget.id);
                            }}
                        >
                            <Trash2 size={14} />
                        </Button>
                        <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                    </div>
                </div>
                {widget.description && (
                    <CardDescription className="text-[11px] leading-tight mt-1">
                        {widget.description}
                    </CardDescription>
                )}
            </CardHeader>
            <CardContent className="h-[200px] flex items-center justify-center p-6 bg-muted/5">
                {/* Real data display based on external Supabase */}
                {config.dataSource ? (
                    isLoadingExternal ? (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <RefreshCw className="w-6 h-6 animate-spin" />
                            <span className="text-xs">Carregando dados...</span>
                        </div>
                    ) : externalError ? (
                        <div className="flex flex-col items-center gap-2 text-destructive text-center">
                            <AlertCircle className="w-6 h-6" />
                            <span className="text-xs max-w-[200px]">{String(externalError)}</span>
                        </div>
                    ) : metricResult ? (
                        <div className="flex flex-col items-center gap-4 text-center w-full">
                            {/* Metric Value Display */}
                            <div className="text-5xl font-black text-foreground tracking-tight">
                                {formatValue(metricResult.value)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {externalData?.count || 0} {metricResult.label}
                            </div>

                            {/* AI Insight */}
                            <div className="p-3 rounded-xl bg-gradient-to-br from-accent to-accent/80 text-accent-foreground text-[10px] font-medium leading-relaxed shadow-lg shadow-accent/20 flex items-center gap-2 transform group-hover:-translate-y-1 transition-transform">
                                <Sparkles size={12} className="fill-current shrink-0" />
                                <span>
                                    {activeFilter
                                        ? `Filtrando por ${activeFilter.column}. Mostrando ${externalData?.data?.length || 0} de ${externalData?.count || 0}.`
                                        : `Dados em tempo real de ${config.dataSource}`
                                    }
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Database className="w-6 h-6" />
                            <span className="text-xs">Sem dados disponíveis</span>
                        </div>
                    )
                ) : (
                    /* Fallback for widgets without external data source */
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="w-full h-24 rounded-lg bg-accent/5 flex items-center justify-center border border-dashed border-accent/20">
                            <span className="text-xs font-mono text-accent">{widget.type}</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-gradient-to-br from-accent to-accent/80 text-accent-foreground text-[11px] font-medium leading-relaxed shadow-xl shadow-accent/20 flex flex-col gap-2 transform group-hover:-translate-y-1 transition-transform">
                            <div className="flex items-center gap-2 border-b border-accent-foreground/20 pb-1">
                                <Sparkles size={12} className="fill-current" />
                                <span className="uppercase tracking-widest text-[9px] font-bold">Configure Data Source</span>
                            </div>
                            <p>
                                Este widget não está conectado a uma fonte de dados externa.
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

const DashboardEngine = ({ dashboardId }: { dashboardId: string }) => {
    const { orgId } = useParams();
    const [activeFilter, setActiveFilter] = React.useState<{ column: string; value: string } | null>(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const handleFilter = (column: string, value: string) => {
        if (activeFilter?.column === column) {
            setActiveFilter(null);
        } else {
            setActiveFilter({ column, value });
        }
    };

    const { data: widgets, isLoading } = useQuery({
        queryKey: ['dashboard-widgets', dashboardId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('dashboard_widgets')
                .select('*')
                .eq('dashboard_id', dashboardId)
                .eq('is_visible', true)
                .order('position', { ascending: true });

            if (error) throw error;
            return (data as any) as DashboardWidget[];
        },
        enabled: !!dashboardId,
    });

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase
                .from('dashboard_widgets')
                .delete()
                .eq('id', id);

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ['dashboard-widgets', dashboardId] });

            toast({
                title: "Widget Excluído",
                description: "O widget foi removido do seu painel.",
            });
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Erro ao excluir",
                description: error.message,
            });
        }
    };

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-[300px] w-full rounded-2xl" />
                ))}
            </div>
        );
    }

    if (!widgets || widgets.length === 0) {
        return (
            <Card className="p-12 border-dashed flex flex-col items-center justify-center text-center gap-4 bg-muted/20 rounded-3xl">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                    <h3 className="text-xl font-bold">Dashboard Vazio</h3>
                    <p className="text-muted-foreground max-w-xs mx-auto">
                        Ainda não há widgets configurados. A IA irá sugerir widgets assim que os dados forem integrados.
                    </p>
                </div>
            </Card>
        );
    }

    const getSizeSpan = (size: string | null) => {
        switch (size) {
            case 'small': return { col: 3, row: 1 };
            case 'medium': return { col: 4, row: 2 };
            case 'large': return { col: 6, row: 2 };
            case 'full': return { col: 12, row: 2 };
            default: return { col: 4, row: 2 };
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pb-20">
            {widgets.map((widget) => {
                const span = getSizeSpan((widget as any).size);
                return (
                    <div
                        key={widget.id}
                        className="col-span-1"
                        style={{
                            gridColumn: `span ${(widget as any).width || (widget.config as any)?.width || span.col}`,
                            gridRow: `span ${(widget as any).height || (widget.config as any)?.height || span.row}`
                        }}
                    >
                        <WidgetRenderer
                            widget={widget}
                            orgId={orgId || ''}
                            activeFilter={activeFilter}
                            onFilter={handleFilter}
                            onDelete={handleDelete}
                        />
                    </div>
                );
            })}
        </div>
    );
};

export default DashboardEngine;
