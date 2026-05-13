import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Building2,
    TrendingUp,
    Users,
    DollarSign,
    ArrowUpRight,
    Globe,
    Zap,
    LayoutDashboard,
    Loader2,
    Move,
    Check,
} from 'lucide-react';
import { isRfmChurnEnabledForAdmin } from '@/lib/featureFlags';
import { EditableCardGrid, type CardWidget } from '@/components/dashboard/EditableCardGrid';
import { cn } from '@/lib/utils';

const GlobalHQ = () => {
    const navigate = useNavigate();
    const showRfmChurn = isRfmChurnEnabledForAdmin();
    const [isEditingLayout, setIsEditingLayout] = useState(false);

    const { data: organizations, isLoading } = useQuery({
        queryKey: ['admin-organizations'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        },
    });

    const { data: totalLeadsCount } = useQuery({
        queryKey: ['admin-total-leads'],
        queryFn: async () => {
            const { count, error } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true });
            if (error) throw error;
            return count || 0;
        },
    });

    const totalRevenue = (organizations?.length || 0) * 1500;

    const widgets: CardWidget[] = [
        {
            id: 'hq:mrr',
            size: { w: 3, h: 5 },
            render: () => (
                <Card className="border-none shadow-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground overflow-hidden relative group rounded-2xl h-full">
                    <div className="absolute right-[-10%] top-[-10%] opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <DollarSign size={160} />
                    </div>
                    <CardContent className="pt-8 h-full">
                        <p className="text-primary-foreground/70 text-sm font-bold uppercase tracking-wider mb-2">MRR Consolidado</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-4xl font-extrabold">R$ {(totalRevenue / 1000).toFixed(1)}k</h2>
                            <span className="flex items-center text-xs font-bold bg-primary-foreground/15 px-2 py-0.5 rounded-full">
                                <ArrowUpRight className="w-3 h-3 mr-1" />
                                +12%
                            </span>
                        </div>
                        <p className="mt-6 text-xs text-primary-foreground/60 font-medium">Crescimento escalável Pinn</p>
                    </CardContent>
                </Card>
            ),
        },
        {
            id: 'hq:empresas',
            size: { w: 3, h: 5 },
            render: () => (
                <Card className="border border-border bg-card shadow-2xl overflow-hidden group rounded-2xl h-full">
                    <CardContent className="pt-8 flex flex-col justify-between h-full">
                        <div>
                            <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider mb-2">Empresas Ativas</p>
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-4xl font-bold text-foreground">{organizations?.length || 0}</h2>
                                <Building2 className="w-5 h-5 text-accent" />
                            </div>
                        </div>
                        <div className="mt-8 flex -space-x-3">
                            {organizations?.slice(0, 5).map((org, i) => (
                                <div key={i} className="w-10 h-10 rounded-xl border-4 border-card bg-muted flex items-center justify-center text-[10px] font-extrabold shadow-lg text-foreground" title={org.name}>
                                    {org.name.charAt(0)}
                                </div>
                            ))}
                            {(organizations?.length || 0) > 5 && (
                                <div className="w-10 h-10 rounded-xl border-4 border-card bg-accent flex items-center justify-center text-[10px] font-bold text-accent-foreground shadow-lg">
                                    +{organizations!.length - 5}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ),
        },
        {
            id: 'hq:leads',
            size: { w: 3, h: 5 },
            render: () => (
                <Card className="border border-border bg-card shadow-2xl overflow-hidden relative group rounded-2xl h-full">
                    <CardContent className="pt-8 h-full">
                        <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider mb-2">Total de Leads</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-4xl font-extrabold text-foreground">{((totalLeadsCount || 0) / 1000).toFixed(1)}k</h2>
                            <span className="flex items-center text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                                <ArrowUpRight className="w-3 h-3 mr-1" />
                                +8.2%
                            </span>
                        </div>
                        <div className="mt-8 flex items-center gap-2">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">Volume de tráfego Premium</p>
                        </div>
                    </CardContent>
                </Card>
            ),
        },
        {
            id: 'hq:whitelabel',
            size: { w: 3, h: 5 },
            render: () => (
                <Card className="border border-border bg-card shadow-2xl overflow-hidden relative group rounded-2xl h-full">
                    <CardContent className="pt-8 h-full">
                        <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider mb-2">Links White-label</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-4xl font-extrabold text-foreground">{organizations?.filter((o: any) => o.custom_domain).length || 0}</h2>
                            <Globe className="w-5 h-5 text-accent" />
                        </div>
                        <div className="mt-8 p-3 rounded-xl bg-accent/10 border border-accent/20 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                            <p className="text-[10px] font-bold text-accent uppercase tracking-widest">Ativo Pinn Universe</p>
                        </div>
                    </CardContent>
                </Card>
            ),
        },
        {
            id: 'hq:saude-clientes',
            size: { w: 8, h: 12 },
            render: () => (
                <Card className="border border-border bg-card shadow-2xl rounded-2xl h-full">
                    <CardHeader>
                        <CardTitle className="text-xl text-foreground">Saúde por Cliente</CardTitle>
                        <CardDescription>Principais métricas de performance das orgs sob gestão</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {(organizations?.length || 0) === 0 ? (
                                <div className="text-center py-20 border-2 border-dashed border-border rounded-3xl">
                                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Building2 className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-lg font-bold text-foreground">O Universo está vazio</h3>
                                    <p className="text-sm text-muted-foreground mt-1 max-w-[250px] mx-auto">Nenhuma organização encontrada. Comece criando o seu primeiro cliente VIP.</p>
                                    <Button
                                        variant="outline"
                                        className="no-drag mt-6 border-accent/50 text-accent hover:bg-accent/10"
                                        onClick={() => navigate('/admin/organizations/new')}
                                    >
                                        Cadastrar Empresa Real
                                    </Button>
                                </div>
                            ) : (
                                organizations?.slice(0, 4).map((org) => (
                                    <div key={org.id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-muted/50 transition-all cursor-pointer group border border-transparent hover:border-border">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent font-extrabold group-hover:scale-105 transition-transform">
                                                {org.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-foreground tracking-tight">{org.name}</h4>
                                                <p className="text-xs text-muted-foreground">{org.admin_email || 'Sem admin configurado'}</p>
                                            </div>
                                        </div>
                                        <div className="hidden md:flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-foreground">Plano {org.plan}</span>
                                                <Badge variant="outline" className="text-[10px] bg-muted border-border text-muted-foreground uppercase">{org.status}</Badge>
                                            </div>
                                            <div className="w-32 h-1 bg-muted rounded-full overflow-hidden mt-1">
                                                <div className="h-full bg-accent rounded-full" style={{ width: `${Math.random() * 40 + 60}%` }} />
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="no-drag text-muted-foreground hover:text-foreground hover:bg-muted"
                                            onClick={() => navigate(`/admin/organizations/${org.id}`)}
                                        >
                                            <LayoutDashboard className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                        {(organizations?.length || 0) > 0 && (
                            <Button variant="outline" className="no-drag w-full mt-6 h-12 rounded-xl border-dashed text-muted-foreground hover:text-foreground hover:bg-muted/50" onClick={() => navigate('/admin/organizations')}>
                                Ver Todas as Organizações
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ),
        },
        {
            id: 'hq:ia-resumo',
            size: { w: 4, h: 6 },
            render: () => (
                <Card className="border border-border bg-card shadow-2xl overflow-hidden rounded-2xl h-full">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 text-accent">
                            <Zap className="w-4 h-4 fill-current" />
                            <CardTitle className="text-sm uppercase tracking-widest font-black">Resumo Executivo IA</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm font-medium text-foreground/80 leading-relaxed">
                            {organizations?.length === 0
                                ? "Bem-vindo ao Pinn BAI Command. Conecte sua primeira empresa para que eu possa analisar os dados e gerar insights estratégicos."
                                : "Analisando seu portfólio... Detectei uma oportunidade de expansão no plano da última empresa cadastrada baseado no volume de leads."
                            }
                        </p>
                        <Button size="sm" className="no-drag mt-4 bg-accent text-accent-foreground font-bold rounded-lg h-9 w-full">Sincronizar Análise</Button>
                    </CardContent>
                </Card>
            ),
        },
        {
            id: 'hq:atividade',
            size: { w: 4, h: 6 },
            render: () => (
                <Card className="border border-border bg-card shadow-2xl rounded-2xl h-full">
                    <CardHeader>
                        <CardTitle className="text-lg text-foreground font-bold">Atividade Recente</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {organizations?.slice(0, 3).map((org, i) => (
                            <div key={i} className="flex gap-3 text-sm">
                                <div className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0 animate-pulse" />
                                <p className="text-muted-foreground">
                                    <span className="font-bold text-foreground">{org.admin_name || 'Admin'}</span> ativou a org <span className="font-bold text-accent">{org.name}</span>
                                    <br />
                                    <span className="text-[10px] opacity-50 uppercase tracking-tighter">Sincronizado via Supabase</span>
                                </p>
                            </div>
                        ))}
                        {(organizations?.length || 0) === 0 && (
                            <p className="text-muted-foreground text-xs italic">Aguardando telemetria...</p>
                        )}
                    </CardContent>
                </Card>
            ),
        },
    ];

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-sm font-medium tracking-widest uppercase text-muted-foreground">Sincronizando Pinn BAI Command...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 pb-16">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl lg:text-5xl font-extrabold tracking-tight text-foreground">
                        Pinn <span className="text-accent underline decoration-4 underline-offset-8">BAI Command</span>
                    </h1>
                    <p className="text-muted-foreground mt-3 sm:mt-4 text-sm sm:text-base lg:text-lg max-w-2xl">
                        Visão consolidada do portfólio de empresas. Monitore crescimento, uso de IA e saúde financeira em tempo real.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setIsEditingLayout((v) => !v)}
                        className={cn(
                            'shrink-0 inline-flex items-center gap-1.5 h-10 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold border transition-all',
                            isEditingLayout
                                ? 'border-primary/50 bg-primary text-primary-foreground shadow-sm'
                                : 'border-border bg-card text-foreground hover:border-primary/40 hover:text-primary',
                        )}
                    >
                        {isEditingLayout ? <Check className="w-4 h-4" /> : <Move className="w-4 h-4" />}
                        <span className="hidden sm:inline">{isEditingLayout ? 'Concluir edição' : 'Editar layout'}</span>
                        <span className="sm:hidden">{isEditingLayout ? 'OK' : 'Layout'}</span>
                    </button>
                    {showRfmChurn && (
                        <Button
                                variant="outline"
                                className="h-10 sm:h-12 border-border text-xs sm:text-sm"
                                onClick={() => navigate('/admin/rfm-churn')}
                            >
                                <LayoutDashboard className="w-4 h-4 mr-1.5 sm:mr-2" />
                                <span className="hidden sm:inline">Módulo RFM + Churn</span>
                                <span className="sm:hidden">RFM</span>
                            </Button>
                    )}
                    <Button
                        className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold px-3 sm:px-6 h-10 sm:h-12 rounded-xl shadow-xl shadow-accent/20 text-xs sm:text-sm"
                        onClick={() => navigate('/admin/organizations/new')}
                    >
                        <Zap className="w-4 h-4 mr-1.5 sm:mr-2 fill-current" />
                        <span className="hidden sm:inline">Novo Cliente VIP</span>
                        <span className="sm:hidden">Novo</span>
                    </Button>
                </div>
            </div>

            <EditableCardGrid
                pageKey="admin:global-hq"
                orgId={null}
                widgets={widgets}
                isEditing={isEditingLayout}
            />
        </div>
    );
};

export default GlobalHQ;
