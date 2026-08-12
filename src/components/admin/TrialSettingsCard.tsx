import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Clock, Loader2, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { OrgStatus } from '@/lib/types';

interface TrialSettingsCardProps {
  orgId: string;
  status: OrgStatus;
  trialEndsAt: string | null;
}

const QUICK_DURATIONS = [
  { label: '7 dias',  days: 7  },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
];

const toDateInputValue = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // YYYY-MM-DD pra <input type="date">
  return d.toISOString().slice(0, 10);
};

const TrialSettingsCard = ({ orgId, status, trialEndsAt }: TrialSettingsCardProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTrial, setIsTrial] = useState(status === 'trial');
  const [endDate, setEndDate] = useState(toDateInputValue(trialEndsAt));

  useEffect(() => {
    setIsTrial(status === 'trial');
    setEndDate(toDateInputValue(trialEndsAt));
  }, [status, trialEndsAt]);

  const trialState = useMemo(() => {
    if (status !== 'trial') return null;
    if (!trialEndsAt) return { kind: 'no-deadline' as const };
    const end = new Date(trialEndsAt);
    const ms = end.getTime() - Date.now();
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    if (ms < 0) return { kind: 'expired' as const, days: Math.abs(days) };
    return { kind: 'active' as const, days };
  }, [status, trialEndsAt]);

  const setQuickDuration = (days: number) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    setEndDate(target.toISOString().slice(0, 10));
    setIsTrial(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates: { status: OrgStatus; trial_ends_at: string | null } = isTrial
        ? {
            status: 'trial',
            trial_ends_at: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : null,
          }
        : { status: 'active', trial_ends_at: null };

      const { error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organization', orgId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations-list'] });
      toast({
        title: 'Configuração de trial salva',
        description: isTrial
          ? 'Org marcada como trial. Acesso será suspenso após a data de expiração.'
          : 'Trial removido — acesso normal restaurado.',
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao salvar trial', description: err.message, variant: 'destructive' });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('organizations')
        .update({ status: 'active', trial_ends_at: null })
        .eq('id', orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organization', orgId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations-list'] });
      toast({ title: 'Acesso reativado', description: 'Organização agora está ativa.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao reativar', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <Card className="border border-border bg-card/80 backdrop-blur-xl shadow-sm">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-foreground">Período de Trial</CardTitle>
            <CardDescription>
              Defina uma data limite. Ao expirar, o acesso é suspenso até reativação manual.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Status atual */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Status atual:</span>
          {status === 'active' && (
            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 whitespace-nowrap">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Ativo
              </span>
            </Badge>
          )}
          {status === 'trial' && trialState?.kind === 'active' && (
            <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 whitespace-nowrap">
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Trial — {trialState.days} dia{trialState.days === 1 ? '' : 's'} restante{trialState.days === 1 ? '' : 's'}
              </span>
            </Badge>
          )}
          {status === 'trial' && trialState?.kind === 'expired' && (
            <Badge className="bg-red-500/10 text-red-500 border-red-500/20 whitespace-nowrap">
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Trial expirado há {trialState.days} dia{trialState.days === 1 ? '' : 's'} (acesso suspenso)
              </span>
            </Badge>
          )}
          {status === 'trial' && trialState?.kind === 'no-deadline' && (
            <Badge variant="outline" className="border-amber-500/30 text-amber-500 whitespace-nowrap">
              Trial sem data definida
            </Badge>
          )}
          {status === 'suspended' && (
            <Badge className="bg-red-500/10 text-red-500 border-red-500/20 whitespace-nowrap">Suspenso</Badge>
          )}
        </div>

        {(status === 'suspended' || (status === 'trial' && trialState?.kind === 'expired')) && (
          <>
            <Separator />
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
              <div className="text-sm">
                <p className="font-medium text-foreground">Acesso bloqueado para o cliente</p>
                <p className="text-xs text-muted-foreground">
                  Reative para que o cliente volte a entrar no BAI normalmente.
                </p>
              </div>
              <Button
                onClick={() => reactivateMutation.mutate()}
                disabled={reactivateMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {reactivateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Reativar acesso
              </Button>
            </div>
          </>
        )}

        <Separator />

        {/* Toggle trial */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="trial-toggle" className="text-foreground font-medium">
              Marcar como trial
            </Label>
            <p className="text-xs text-muted-foreground">
              Quando ligado, o acesso expira automaticamente na data definida abaixo.
            </p>
          </div>
          <Switch
            id="trial-toggle"
            checked={isTrial}
            onCheckedChange={setIsTrial}
          />
        </div>

        {isTrial && (
          <>
            <div className="space-y-2">
              <Label htmlFor="trial-end" className="text-sm">Data de expiração</Label>
              <Input
                id="trial-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="max-w-xs"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground self-center mr-1">Atalhos:</span>
              {QUICK_DURATIONS.map((preset) => (
                <Button
                  key={preset.days}
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setQuickDuration(preset.days)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end pt-2">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || (isTrial && !endDate)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar configuração
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrialSettingsCard;
