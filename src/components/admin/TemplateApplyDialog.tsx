import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import OrgAvatar from '@/components/admin/OrgAvatar';
import { planNames } from '@/lib/mock-data';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  LayoutTemplate,
  Sparkles,
} from 'lucide-react';
import {
  useApplyTemplateToOrg,
  type DashboardTemplate,
  type TemplateWidget,
} from '@/hooks/useTemplates';

interface TemplateApplyDialogProps {
  template: DashboardTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const widgetColors: Record<string, string> = {
  metric_card: 'bg-emerald-500',
  line_chart: 'bg-blue-500',
  area_chart: 'bg-cyan-500',
  bar_chart: 'bg-amber-500',
  pie_chart: 'bg-purple-500',
  funnel: 'bg-pink-500',
  table: 'bg-slate-500',
  insight_card: 'bg-indigo-500',
};

const sizeToGridSpan: Record<string, number> = {
  small: 3,
  medium: 4,
  large: 6,
  full: 12,
};

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  logo_url: string | null;
  plan: number;
}

const TemplateApplyDialog = ({ template, open, onOpenChange }: TemplateApplyDialogProps) => {
  const { toast } = useToast();
  const applyMutation = useApplyTemplateToOrg();

  const [step, setStep] = useState<'preview' | 'pick-org'>('preview');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  useEffect(() => {
    if (open) {
      setStep('preview');
      setSelectedOrgId('');
      setConfirmOverwrite(false);
    }
  }, [open, template?.id]);

  const widgets = useMemo<TemplateWidget[]>(
    () => (template?.widgets ?? []) as TemplateWidget[],
    [template],
  );

  // Lista de orgs (todas as ativas/trial — ignora suspensas pra evitar
  // sobrescrever acidentalmente quem está fora do ar).
  const { data: orgs, isLoading: loadingOrgs } = useQuery({
    queryKey: ['admin-organizations-for-template'],
    queryFn: async (): Promise<OrgRow[]> => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug, status, logo_url, plan')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as OrgRow[];
    },
    enabled: open && step === 'pick-org',
  });

  const selectedOrg = useMemo(
    () => orgs?.find((o) => o.id === selectedOrgId) ?? null,
    [orgs, selectedOrgId],
  );

  // Conta widgets atuais no dashboard default da org selecionada
  const { data: existingWidgetCount } = useQuery({
    queryKey: ['template-org-existing-widgets', selectedOrgId],
    queryFn: async (): Promise<number> => {
      if (!selectedOrgId) return 0;
      const { data: dash, error: dashErr } = await supabase
        .from('dashboards')
        .select('id')
        .eq('org_id', selectedOrgId)
        .eq('is_default', true)
        .maybeSingle();
      if (dashErr) throw dashErr;
      if (!dash) return 0;
      const { count, error } = await supabase
        .from('dashboard_widgets')
        .select('id', { count: 'exact', head: true })
        .eq('dashboard_id', dash.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!selectedOrgId,
  });

  const hasExisting = (existingWidgetCount ?? 0) > 0;

  const renderPreviewGrid = () => {
    if (widgets.length === 0) {
      return (
        <div className="py-10 text-center text-muted-foreground text-sm">
          Esse template ainda não tem widgets configurados.
        </div>
      );
    }
    const rows: TemplateWidget[][] = [];
    let currentRow: TemplateWidget[] = [];
    let currentSpan = 0;
    widgets.forEach((w) => {
      const span = sizeToGridSpan[w.size || 'medium'] || 4;
      if (currentSpan + span > 12) {
        if (currentRow.length) rows.push(currentRow);
        currentRow = [w];
        currentSpan = span;
      } else {
        currentRow.push(w);
        currentSpan += span;
      }
    });
    if (currentRow.length) rows.push(currentRow);

    return (
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2">
            {row.map((widget, j) => {
              const span = sizeToGridSpan[widget.size || 'medium'] || 4;
              const widthPercent = (span / 12) * 100;
              return (
                <div
                  key={j}
                  style={{ width: `${widthPercent}%` }}
                  className={`h-16 rounded-md border border-border/40 ${widgetColors[widget.type] ?? 'bg-muted'} bg-opacity-15 p-2 flex flex-col justify-between text-[10px] overflow-hidden`}
                >
                  <span className="text-foreground/90 font-medium truncate">{widget.title}</span>
                  <Badge variant="outline" className="text-[9px] self-start bg-background/80">
                    {widget.type.replace('_', ' ')}
                  </Badge>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const triggerApply = (overwrite: boolean) => {
    if (!template || !selectedOrgId) return;
    applyMutation.mutate(
      { templateId: template.id, orgId: selectedOrgId, overwrite },
      {
        onSuccess: ({ widgetsApplied, overwrote }) => {
          toast({
            title: 'Template aplicado',
            description: `${widgetsApplied} widget(s) ${overwrote ? 'substituídos' : 'criados'} no dashboard de ${selectedOrg?.name}.`,
          });
          setConfirmOverwrite(false);
          onOpenChange(false);
        },
        onError: (err: Error) => {
          if (err.message === 'OVERWRITE_REQUIRED') {
            setConfirmOverwrite(true);
            return;
          }
          toast({
            title: 'Erro ao aplicar template',
            description: err.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handlePrimaryAction = () => {
    if (step === 'preview') {
      setStep('pick-org');
      return;
    }
    if (!selectedOrgId) return;
    triggerApply(false);
  };

  if (!template) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <LayoutTemplate className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl">{template.name}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 flex-wrap mt-1">
                  <Badge variant="outline">
                    {planNames[template.plan as keyof typeof planNames] ?? `Plano ${template.plan}`}
                  </Badge>
                  {template.category && (
                    <Badge variant="secondary">{template.category}</Badge>
                  )}
                  <span className="text-xs">
                    {widgets.length} widgets · {template.usage_count ?? 0} aplicações
                  </span>
                </DialogDescription>
                {template.description && (
                  <p className="text-sm text-muted-foreground mt-2">{template.description}</p>
                )}
              </div>
            </div>
          </DialogHeader>

          {step === 'preview' && (
            <div className="space-y-4 mt-2">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                {renderPreviewGrid()}
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Os widgets vão entrar no dashboard <strong>default</strong> da org. As fontes de
                  dados de cada widget continuam configuráveis pelo cliente (ou pelo onboarding)
                  depois que o template for aplicado.
                </p>
              </div>
            </div>
          )}

          {step === 'pick-org' && (
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="org-select" className="text-sm font-medium">
                  Aplicar a qual organização?
                </Label>
                <Select
                  value={selectedOrgId}
                  onValueChange={setSelectedOrgId}
                  disabled={loadingOrgs}
                >
                  <SelectTrigger
                    id="org-select"
                    className="h-auto min-h-[3rem] py-2 [&>span]:!line-clamp-none [&>span]:flex-1 [&>span]:text-left"
                  >
                    <SelectValue placeholder={loadingOrgs ? 'Carregando organizações…' : 'Selecione a organização-alvo'} />
                  </SelectTrigger>
                  <SelectContent className="w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)]">
                    {(orgs ?? []).map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        <div className="flex items-center gap-2 min-w-0">
                          <OrgAvatar
                            name={org.name}
                            logoUrl={org.logo_url}
                            sizeClassName="w-7 h-7"
                            textClassName="text-[10px]"
                            roundedClassName="rounded-md"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{org.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {planNames[org.plan as keyof typeof planNames] ?? `Plano ${org.plan}`}
                              {' · '}
                              {org.status}
                            </p>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedOrg && (
                <>
                  <Separator />
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <OrgAvatar
                        name={selectedOrg.name}
                        logoUrl={selectedOrg.logo_url}
                        sizeClassName="w-10 h-10"
                        textClassName="text-base"
                        roundedClassName="rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground truncate">{selectedOrg.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          Status: {selectedOrg.status}
                        </p>
                      </div>
                    </div>
                    {hasExisting ? (
                      <div className="flex items-start gap-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-700 dark:text-red-300">
                        <span className="font-bold">⚠</span>
                        <p>
                          Esta org já tem <strong>{existingWidgetCount}</strong> widget
                          {existingWidgetCount === 1 ? '' : 's'} configurado
                          {existingWidgetCount === 1 ? '' : 's'}. Aplicar o template vai
                          <strong> substituir todos</strong> pelos {widgets.length} widgets
                          deste template.
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4" />
                        <p>Org sem widgets — aplicação limpa, sem sobrescrita.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {step === 'pick-org' && (
              <Button
                variant="ghost"
                onClick={() => setStep('preview')}
                disabled={applyMutation.isPending}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={applyMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handlePrimaryAction}
              disabled={
                applyMutation.isPending ||
                (step === 'pick-org' && !selectedOrgId)
              }
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {applyMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : step === 'preview' ? (
                <ArrowRight className="w-4 h-4 mr-2" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {step === 'preview' ? 'Aplicar a uma org…' : 'Aplicar template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOverwrite} onOpenChange={setConfirmOverwrite}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sobrescrever dashboard atual?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{selectedOrg?.name}</strong> já possui {existingWidgetCount} widget
              {existingWidgetCount === 1 ? '' : 's'} no dashboard default. Aplicar este template
              vai <strong>apagar todos os widgets atuais</strong> e substituir pelos {widgets.length}
              {' '}deste template. Configurações de mapping de fonte de dados serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applyMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={applyMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                triggerApply(true);
              }}
            >
              {applyMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Sim, sobrescrever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
};

export default TemplateApplyDialog;
