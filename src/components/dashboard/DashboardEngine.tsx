import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    BarChart,
    LineChart,
    PieChart,
    Activity,
    Info,
    TrendingUp,
    AlertCircle,
    Sparkles
} from 'lucide-react';
import { DashboardWidget } from '@/lib/types';

// Mocked dynamically for now, but will use actual widget components
const WidgetRenderer = ({
    widget,
    activeFilter,
    onFilter
}: {
    widget: DashboardWidget;
    activeFilter: { column: string; value: string } | null;
    onFilter: (column: string, value: string) => void;
}) => {
    const isFiltered = activeFilter && widget.title.toLowerCase().includes(activeFilter.column);

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
                        <CardTitle className="text-sm font-bold tracking-tight">{widget.title}</CardTitle>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">
                            {activeFilter ? 'Filtrar' : 'Click to Filter'}
                        </span>
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
                {/* Real Dynamic Rendering will happen here based on widget.type */}
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-full h-24 rounded-lg bg-accent/5 flex items-center justify-center border border-dashed border-accent/20">
                        <span className="text-xs font-mono text-accent">Render Engine: {widget.type}</span>
                    </div>

                    {/* Insight Explanation (AI Narrative) */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-accent to-accent/80 text-accent-foreground text-[11px] font-medium leading-relaxed shadow-xl shadow-accent/20 flex flex-col gap-2 transform group-hover:-translate-y-1 transition-transform">
                        <div className="flex items-center gap-2 border-b border-accent-foreground/20 pb-1">
                            <Sparkles size={12} className="fill-current" />
                            <span className="uppercase tracking-widest text-[9px] font-bold">IA Narrativa</span>
                        </div>
                        <p>
                            {activeFilter
                                ? `Filtrando por ${activeFilter.column}: ${activeFilter.value}. Tendência ajustada.`
                                : "A inteligência detectou uma variação positiva. Este comportamento sugere alta eficiência nas conversões deste mês."
                            }
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const DashboardEngine = ({ dashboardId }: { dashboardId: string }) => {
    const { organization } = useTheme();
    const [activeFilter, setActiveFilter] = React.useState<{ column: string; value: string } | null>(null);

    const handleFilter = (column: string, value: string) => {
        if (activeFilter?.column === column) {
            setActiveFilter(null); // Toggle off
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
                .order('position_y', { ascending: true })
                .order('position_x', { ascending: true });

            if (error) throw error;
            return (data as any) as DashboardWidget[];
        },
        enabled: !!dashboardId,
    });

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

    // Helper to calculate grid span from size
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
                const span = getSizeSpan(widget.size);
                return (
                    <div
                        key={widget.id}
                        className="col-span-1"
                        style={{
                            gridColumn: `span ${span.col}`,
                            gridRow: `span ${span.row}`
                        }}
                    >
                        <WidgetRenderer
                            widget={widget}
                            activeFilter={activeFilter}
                            onFilter={handleFilter}
                        />
                    </div>
                );
            })}
        </div>
    );
};

export default DashboardEngine;
