import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
    ArrowLeft,
    LayoutDashboard,
    Settings,
    Database,
    ExternalLink,
    Loader2,
    Trash2,
    AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDeleteOrganization } from '@/hooks/useOrganizations';
import { usePlans } from '@/hooks/usePlans';
import { getPlanShortName } from '@/lib/plans';
import OrgAvatar from '@/components/admin/OrgAvatar';
import TrialSettingsCard from '@/components/admin/TrialSettingsCard';
import { isRfmChurnEnabledForAdmin } from '@/lib/featureFlags';
import type { OrgStatus } from '@/lib/types';

const OrganizationDetail = () => {
    const { orgId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const deleteOrganization = useDeleteOrganization();
    const [isDeleting, setIsDeleting] = useState(false);
    const showRfmChurn = isRfmChurnEnabledForAdmin();
    const { data: plans } = usePlans();

    const { data: organization, isLoading, error } = useQuery({
        queryKey: ['admin-organization', orgId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', orgId)
                .single();

            if (error) throw error;
            return data;
        },
    });

    if (isLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !organization) {
        return (
            <div className="p-8 text-center space-y-4">
                <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
                <h2 className="text-2xl font-bold text-foreground">Organização não encontrada</h2>
                <Button onClick={() => navigate('/admin/organizations')}>Voltar</Button>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="min-w-0">
                    <Link
                        to="/admin/organizations"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar para organizações
                    </Link>
                    <div className="flex items-center gap-3 sm:gap-4">
                        <OrgAvatar
                            name={organization.name}
                            logoUrl={organization.logo_url}
                            sizeClassName="w-12 h-12 sm:w-16 sm:h-16"
                            textClassName="text-xl sm:text-2xl"
                            roundedClassName="rounded-2xl"
                        />
                        <div className="min-w-0">
                            <h1 className="text-xl sm:text-3xl font-bold text-foreground truncate">{organization.name}</h1>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge variant="outline">{getPlanShortName(plans, organization.plan)}</Badge>
                                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">{organization.status}</Badge>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <Button
                        variant="outline"
                        className="h-10 sm:h-12 text-xs sm:text-sm"
                        onClick={() => navigate(`/client/${organization.id}/dashboard`)}
                    >
                        <ExternalLink className="w-4 h-4 mr-1.5 sm:mr-2" />
                        <span className="hidden sm:inline">Visualizar como Cliente</span>
                        <span className="sm:hidden">Ver Cliente</span>
                    </Button>
                    {showRfmChurn && (
                        <Button
                            variant="outline"
                            className="h-10 sm:h-12 border-white/10 text-xs sm:text-sm"
                            onClick={() => navigate('/admin/rfm-churn')}
                        >
                            <LayoutDashboard className="w-4 h-4 mr-1.5 sm:mr-2" />
                            <span className="hidden sm:inline">RFM + Churn</span>
                            <span className="sm:hidden">RFM</span>
                        </Button>
                    )}
                    <Button className="h-10 sm:h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold group text-xs sm:text-sm">
                        <Settings className="w-4 h-4 mr-1.5 sm:mr-2 group-hover:rotate-90 transition-transform" />
                        <span className="hidden sm:inline">Configurar Org</span>
                        <span className="sm:hidden">Config</span>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Info Card + Trial */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border border-border bg-card/80 backdrop-blur-xl shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-foreground">Visão Geral</CardTitle>
                            <CardDescription>Dados cadastrais e técnicos</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">ID da Organização</p>
                                    <p className="font-mono text-sm text-foreground break-all">{organization.id}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Slug (URL)</p>
                                    <p className="text-sm text-foreground">{organization.slug}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Administrador Responsável</p>
                                    <p className="text-sm font-medium text-foreground">{organization.admin_name || 'Não definido'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">E-mail de Contato</p>
                                    <p className="text-sm text-foreground">{organization.admin_email || 'Não definido'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <TrialSettingsCard
                        orgId={organization.id}
                        status={organization.status as OrgStatus}
                        trialEndsAt={(organization as { trial_ends_at?: string | null }).trial_ends_at ?? null}
                    />
                </div>

                {/* Quick Actions / Status */}
                <div className="space-y-6">
                    <Card className="border border-border bg-card/80 backdrop-blur-xl shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Métricas Rápidas</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <LayoutDashboard className="w-4 h-4 text-primary" />
                                    <span className="text-sm text-foreground">Dashboards</span>
                                </div>
                                <span className="font-bold text-foreground">1</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <Database className="w-4 h-4 text-primary" />
                                    <span className="text-sm text-foreground">Integrações</span>
                                </div>
                                <span className="text-xs text-muted-foreground italic">Nenhuma ativa</span>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <button className="w-full flex items-center justify-between p-3 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <Trash2 className="w-4 h-4" />
                                            <span className="text-sm">Remover Organização</span>
                                        </div>
                                    </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta ação não pode ser desfeita. Isso irá deletar permanentemente a organização
                                            <strong> {organization.name}</strong> e todos os dados associados (leads, dashboards, integrações, usuários).
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            disabled={isDeleting}
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                setIsDeleting(true);
                                                try {
                                                    await deleteOrganization.mutateAsync(organization.id);
                                                    toast({
                                                        title: "Organização removida",
                                                        description: `${organization.name} foi deletada com sucesso.`,
                                                    });
                                                    navigate('/admin/organizations');
                                                } catch (error: any) {
                                                    toast({
                                                        title: "Erro ao deletar",
                                                        description: error.message || "Não foi possível remover a organização.",
                                                        variant: "destructive",
                                                    });
                                                } finally {
                                                    setIsDeleting(false);
                                                }
                                            }}
                                        >
                                            {isDeleting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Removendo...
                                                </>
                                            ) : (
                                                "Sim, remover"
                                            )}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default OrganizationDetail;
