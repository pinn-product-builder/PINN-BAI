import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    ArrowRight,
    TrendingUp,
    Sparkles,
    Zap,
    Layout,
    UserPlus
} from 'lucide-react';
import { Lead } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const CRMKanban = () => {
    const { orgId } = useParams();

    const statuses = [
        { id: 'new', label: 'Novos Leads', color: 'bg-blue-500/10 text-blue-500' },
        { id: 'qualified', label: 'Qualificados', color: 'bg-indigo-500/10 text-indigo-500' },
        { id: 'in_analysis', label: 'Em Análise', color: 'bg-yellow-500/10 text-yellow-500' },
        { id: 'proposal', label: 'Proposta', color: 'bg-purple-500/10 text-purple-500' },
        { id: 'converted', label: 'Convertidos', color: 'bg-success/10 text-success' }
    ];

    const { data: leads, isLoading } = useQuery({
        queryKey: ['org-leads', orgId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .eq('org_id', orgId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Lead[];
        }
    });

    const getLeadsByStatus = (status: string) => {
        return leads?.filter(lead => lead.status === status) || [];
    };

    return (
        <div className="p-8 space-y-8">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-accent font-bold text-xs uppercase tracking-tight">
                        <Zap className="w-3 h-3 fill-current" />
                        Smart Sales Pipeline
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
                        Gestão de Leads
                    </h1>
                    <p className="text-muted-foreground text-lg">
                        Sua IA priorizou 12 leads com alta probabilidade de fechamento hoje.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="outline" className="h-12 px-6 rounded-xl border-accent/20 text-accent font-bold hover:bg-accent/5 gap-2">
                        <Filter className="w-4 h-4" />
                        Filtrar
                    </Button>
                    <Button className="h-12 px-6 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-bold shadow-lg shadow-accent/20 gap-2">
                        <UserPlus className="w-4 h-4" />
                        Adicionar Lead
                    </Button>
                </div>
            </div>

            {/* AI Intelligence Bar */}
            <div className="bg-foreground text-background p-4 rounded-2xl flex items-center justify-between shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                        <Sparkles className="text-accent-foreground w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-sm font-bold tracking-tight">IA Insight: "Leads do canal <span className="text-accent">LinkedIn</span> estão convertendo 3x mais rápido na etapa de Proposta."</p>
                    </div>
                </div>
                <Button variant="ghost" className="text-background hover:bg-background/10 font-bold text-xs gap-2">
                    Ver Detalhes <ArrowRight size={14} />
                </Button>
            </div>

            {/* Kanban Board */}
            <div className="flex gap-6 overflow-x-auto pb-8 min-h-[600px] scrollbar-thin scrollbar-thumb-muted">
                {statuses.map((status) => (
                    <div key={status.id} className="flex-shrink-0 w-80 space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2">
                                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${status.color}`}>
                                    {status.label}
                                </div>
                                <span className="text-xs font-bold text-muted-foreground">
                                    {getLeadsByStatus(status.id).length}
                                </span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {isLoading ? (
                                [1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
                            ) : (
                                getLeadsByStatus(status.id).map((lead) => (
                                    <Card key={lead.id} className="group border-none shadow-md hover:shadow-xl transition-all cursor-pointer bg-card/50 backdrop-blur-sm border border-transparent hover:border-accent/20 overflow-hidden relative">
                                        {/* Visual AI Score Indicator */}
                                        <div className="absolute top-0 right-0 p-2">
                                            <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center text-[10px] font-bold text-success border border-success/20">
                                                {Math.floor(Math.random() * 20) + 80}
                                            </div>
                                        </div>

                                        <CardHeader className="p-4 pb-2">
                                            <CardTitle className="text-sm font-bold truncate group-hover:text-accent transition-colors">
                                                {lead.name}
                                            </CardTitle>
                                            <p className="text-[10px] text-muted-foreground truncate uppercase font-mono tracking-tighter">
                                                {lead.company || 'Pessoa Física'} • {lead.source}
                                            </p>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-foreground">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.value)}
                                                </span>
                                                <Badge variant="outline" className="text-[9px] font-bold border-muted/50">
                                                    {new Date(lead.created_at).toLocaleDateString()}
                                                </Badge>
                                            </div>

                                            {/* Micro AI Insight on Card */}
                                            <div className="mt-2 text-[9px] p-2 rounded-lg bg-muted/50 border border-muted text-muted-foreground italic flex gap-2 items-start">
                                                <Sparkles size={10} className="text-accent shrink-0 mt-0.5" />
                                                <p>Interagiu com email de preço há 2h.</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}

                            {!isLoading && getLeadsByStatus(status.id).length === 0 && (
                                <div className="h-32 rounded-2xl border-2 border-dashed border-muted/30 flex items-center justify-center">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Nenhum Lead</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CRMKanban;
