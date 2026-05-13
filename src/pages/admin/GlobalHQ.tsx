import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Building2,
    LayoutDashboard,
    Loader2,
    Move,
    Check,
} from 'lucide-react';
import { EditableCardGrid, type CardWidget } from '@/components/dashboard/EditableCardGrid';
import { cn } from '@/lib/utils';

const GlobalHQ = () => {
    const navigate = useNavigate();
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

    const widgets: CardWidget[] = [
        {
            id: 'hq:empresas',
            size: { w: 4, h: 7 },
            render: () => (
                <Card className="border border-border bg-card shadow-2xl overflow-hidden group rounded-2xl h-full">
                    <CardContent className="pt-8 flex flex-col justify-between h-full">
                        <div>
                            <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider mb-2">Empresas Ativas</p>
                            <div className="flex items-baseline gap-2">
                                <h2 className="text-4xl font-bold text-foreground">{organizations?.length || 0}</h2>
                                <Building2 className="w-5 h-5 text-primary" />
                            </div>
                        </div>
                        <div className="mt-8 flex -space-x-3">
                            {organizations?.slice(0, 5).map((org, i) => (
                                <div key={i} className="w-10 h-10 rounded-xl border-4 border-card bg-muted flex items-center justify-center text-[10px] font-extrabold shadow-lg text-foreground" title={org.name}>
                                    {org.name.charAt(0)}
                                </div>
                            ))}
                            {(organizations?.length || 0) > 5 && (
                                <div className="w-10 h-10 rounded-xl border-4 border-card bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground shadow-lg">
                                    +{organizations!.length - 5}
                                </div>
                            )}
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
                        <CardTitle className="text-xl text-foreground">Organizações Ativas</CardTitle>
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
                                        className="no-drag mt-6 border-primary/50 text-primary hover:bg-primary/10"
                                        onClick={() => navigate('/admin/organizations/new')}
                                    >
                                        Cadastrar Empresa Real
                                    </Button>
                                </div>
                            ) : (
                                organizations?.slice(0, 4).map((org) => (
                                    <div key={org.id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-muted/50 transition-all cursor-pointer group border border-transparent hover:border-border">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-extrabold group-hover:scale-105 transition-transform">
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
                                                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.random() * 40 + 60}%` }} />
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
            id: 'hq:atividade',
            size: { w: 4, h: 7 },
            render: () => (
                <Card className="border border-border bg-card shadow-2xl rounded-2xl h-full">
                    <CardHeader>
                        <CardTitle className="text-lg text-foreground font-bold">Atividade Recente</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {organizations?.slice(0, 3).map((org, i) => (
                            <div key={i} className="flex gap-3 text-sm">
                                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0 animate-pulse" />
                                <p className="text-muted-foreground">
                                    <span className="font-bold text-foreground">{org.admin_name || 'Admin'}</span> ativou a org <span className="font-bold text-primary">{org.name}</span>
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
                        Pinn BAI Command
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
                    {/* Botões "Módulo RFM + Churn" e "Novo Cliente VIP" foram
                        ocultados a pedido. Para reativar, restaurar do git history. */}
                </div>
            </div>

            <EditableCardGrid
                pageKey="admin:global-hq-v2"
                orgId={null}
                widgets={widgets}
                isEditing={isEditingLayout}
            />
        </div>
    );
};

export default GlobalHQ;
