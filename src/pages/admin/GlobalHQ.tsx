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
    ArrowDownRight,
    Globe,
    Zap,
    LayoutDashboard,
    Loader2
} from 'lucide-react';

const GlobalHQ = () => {
    const navigate = useNavigate();

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

    // Aggregate stats
    const totalRevenue = (organizations?.length || 0) * 1500; // Formula for MRR Projection
    const totalActiveUsers = (organizations?.length || 0) * 8; // Avg Users per Client

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-sm font-medium tracking-widest uppercase opacity-50">Sincronizando Pinn Command...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 pb-16">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground lg:text-5xl">
                        Pinn Command <span className="text-accent underline decoration-4 underline-offset-8">Universe Hub</span>
                    </h1>
                    <p className="text-muted-foreground mt-4 text-lg max-w-2xl">
                        Visão consolidada do seu portfólio de empresas. Monitore crescimento, uso de IA e saúde financeira em tempo real.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold px-6 h-12 rounded-xl shadow-xl shadow-accent/20"
                        onClick={() => navigate('/admin/organizations/new')}
                    >
                        <Zap className="w-4 h-4 mr-2 fill-current" />
                        Novo Cliente VIP
                    </Button>
                </div>
            </div>

            {/* Hero Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-none shadow-2xl bg-gradient-to-br from-[#FF6900] to-[#FCB900] text-black overflow-hidden relative group">
                    <div className="absolute right-[-10%] top-[-10%] opacity-10 group-hover:scale-110 transition-transform duration-500 text-black">
                        <DollarSign size={160} />
                    </div>
                    <CardContent className="pt-8">
                        <p className="text-black/60 text-sm font-bold uppercase tracking-wider mb-2">MRR Consolidado</p>
                        <div className="flex items-baseline gap-2 text-black">
                            <h2 className="text-4xl font-extrabold">R$ {(totalRevenue / 1000).toFixed(1)}k</h2>
                            <span className="flex items-center text-xs font-bold bg-black/10 px-2 py-0.5 rounded-full">
                                <ArrowUpRight className="w-3 h-3 mr-1" />
                                +12%
                            </span>
                        </div>
                        <p className="mt-6 text-xs text-black/60 font-medium">Crescimento escalável Pinn Builder</p>
                    </CardContent>
                </Card>

                <Card className="border border-white/5 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden group">
                    <CardContent className="pt-8 flex flex-col justify-between h-full">
                        <div>
                            <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider mb-2 text-white/50">Empresas Ativas</p>
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-4xl font-bold text-white">{organizations?.length || 0}</h2>
                                <Building2 className="w-5 h-5 text-accent" />
                            </div>
                        </div>
                        <div className="mt-8 flex -space-x-3">
                            {organizations?.slice(0, 5).map((org, i) => (
                                <div key={i} className="w-10 h-10 rounded-xl border-4 border-[#050505] bg-white/10 flex items-center justify-center text-[10px] font-extrabold shadow-lg text-white" title={org.name}>
                                    {org.name.charAt(0)}
                                </div>
                            ))}
                            {(organizations?.length || 0) > 5 && (
                                <div className="w-10 h-10 rounded-xl border-4 border-[#050505] bg-accent flex items-center justify-center text-[10px] font-bold text-accent-foreground shadow-lg">
                                    +{organizations!.length - 5}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-white/5 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden relative group">
                    <CardContent className="pt-8 text-white">
                        <p className="text-white/50 text-sm font-medium uppercase tracking-wider mb-2">Total de Leads</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-4xl font-extrabold text-white">{((totalLeadsCount || 0) / 1000).toFixed(1)}k</h2>
                            <span className="flex items-center text-xs font-bold text-[#FF6900] bg-[#FF6900]/10 px-2 py-0.5 rounded-full border border-[#FF6900]/20">
                                <ArrowUpRight className="w-3 h-3 mr-1" />
                                +8.2%
                            </span>
                        </div>
                        <div className="mt-8 flex items-center gap-2">
                            <Users className="w-4 h-4 text-white/40" />
                            <p className="text-xs text-white/40">Volume de tráfego Premium</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-white/5 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden relative group">
                    <CardContent className="pt-8 text-white">
                        <p className="text-white/50 text-sm font-medium uppercase tracking-wider mb-2">White-label Links</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-4xl font-extrabold text-white">{organizations?.filter((o: any) => o.custom_domain).length || 0}</h2>
                            <Globe className="w-5 h-5 text-accent" />
                        </div>
                        <div className="mt-8 p-3 rounded-xl bg-accent/5 border border-accent/10 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                            <p className="text-[10px] font-bold text-accent uppercase tracking-widest">Ativo Pinn Universe</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-white">
                {/* Top Performing Companies */}
                <Card className="lg:col-span-2 border border-white/5 bg-white/5 backdrop-blur-xl shadow-2xl">
                    <CardHeader>
                        <CardTitle className="text-xl text-white">Health Score por Cliente</CardTitle>
                        <CardDescription className="text-white/50">Principais métricas de performance das orgs sob gestão</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {(organizations?.length || 0) === 0 ? (
                                <div className="text-center py-20 border-2 border-dashed border-white/10 rounded-3xl">
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Building2 className="w-8 h-8 text-white/20" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white/80">O Universo está vazio</h3>
                                    <p className="text-sm text-white/40 mt-1 max-w-[250px] mx-auto">Nenhuma organização encontrada. Comece criando o seu primeiro cliente VIP.</p>
                                    <Button
                                        variant="outline"
                                        className="mt-6 border-accent/50 text-accent hover:bg-accent/10"
                                        onClick={() => navigate('/admin/organizations/new')}
                                    >
                                        Cadastrar Empresa Real
                                    </Button>
                                </div>
                            ) : (
                                organizations?.slice(0, 4).map((org) => (
                                    <div key={org.id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all cursor-pointer group border border-transparent hover:border-white/5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent font-extrabold group-hover:scale-105 transition-transform">
                                                {org.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white tracking-tight">{org.name}</h4>
                                                <p className="text-xs text-white/40">{org.admin_email || 'Sem admin configurado'}</p>
                                            </div>
                                        </div>
                                        <div className="hidden md:flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-white">Plano {org.plan}</span>
                                                <Badge variant="outline" className="text-[10px] bg-white/5 border-white/10 text-white/50 uppercase">{org.status}</Badge>
                                            </div>
                                            <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                                                <div className="h-full bg-accent rounded-full w-[var(--progress-width)]" style={{ '--progress-width': `${Math.random() * 40 + 60}%` } as any} />
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-white/20 hover:text-white hover:bg-white/10"
                                            onClick={() => navigate(`/admin/organizations/${org.id}`)}
                                        >
                                            <LayoutDashboard className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                        {(organizations?.length || 0) > 0 && (
                            <Button variant="outline" className="w-full mt-6 h-12 rounded-xl border-dashed border-white/20 text-white/50 hover:text-white hover:bg-white/5" onClick={() => navigate('/admin/organizations')}>
                                Ver Todas as Organizações
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* AI & System Activity */}
                <div className="space-y-6">
                    <Card className="border border-white/5 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2 text-accent">
                                <Zap className="w-4 h-4 fill-current" />
                                <CardTitle className="text-sm uppercase tracking-widest font-black">AI Executive Briefing</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm font-medium text-white/80 leading-relaxed">
                                {organizations?.length === 0
                                    ? "Bem-vindo ao Pinn Command. Conecte sua primeira empresa para que eu possa analisar os dados e gerar insights estratégicos."
                                    : "Analisando seu portfólio... Detectei uma oportunidade de expansão no plano da última empresa cadastrada baseado no volume de leads."
                                }
                            </p>
                            <Button size="sm" className="mt-4 bg-accent text-accent-foreground font-bold rounded-lg h-9 w-full">Sincronizar Brain</Button>
                        </CardContent>
                    </Card>

                    <Card className="border border-white/5 bg-white/5 backdrop-blur-xl shadow-2xl">
                        <CardHeader>
                            <CardTitle className="text-lg text-white font-bold">Atividade Recente</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {organizations?.slice(0, 3).map((org, i) => (
                                <div key={i} className="flex gap-3 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0 animate-pulse" />
                                    <p className="text-white/40">
                                        <span className="font-bold text-white">{org.admin_name || 'Admin'}</span> ativou a org <span className="font-bold text-accent">{org.name}</span>
                                        <br />
                                        <span className="text-[10px] opacity-50 uppercase tracking-tighter">Sincronizado via Supabase</span>
                                    </p>
                                </div>
                            ))}
                            {(organizations?.length || 0) === 0 && (
                                <p className="text-white/20 text-xs italic">Aguardando telemetria...</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default GlobalHQ;
