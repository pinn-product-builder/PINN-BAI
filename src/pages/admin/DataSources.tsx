import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, Pencil, Trash2, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDataSources, useUpsertDataSource, useDeleteDataSource, type DataSource } from '@/hooks/useDataSources';

interface DraftState {
  id?: string;
  key: string;
  display_name: string;
  description: string;
  category: string;
  is_active: boolean;
}

const EMPTY_DRAFT: DraftState = {
  key: '',
  display_name: '',
  description: '',
  category: '',
  is_active: true,
};

/**
 * CRUD admin para o catálogo de fontes de dados de widgets.
 * Elimina o hardcode em DashboardAdminMenu — agora a lista vem do banco
 * e pode ser editada sem deploy.
 */
const AdminDataSources = () => {
  const { toast } = useToast();
  const { data: sources = [], isLoading } = useDataSources({ activeOnly: false });
  const upsertMut = useUpsertDataSource();
  const deleteMut = useDeleteDataSource();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);

  const grouped = useMemo(() => {
    const map = new Map<string, DataSource[]>();
    for (const s of sources) {
      const cat = s.category || 'outros';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sources]);

  const handleSave = async () => {
    if (!draft.key.trim() || !draft.display_name.trim()) {
      toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Key e Nome são obrigatórios.' });
      return;
    }
    try {
      await upsertMut.mutateAsync({
        id: draft.id,
        org_id: null, // globais por enquanto. Admin de org pode adicionar org-specific via API.
        key: draft.key.trim(),
        display_name: draft.display_name.trim(),
        description: draft.description.trim() || null,
        category: draft.category.trim() || null,
        is_active: draft.is_active,
      });
      toast({ title: draft.id ? 'Fonte atualizada' : 'Fonte cadastrada' });
      setDialogOpen(false);
      setDraft(EMPTY_DRAFT);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Falha', description: (err as Error).message });
    }
  };

  const handleEdit = (s: DataSource) => {
    setDraft({
      id: s.id,
      key: s.key,
      display_name: s.display_name,
      description: s.description ?? '',
      category: s.category ?? '',
      is_active: s.is_active,
    });
    setDialogOpen(true);
  };

  const handleNew = () => {
    setDraft(EMPTY_DRAFT);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
      toast({ title: 'Fonte removida' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Falha ao remover', description: (err as Error).message });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            Fontes de dados
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Catálogo de tabelas e views que os widgets podem consumir. Cadastre uma vez,
            disponível em todos os dashboards (WidgetEditorDialog + geração IA).
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-1" /> Nova fonte
        </Button>
      </header>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {!isLoading && sources.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhuma fonte cadastrada ainda. Use "Nova fonte" pra começar.
          </CardContent>
        </Card>
      )}

      {grouped.map(([cat, items]) => (
        <Card key={cat} className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">{cat}</CardTitle>
            <CardDescription>{items.length} fonte{items.length === 1 ? '' : 's'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-3 border rounded-lg p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold">{s.key}</span>
                    {!s.is_active && <Badge variant="secondary">inativa</Badge>}
                    {s.org_id === null && <Badge variant="outline">global</Badge>}
                  </div>
                  <div className="text-sm mt-0.5">{s.display_name}</div>
                  {s.description && (
                    <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover {s.key}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Widgets que referenciam essa fonte continuarão tentando carregá-la diretamente —
                          a remoção afeta só o catálogo, não os widgets já criados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(s.id)}>Remover</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? 'Editar fonte' : 'Nova fonte de dados'}</DialogTitle>
            <DialogDescription>
              Catálogo é global (visível pra todas as orgs). Para fonte específica de uma org, usar API.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Key (nome técnico da tabela/view)</Label>
              <Input
                placeholder="ex: vw_pipeline_health"
                value={draft.key}
                onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
                disabled={!!draft.id}
                className="font-mono"
              />
            </div>
            <div>
              <Label>Nome de exibição</Label>
              <Input
                placeholder="ex: View · Saúde do pipeline"
                value={draft.display_name}
                onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input
                placeholder="crm, kpi, ads, erp, …"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                rows={2}
                placeholder="O que essa view contém? Quando usar?"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="cursor-pointer" htmlFor="is_active_switch">Ativa</Label>
                <p className="text-xs text-muted-foreground">Fontes inativas não aparecem na geração IA.</p>
              </div>
              <Switch
                id="is_active_switch"
                checked={draft.is_active}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, is_active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsertMut.isPending}>
              {upsertMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {draft.id ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDataSources;
