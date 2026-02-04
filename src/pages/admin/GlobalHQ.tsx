import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Building2,
    TrendingUp,
    Users,
    DollarSign,
    ArrowUpRight,
    ArrowDownRight,
    Globe,
    Zap,
    LayoutDashboard
} from 'lucide-react';
import { mockOrganizations } from '@/lib/mock-data';

const GlobalHQ = () => {
    const navigate = useNavigate();

    // Aggregate stats
    const totalRevenue = 1250000; // Example
    const totalLeads = mockOrganizations.reduce((acc, org) => acc + org.totalLeads, 0);
    const totalActiveUsers = mockOrganizations.reduce((acc, org) => acc + org.totalUsers, 0);

    return (
        <div className="p-8 space-y-8 pb-16">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground lg:text-5xl">
                        Global HQ <span className="text-accent underline decoration-4 underline-offset-8">Command Center</span>
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
                <Card className="border-none shadow-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white overflow-hidden relative group">
                    <div className="absolute right-[-10%] top-[-10%] opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <DollarSign size={160} />
                    </div>
                    <CardContent className="pt-8">
                        <p className="text-blue-100 text-sm font-medium uppercase tracking-wider mb-2">MRR Consolidado</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-4xl font-bold">R$ {(totalRevenue / 1000).toFixed(1)}k</h2>
                            <span className="flex items-center text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">
                                <ArrowUpRight className="w-3 h-3 mr-1" />
                                +12%
                            </span>
                        </div>
                        <p className="mt-6 text-xs text-blue-100">Crescimento de R$ 42k este mês</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-2xl bg-background overflow-hidden group">
                    <CardContent className="pt-8 flex flex-col justify-between h-full">
                        <div>
                            <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider mb-2">Empresas Ativas</p>
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-4xl font-bold text-foreground">{mockOrganizations.length}</h2>
                                <Building2 className="w-5 h-5 text-accent" />
                            </div>
                        </div>
                        <div className="mt-8 flex -space-x-3">
                            {mockOrganizations.slice(0, 5).map((org, i) => (
                                <div key={i} className="w-10 h-10 rounded-xl border-4 border-background bg-muted flex items-center justify-center text-[10px] font-bold shadow-lg" title={org.name}>
                                    {org.name.charAt(0)}
                                </div>
                            ))}
                            <div className="w-10 h-10 rounded-xl border-4 border-background bg-accent flex items-center justify-center text-[10px] font-bold text-accent-foreground shadow-lg">
                                +{mockOrganizations.length - 5}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-2xl bg-background overflow-hidden relative group">
                    <CardContent className="pt-8">
                        <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider mb-2">Total de Leads</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-4xl font-bold text-foreground">{(totalLeads / 1000).toFixed(1)}k</h2>
                            <span className="flex items-center text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
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

                <Card className="border-none shadow-2xl bg-background overflow-hidden relative group">
                    <CardContent className="pt-8">
                        <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider mb-2">White-label Links</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-4xl font-bold text-foreground">12</h2>
                            <Globe className="w-5 h-5 text-accent" />
                        </div>
                        <div className="mt-8 p-3 rounded-lg bg-orange-500/5 border border-orange-500/10 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                            <p className="text-[10px] font-medium text-orange-600">3 domínios aguardando DNS</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Top Performing Companies */}
                <Card className="lg:col-span-2 border-none shadow-2xl">
                    <CardHeader>
                        <CardTitle className="text-xl">Health Score por Cliente</CardTitle>
                        <CardDescription>Principais métricas de performance das orgs sob gestão</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {mockOrganizations.slice(0, 4).map((org) => (
                                <div key={org.id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-muted/50 transition-all cursor-pointer group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent font-bold group-hover:scale-105 transition-transform">
                                            {org.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-foreground">{org.name}</h4>
                                            <p className="text-xs text-muted-foreground">{org.adminEmail}</p>
                                        </div>
                                    </div>
                                    <div className="hidden md:flex flex-col items-end gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-foreground">{org.totalLeads.toLocaleString()} leads</span>
                                            <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                                        </div>
                                        <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-accent rounded-full w-[var(--progress-width)]" style={{ '--progress-width': `${Math.random() * 60 + 40}%` } as React.CSSProperties} />
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => navigate(`/client/${org.id}/dashboard`)}>
                                        <LayoutDashboard className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <Button variant="outline" className="w-full mt-6 h-12 rounded-xl border-dashed" onClick={() => navigate('/admin/organizations')}>
                            Ver Todas as Organizações
                        </Button>
                    </CardContent>
                </Card>

                {/* AI & System Activity */}
                <div className="space-y-6">
                    <Card className="border-none shadow-2xl bg-accent/5 overflow-hidden">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2 text-accent">
                                <Zap className="w-4 h-4 fill-current" />
                                <CardTitle className="text-sm uppercase tracking-wider">AI Executive Briefing</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm font-medium text-foreground leading-relaxed">
                                "Você teve um aumento de <span className="text-accent font-bold">18% no tráfego Enterprise</span> nas últimas 24h. Recomendamos provisionar o cliente TechCorp para o plano superior para evitar limites de API."
                            </p>
                            <Button size="sm" className="mt-4 bg-accent text-accent-foreground rounded-lg h-9 w-full">Gerar Relatório IA</Button>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-2xl">
                        <CardHeader>
                            <CardTitle className="text-lg">Atividade Recente</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex gap-3 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                    <p className="text-muted-foreground">
                                        <span className="font-bold text-foreground">João Silva</span> criou a organização <span className="font-bold text-foreground">InovaSoft</span>
                                        <br />
                                        <span className="text-[10px] opacity-70">Há 14 minutos</span>
                                    </p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default GlobalHQ;
