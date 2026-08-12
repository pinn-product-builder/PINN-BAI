import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, CheckCircle, Clock, Sparkles, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useAiPrompts,
  useCreatePromptVersion,
  useActivatePromptVersion,
  type AiPrompt,
} from '@/hooks/useAiPrompts';

/**
 * E4.S2 — admin edita prompts da IA sem deploy. Versão ativa por prompt_key
 * é lida pela edge function ai-data-chat (modo insights / meeting_brief / chat).
 */
const AdminAiPrompts = () => {
  const { toast } = useToast();
  const { data: prompts = [], isLoading } = useAiPrompts();
  const createMut = useCreatePromptVersion();
  const activateMut = useActivatePromptVersion();
  const [newDialog, setNewDialog] = useState<{ open: boolean; promptKey: string } | null>(null);
  const [draft, setDraft] = useState({ title: '', body: '', description: '' });

  const byKey = useMemo(() => {
    const map = new Map<string, AiPrompt[]>();
    for (const p of prompts) {
      if (!map.has(p.prompt_key)) map.set(p.prompt_key, []);
      map.get(p.prompt_key)!.push(p);
    }
    return map;
  }, [prompts]);

  const handleCreate = async () => {
    if (!newDialog) return;
    if (!draft.title.trim() || !draft.body.trim()) {
      toast({ variant: 'destructive', title: 'Título e corpo obrigatórios' });
      return;
    }
    try {
      await createMut.mutateAsync({
        prompt_key: newDialog.promptKey,
        title: draft.title.trim(),
        body: draft.body.trim(),
        description: draft.description.trim() || undefined,
      });
      toast({ title: 'Nova versão criada', description: 'Promova para ativa quando estiver pronto.' });
      setNewDialog(null);
      setDraft({ title: '', body: '', description: '' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Falha ao criar', description: msg });
    }
  };

  const handleActivate = async (id: string, label: string) => {
    try {
      await activateMut.mutateAsync(id);
      toast({ title: 'Versão ativada', description: label });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Falha ao ativar', description: msg });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> Prompts da IA
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Versão ativa de cada prompt é a que a edge function <code>ai-data-chat</code> usa. Histórico preservado para rollback.
        </p>
      </div>

      {Array.from(byKey.entries()).map(([key, versions]) => {
        const active = versions.find((v) => v.is_active) ?? versions[0];
        return (
          <Card key={key}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Layers className="w-4 h-4 text-primary" />
                    <code className="text-sm">{key}</code>
                    <Badge variant="outline" className="text-[10px]">v{active?.version}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {active?.description ?? 'Sem descrição.'}
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setDraft({ title: '', body: active?.body ?? '', description: '' });
                    setNewDialog({ open: true, promptKey: key });
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova versão
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {versions.map((v) => {
                const isAct = v.is_active;
                return (
                  <div
                    key={v.id}
                    className={`p-3 rounded-lg border ${isAct ? 'border-primary/40 bg-primary/[0.03]' : 'border-border/40'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{v.title}</span>
                          <Badge variant="outline" className="text-[10px]">v{v.version}</Badge>
                          {isAct && (
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
                              <CheckCircle className="w-3 h-3 mr-1" /> ATIVA
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(v.updated_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        {v.description && <p className="text-xs text-muted-foreground mt-1">{v.description}</p>}
                        <pre className="text-[11px] mt-2 font-mono bg-muted/40 border border-border/30 rounded p-2 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                          {v.body.length > 1200 ? `${v.body.slice(0, 1200)}…` : v.body}
                        </pre>
                      </div>
                      {!isAct && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleActivate(v.id, `${key} v${v.version}`)}
                          disabled={activateMut.isPending}
                        >
                          Ativar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!newDialog?.open} onOpenChange={(v) => !v && setNewDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova versão — {newDialog?.promptKey}</DialogTitle>
            <DialogDescription>
              Crie a nova versão. Ela começa inativa — promova depois de testar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título da versão</Label>
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ex: Insights v2 — foco em CAC" />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Por que essa versão foi criada?" />
            </div>
            <div>
              <Label>Corpo do prompt</Label>
              <Textarea
                rows={14}
                className="font-mono text-xs"
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                placeholder="Cole o prompt completo aqui. Variáveis com ${} são interpoladas em runtime."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialog(null)} disabled={createMut.isPending}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              Criar versão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAiPrompts;
