import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
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
import { Layers, Plus, Pencil, Trash2, Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  usePlans,
  useUpdatePlan,
  useDeletePlan,
  useCreatePlan,
} from '@/hooks/usePlans';
import type { Plan } from '@/lib/plans';

const emptyDraft = { full_name: '', name: '', description: '', is_active: true };

const PlansSettingsCard = () => {
  const { toast } = useToast();
  const { data: plans = [], isLoading } = usePlans();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();
  const createPlan = useCreatePlan();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<typeof emptyDraft>(emptyDraft);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<typeof emptyDraft>(emptyDraft);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const startEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setDraft({
      full_name: plan.full_name,
      name: plan.name,
      description: plan.description,
      is_active: plan.is_active,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(emptyDraft);
  };

  const handleSaveEdit = async () => {
    if (editingId == null) return;
    if (!draft.full_name.trim() || !draft.name.trim()) {
      toast({ title: 'Campos obrigatórios', description: 'Nome curto e nome completo são obrigatórios.', variant: 'destructive' });
      return;
    }
    try {
      await updatePlan.mutateAsync({
        id: editingId,
        full_name: draft.full_name.trim(),
        name: draft.name.trim(),
        description: draft.description.trim(),
        is_active: draft.is_active,
      });
      toast({ title: 'Plano atualizado', description: `${draft.full_name} foi salvo.` });
      cancelEdit();
    } catch (err) {
      toast({
        title: 'Erro ao salvar plano',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (plan: Plan, next: boolean) => {
    try {
      await updatePlan.mutateAsync({ id: plan.id, is_active: next });
      toast({
        title: next ? 'Plano ativado' : 'Plano desativado',
        description: `${plan.full_name} ${next ? 'voltou a aparecer no select de criação' : 'não aparecerá mais como opção em novas orgs'}.`,
      });
    } catch (err) {
      toast({
        title: 'Erro ao alternar plano',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (confirmDeleteId == null) return;
    try {
      await deletePlan.mutateAsync(confirmDeleteId);
      toast({ title: 'Plano removido', description: 'O plano foi deletado do catálogo.' });
      setConfirmDeleteId(null);
    } catch (err) {
      toast({
        title: 'Erro ao remover plano',
        description: err instanceof Error ? err.message : 'Existem organizações usando este plano? Desative ao invés de deletar.',
        variant: 'destructive',
      });
    }
  };

  const handleCreate = async () => {
    if (!createDraft.full_name.trim() || !createDraft.name.trim()) {
      toast({ title: 'Campos obrigatórios', description: 'Nome curto e nome completo são obrigatórios.', variant: 'destructive' });
      return;
    }
    try {
      await createPlan.mutateAsync({
        full_name: createDraft.full_name.trim(),
        name: createDraft.name.trim(),
        description: createDraft.description.trim(),
        is_active: createDraft.is_active,
      });
      toast({ title: 'Plano criado', description: `${createDraft.full_name} adicionado ao catálogo.` });
      setCreateDraft(emptyDraft);
      setCreateOpen(false);
    } catch (err) {
      toast({
        title: 'Erro ao criar plano',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const confirmTarget = plans.find((p) => p.id === confirmDeleteId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle>Catálogo de Planos</CardTitle>
              <CardDescription>
                Edite o nome, ative/desative ou remova planos exibidos na criação de organizações.
              </CardDescription>
            </div>
          </div>
          <Button
            onClick={() => {
              setCreateDraft(emptyDraft);
              setCreateOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Plano
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground italic">
            Nenhum plano cadastrado. Crie um novo para começar.
          </div>
        ) : (
          plans.map((plan, index) => {
            const isEditing = editingId === plan.id;
            return (
              <div key={plan.id}>
                {index > 0 && <Separator className="my-2" />}
                <div className="p-3 sm:p-4 rounded-xl hover:bg-muted/40 transition-colors">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`name-${plan.id}`}>Nome curto</Label>
                          <Input
                            id={`name-${plan.id}`}
                            value={draft.name}
                            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                            placeholder="Ex: Revenue OS"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`fullname-${plan.id}`}>Nome completo</Label>
                          <Input
                            id={`fullname-${plan.id}`}
                            value={draft.full_name}
                            onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                            placeholder="Ex: Pinn Revenue OS"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`desc-${plan.id}`}>Descrição</Label>
                        <Input
                          id={`desc-${plan.id}`}
                          value={draft.description}
                          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                          placeholder="Ex: Revenue forecasting & pipeline"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`active-${plan.id}`}
                            checked={draft.is_active}
                            onCheckedChange={(checked) => setDraft({ ...draft, is_active: checked })}
                          />
                          <Label htmlFor={`active-${plan.id}`} className="cursor-pointer">
                            Plano ativo
                          </Label>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={cancelEdit} disabled={updatePlan.isPending}>
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={updatePlan.isPending}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground"
                          >
                            {updatePlan.isPending ? (
                              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4 mr-1.5" />
                            )}
                            Salvar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-primary">{plan.id}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground">{plan.full_name}</p>
                            <Badge variant="outline" className="text-[10px]">{plan.name}</Badge>
                            {plan.is_active ? (
                              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-[10px]">Inativo</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{plan.description || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-2 mr-1">
                          <Switch
                            checked={plan.is_active}
                            onCheckedChange={(checked) => handleToggleActive(plan, checked)}
                            aria-label={`${plan.is_active ? 'Desativar' : 'Ativar'} plano ${plan.name}`}
                          />
                        </div>
                        <Button variant="outline" size="icon" onClick={() => startEdit(plan)} aria-label="Editar plano">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setConfirmDeleteId(plan.id)}
                          className="text-destructive hover:text-destructive"
                          aria-label="Remover plano"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      {/* Dialog: criar plano */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Plano</DialogTitle>
            <DialogDescription>Defina o novo plano que aparecerá no catálogo Pinn.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-name">Nome curto</Label>
                <Input
                  id="new-name"
                  value={createDraft.name}
                  onChange={(e) => setCreateDraft({ ...createDraft, name: e.target.value })}
                  placeholder="Ex: Revenue OS"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-fullname">Nome completo</Label>
                <Input
                  id="new-fullname"
                  value={createDraft.full_name}
                  onChange={(e) => setCreateDraft({ ...createDraft, full_name: e.target.value })}
                  placeholder="Ex: Pinn Revenue OS"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-desc">Descrição</Label>
              <Input
                id="new-desc"
                value={createDraft.description}
                onChange={(e) => setCreateDraft({ ...createDraft, description: e.target.value })}
                placeholder="Ex: Revenue forecasting & pipeline"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="new-active"
                checked={createDraft.is_active}
                onCheckedChange={(checked) => setCreateDraft({ ...createDraft, is_active: checked })}
              />
              <Label htmlFor="new-active" className="cursor-pointer">
                Já criar como ativo
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createPlan.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createPlan.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {createPlan.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar plano'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: confirmar remoção */}
      <AlertDialog open={confirmDeleteId != null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover plano?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{confirmTarget?.full_name}</strong>?
              <br />
              Organizações que estiverem usando este plano podem ficar com referência inválida — considere apenas <strong>desativar</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePlan.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deletePlan.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePlan.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removendo...
                </>
              ) : (
                'Sim, remover'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default PlansSettingsCard;
