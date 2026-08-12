import { useRef, useState } from 'react';
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
    RotateCcw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EditableCardGrid, type CardWidget } from '@/components/dashboard/EditableCardGrid';
import { cn } from '@/lib/utils';
import OrgAvatar from '@/components/admin/OrgAvatar';
import { usePlans } from '@/hooks/usePlans';
import { getPlanShortName } from '@/lib/plans';

const statusVariant: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    trial: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    suspended: 'bg-red-500/10 text-red-500 border-red-500/20',
};

const GlobalHQ = () => {
    const navigate = useNavigate();
    const [isEditingLayout, setIsEditingLayout] = useState(false);
    const resetLayoutRef = useRef<() => void>(() => {});
    const { data: plans } = usePlans();

    const handleResetLayout = () => {
        if (confirm('Restaurar o tamanho e posição padrão dos cards?')) {
            resetLayoutRef.current();
        }
    };

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
                            {organizations?.slice(0, 5).map((org) => (
                                <div key={org.id} className="rounded-xl border-4 border-card shadow-lg" title={org.name}>
                                    <OrgAvatar
                                        name={org.name}
                                        logoUrl={org.logo_url}
                                        sizeClassName="w-10 h-10"
                                        textClassName="text-[10px]"
                                        roundedClassName="rounded-lg"
                                    />
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
                                    <div key={org.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-muted/50 transition-all cursor-pointer group border border-transparent hover:border-border">
                                        <div className="flex items-center gap-4 min-w-0 flex-1">
                                            <OrgAvatar
                                                name={org.name}
                                                logoUrl={org.logo_url}
                                                sizeClassName="w-12 h-12 group-hover:scale-105 transition-transform"
                                                textClassName="text-base"
                                                roundedClassName="rounded-2xl"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-bold text-foreground tracking-tight truncate">{org.name}</h4>
                                                <p className="text-xs text-muted-foreground truncate">{org.admin_email || 'Sem admin configurado'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="hidden md:flex flex-col items-end gap-1 w-32">
                                                <div className="flex items-center gap-2 justify-end w-full">
                                                    <span className="text-sm font-bold text-foreground whitespace-nowrap truncate">{getPlanShortName(plans, org.plan)}</span>
                                                    <Badge variant="outline" className="text-[10px] bg-muted border-border text-muted-foreground uppercase shrink-0">{org.status}</Badge>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="no-drag text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                                                onClick={() => navigate(`/admin/organizations/${org.id}`)}
                                            >
                                                <LayoutDashboard className="w-4 h-4" />
                                            </Button>
                                        </div>
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
            render: () => {
                const recentOrgs = organizations?.slice(0, 5) ?? [];
                return (
                    <Card className="border border-border bg-card shadow-2xl rounded-2xl h-full">
                        <CardHeader>
                            <CardTitle className="text-lg text-foreground font-bold">Atividade Recente</CardTitle>
                            <CardDescription>Últimas organizações cadastradas</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {recentOrgs.length === 0 ? (
                                <p className="text-muted-foreground text-xs italic">Nenhuma organização cadastrada ainda.</p>
                            ) : (
                                recentOrgs.map((org) => (
                                    <button
                                        key={org.id}
                                        onClick={() => navigate(`/admin/organizations/${org.id}`)}
                                        className="no-drag w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors text-left"
                                    >
                                        <OrgAvatar
                                            name={org.name}
                                            logoUrl={org.logo_url}
                                            sizeClassName="w-8 h-8 shrink-0"
                                            textClassName="text-[10px]"
                                            roundedClassName="rounded-lg"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-foreground truncate">{org.name}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                Cadastrada {formatDistanceToNow(new Date(org.created_at), { addSuffix: true, locale: ptBR })}
                                            </p>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                'text-[9px] uppercase tracking-tight shrink-0',
                                                statusVariant[org.status] ?? 'bg-muted border-border text-muted-foreground'
                                            )}
                                        >
                                            {org.status}
                                        </Badge>
                                    </button>
                                ))
                            )}
                        </CardContent>
                    </Card>
                );
            },
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
                    {isEditingLayout && (
                        <button
                            type="button"
                            onClick={handleResetLayout}
                            className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold border border-border bg-card text-muted-foreground hover:border-destructive/40 hover:text-destructive transition-all"
                            title="Restaurar tamanho e posição padrão dos cards"
                        >
                            <RotateCcw className="w-4 h-4" />
                            <span className="hidden sm:inline">Resetar layout</span>
                            <span className="sm:hidden">Resetar</span>
                        </button>
                    )}
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
                onLayoutReset={(reset) => { resetLayoutRef.current = reset; }}
            />
        </div>
    );
};

export default GlobalHQ;
