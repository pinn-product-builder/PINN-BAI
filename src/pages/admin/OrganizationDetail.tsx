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
import { planNames } from '@/lib/mock-data';

const OrganizationDetail = () => {
    const { orgId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const deleteOrganization = useDeleteOrganization();
    const [isDeleting, setIsDeleting] = useState(false);

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
                <h2 className="text-2xl font-bold">Organização não encontrada</h2>
                <Button onClick={() => navigate('/admin/organizations')}>Voltar</Button>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <Link
                        to="/admin/organizations"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar para organizações
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center text-accent text-2xl font-black">
                            {organization.name.charAt(0)}
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">{organization.name}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline">{planNames[organization.plan]}</Badge>
                                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">{organization.status}</Badge>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        className="h-12 border-white/10"
                        onClick={() => navigate(`/client/${organization.id}/dashboard`)}
                    >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Visualizar como Cliente
                    </Button>
                    <Button className="h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-bold group">
                        <Settings className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
                        Configurar Org
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Info Card */}
                <Card className="lg:col-span-2 border-white/5 bg-white/5 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle>Visão Geral</CardTitle>
                        <CardDescription>Dados cadastrais e técnicos</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">ID da Organização</p>
                                <p className="font-mono text-sm break-all">{organization.id}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Slug (URL)</p>
                                <p className="text-sm">{organization.slug}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Administrador Responsável</p>
                                <p className="text-sm font-medium">{organization.admin_name || 'Não definido'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">E-mail de Contato</p>
                                <p className="text-sm">{organization.admin_email || 'Não definido'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Actions / Status */}
                <div className="space-y-6">
                    <Card className="border-white/5 bg-white/5 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold uppercase tracking-widest text-white/50">Métricas Rápidas</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                                <div className="flex items-center gap-3">
                                    <LayoutDashboard className="w-4 h-4 text-accent" />
                                    <span className="text-sm">Dashboards</span>
                                </div>
                                <span className="font-bold">1</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                                <div className="flex items-center gap-3">
                                    <Database className="w-4 h-4 text-accent" />
                                    <span className="text-sm">Integrações</span>
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
