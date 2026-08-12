import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send,
  Sparkles,
  X,
  Bot,
  Loader2,
  Plus,
  History,
  ThumbsUp,
  ThumbsDown,
  Trash2,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isDemoOrg } from '@/lib/featureFlags';
import { captureDashboardSnapshot } from '@/lib/dashboardSnapshot';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import {
  useChatThreads,
  useChatMessages,
  useCreateThread,
  useUpdateThreadTitle,
  useDeleteThread,
  useSaveMessage,
  useRateMessage,
  type ChatMessage,
} from '@/hooks/useAIChatThreads';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const ARGUTO_GREETING =
  'Olá! Sou o **BAI Copilot** — sua inteligência dedicada da Arguto. Já analisei os dados visíveis nesta tela. Pergunte qualquer coisa ou comece pelas sugestões abaixo.';
const DEFAULT_GREETING =
  'Olá! Sou o **BAI Copilot**, sua inteligência dedicada. Posso responder perguntas sobre seus dados reais. Comece pelas sugestões ou pergunte direto.';

const ARGUTO_QUESTIONS = [
  'Quais clientes estão em risco alto de churn agora?',
  'Quanto a Arguto deixa de faturar com visitas de baixo retorno?',
  'Quais os top 5 clientes pra visitar nas próximas 24h?',
  'Como o score ICP é calculado pro cliente X?',
  'Compare a conversão atual com o cenário com BAI ativo',
];

const DEFAULT_QUESTIONS = [
  'Qual a taxa de conversão atual?',
  'Quais são os leads mais valiosos?',
  'Compare os canais de aquisição',
];

interface UIMessage {
  /** ID local (timestamp string) ou ID real da tabela ai_chat_messages. */
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** rating do assistant: -1, 0 ou 1. null se ainda não votou. */
  rating?: -1 | 0 | 1 | null;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-data-chat`;

const AIChat = ({ onClose }: { onClose: () => void }) => {
  const { profile, user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isArgutoDemo = isDemoOrg(profile?.org_id);

  const orgId = profile?.org_id ?? null;
  const userId = user?.id ?? null;

  // ── Thread management ─────────────────────────────────────────────────────────
  const [threadId, setThreadId] = useState<string | null>(null);
  const { data: threads = [], refetch: refetchThreads } = useChatThreads(orgId, userId);
  const { data: dbMessages = [], isFetched: isMessagesFetched } = useChatMessages(threadId);
  const createThread = useCreateThread();
  const updateThreadTitle = useUpdateThreadTitle();
  const deleteThread = useDeleteThread();
  const saveMessage = useSaveMessage();
  const rateMessage = useRateMessage();

  // Local mirror das mensagens enquanto o stream chega.
  const [localMessages, setLocalMessages] = useState<UIMessage[]>([]);

  // Refs pra controlar quando hidratar do servidor:
  // - hydratedThreadIdRef: última thread cujo conteúdo já foi carregado do servidor.
  // - justCreatedRef: thread que ACABAMOS de criar localmente (manter as msgs in-flight).
  const hydratedThreadIdRef = useRef<string | null>(null);
  const justCreatedRef = useRef<string | null>(null);

  // Sincronização: hidrata local com dbMessages só quando troca de thread (uma vez por thread).
  // Sem este controle, qualquer invalidate da query reseta o que o usuário acabou de mandar.
  // IMPORTANTE: quando threadId=null (sem persistência — caso de user sem orgId), NÃO zerar
  // localMessages aqui. dbMessages volta como [] por default a cada render e dispara o effect
  // em loop, apagando a mensagem que o usuário acabou de mandar. A limpeza explícita acontece
  // em handleNewConversation/handleDeleteCurrentThread.
  useEffect(() => {
    if (!threadId) {
      hydratedThreadIdRef.current = null;
      justCreatedRef.current = null;
      return;
    }
    if (hydratedThreadIdRef.current === threadId) return;
    if (!isMessagesFetched) return;

    const isJustCreated = justCreatedRef.current === threadId;
    hydratedThreadIdRef.current = threadId;
    justCreatedRef.current = null;

    setLocalMessages((prev) => {
      const dbAsUI: UIMessage[] = dbMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          rating: m.rating,
        }));
      if (isJustCreated) {
        // Thread recém-criada durante um send: preservar msgs locais ainda não persistidas.
        const inFlight = prev.filter((m) => m.id.startsWith('local-') || m.id.startsWith('stream-'));
        return [...dbAsUI, ...inFlight];
      }
      // Pure switch ou load inicial: substitui pelo que veio do banco.
      return dbAsUI;
    });
  }, [threadId, dbMessages, isMessagesFetched]);

  // Ao abrir o chat pela primeira vez, escolher a thread mais recente (se houver).
  useEffect(() => {
    if (threadId === null && threads.length > 0) {
      setThreadId(threads[0].id);
    }
  }, [threadId, threads]);

  // ── Greeting (mostrado quando ainda não há mensagens) ─────────────────────────
  const greeting = isArgutoDemo ? ARGUTO_GREETING : DEFAULT_GREETING;
  const suggestionChips = useMemo(
    () => (isArgutoDemo ? ARGUTO_QUESTIONS : DEFAULT_QUESTIONS),
    [isArgutoDemo],
  );

  // ── Input & stream state ──────────────────────────────────────────────────────
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages, isLoading]);

  // Garante que existe uma thread; cria se necessário.
  const ensureThread = useCallback(
    async (firstUserMessage: string): Promise<string | null> => {
      if (threadId) return threadId;
      if (!orgId || !userId) return null;
      try {
        const titleSeed = firstUserMessage.trim().slice(0, 60) || 'Nova conversa';
        const t = await createThread.mutateAsync({ orgId, userId, title: titleSeed });
        // Marca como "criada agora" pra que o useEffect de hidratação não apague as msgs locais.
        justCreatedRef.current = t.id;
        setThreadId(t.id);
        return t.id;
      } catch (err) {
        // Se a tabela ainda não existe (migração pendente), seguimos sem persistir.
        console.warn('[AIChat] createThread falhou; chat ficará efêmero.', err);
        return null;
      }
    },
    [threadId, orgId, userId, createThread],
  );

  const streamChat = useCallback(
    async (userMessages: { role: 'user' | 'assistant'; content: string }[]) => {
      // Snapshot do que está renderizado AGORA — dá ao Bacilot acesso às mesmas
      // métricas que o usuário vê (conversão, forecast, KPIs custom). Sem isso
      // a IA respondia "não vejo esse número" para dados visíveis na tela.
      const dashboardContext = captureDashboardSnapshot(queryClient, location?.pathname || '');
      console.log('[AIChat] POST ai-data-chat', {
        url: CHAT_URL,
        msgCount: userMessages.length,
        contextEntries: dashboardContext.entries.length,
      });
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: userMessages,
          orgId: orgId,
          pathname: location?.pathname || null,
          dashboardContext,
        }),
      });

      if (resp.status === 429) {
        toast.error('Limite de requisições atingido. Tente novamente em alguns segundos.');
        throw new Error('Rate limited');
      }
      if (resp.status === 402) {
        toast.error('Créditos insuficientes. Adicione créditos ao workspace.');
        throw new Error('Payment required');
      }
      console.log('[AIChat] response status', resp.status, resp.statusText);
      if (!resp.ok || !resp.body) {
        const errBody = await resp.text().catch(() => '');
        console.error('[AIChat] fetch falhou', resp.status, errBody.slice(0, 500));
        throw new Error(`Failed to start stream (HTTP ${resp.status})`);
      }
      return resp.body.getReader();
    },
    [orgId, location?.pathname, queryClient],
  );

  const handleSendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? inputValue).trim();
    console.log('[AIChat] handleSendMessage start', { textLen: text.length, isLoading, orgId, userId });
    if (!text || isLoading) {
      console.log('[AIChat] handleSendMessage early-return', { hasText: !!text, isLoading });
      return;
    }

    const userMsg: UIMessage = { id: `local-${Date.now()}`, role: 'user', content: text };
    const draft = [...localMessages, userMsg];
    setLocalMessages(draft);
    setInputValue('');
    setIsLoading(true);

    // Persiste a thread + mensagem do usuário em paralelo ao stream. Falha
    // aqui NUNCA pode bloquear o envio — o chat funciona mesmo sem persistência.
    let ensured: string | null = null;
    try {
      ensured = await ensureThread(text);
      if (ensured) {
        saveMessage.mutate({ threadId: ensured, role: 'user', content: text });
        if (localMessages.length === 0) {
          updateThreadTitle.mutate({ threadId: ensured, title: text.slice(0, 60) });
        }
      }
    } catch (persistErr) {
      console.warn('[AIChat] persistência falhou (chat continua):', persistErr);
    }

    let assistantContent = '';
    const assistantLocalId = `stream-${Date.now()}`;

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setLocalMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.id === assistantLocalId) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
        }
        return [...prev, { id: assistantLocalId, role: 'assistant', content: assistantContent }];
      });
    };

    try {
      const reader = await streamChat(draft.map((m) => ({ role: m.role, content: m.content })));
      const decoder = new TextDecoder();
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) updateAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) updateAssistant(content);
          } catch { /* ignore */ }
        }
      }

      // Persiste a resposta final do assistant.
      if (ensured && assistantContent.trim()) {
        try {
          const saved = await saveMessage.mutateAsync({
            threadId: ensured,
            role: 'assistant',
            content: assistantContent,
          });
          // Substitui o id local pelo id real persistido (pra possibilitar thumbs).
          setLocalMessages((prev) =>
            prev.map((m) => (m.id === assistantLocalId ? { ...m, id: saved.id, rating: null } : m)),
          );
        } catch (err) {
          console.warn('[AIChat] saveMessage falhou:', err);
        }
      }
    } catch (error) {
      console.error('[AIChat] Chat error:', error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg !== 'Rate limited' && msg !== 'Payment required') {
        toast.error(`Erro ao processar mensagem: ${msg}`);
      }
      setLocalMessages((prev) => prev.filter((m) => m.id !== assistantLocalId));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    setThreadId(null);
    setLocalMessages([]);
    setInputValue('');
  };

  const handleSwitchThread = (id: string) => {
    if (id === threadId) return;
    setThreadId(id);
    setInputValue('');
  };

  const handleDeleteCurrentThread = async () => {
    if (!threadId) return;
    if (!confirm('Apagar esta conversa?')) return;
    try {
      await deleteThread.mutateAsync(threadId);
      setThreadId(null);
      setLocalMessages([]);
      refetchThreads();
    } catch (err) {
      toast.error('Não foi possível apagar a conversa.');
    }
  };

  const handleRate = async (msg: UIMessage, value: -1 | 1) => {
    // Toggle: se já está na mesma posição, vira 0.
    const newRating: -1 | 0 | 1 = msg.rating === value ? 0 : value;
    setLocalMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, rating: newRating } : m)),
    );
    // Só persiste se o id é real (UUID, não local-/stream-).
    if (!msg.id.startsWith('local-') && !msg.id.startsWith('stream-')) {
      try {
        await rateMessage.mutateAsync({ messageId: msg.id, rating: newRating });
      } catch (err) {
        console.warn('[AIChat] rateMessage falhou:', err);
      }
    }
  };

  const currentThread = threads.find((t) => t.id === threadId) ?? null;
  const showGreeting = localMessages.length === 0;

  return (
    <Card className="w-[420px] h-[650px] flex flex-col shadow-2xl border-primary/20 bg-background/95 backdrop-blur-md fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50 bg-primary/5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="p-2 rounded-lg bg-primary text-primary-foreground shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-sm font-bold truncate">
              {currentThread?.title ?? 'BAI Copilot'}
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">
              {orgId ? 'Conectado aos seus dados' : 'Modo demonstração'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {threads.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-primary/10"
                  title="Histórico"
                >
                  <History size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 max-h-80 overflow-y-auto">
                <DropdownMenuItem onClick={handleNewConversation} className="font-semibold">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova conversa
                </DropdownMenuItem>
                {threadId && (
                  <DropdownMenuItem
                    onClick={handleDeleteCurrentThread}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Apagar atual
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {threads.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => handleSwitchThread(t.id)}
                    className={t.id === threadId ? 'bg-primary/10 font-semibold' : ''}
                  >
                    <span className="truncate text-xs">{t.title}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewConversation}
            className="h-8 w-8 rounded-full hover:bg-primary/10"
            title="Nova conversa"
          >
            <Plus size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <X size={16} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0 relative flex flex-col">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {showGreeting && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-tl-none p-4 text-sm shadow-sm bg-muted text-muted-foreground border border-border/50">
                  <div className="flex items-center gap-2 mb-2 text-xs font-bold text-primary">
                    <Bot size={12} /> BAI Copilot
                  </div>
                  <div className="prose prose-sm max-w-none leading-relaxed">
                    <ReactMarkdown>{greeting}</ReactMarkdown>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {suggestionChips.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => handleSendMessage(q)}
                        disabled={isLoading}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {localMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[85%] rounded-2xl p-4 text-sm shadow-sm
                    ${msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-none'
                      : 'bg-muted text-muted-foreground rounded-tl-none border border-border/50'
                    }
                  `}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-primary">
                      <Bot size={12} /> BAI Copilot
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none leading-relaxed">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.role === 'assistant' && !msg.id.startsWith('stream-') && (
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/30">
                      <button
                        type="button"
                        onClick={() => handleRate(msg, 1)}
                        className={`p-1 rounded transition-colors ${msg.rating === 1 ? 'text-emerald-500 bg-emerald-500/10' : 'text-muted-foreground/50 hover:text-emerald-500 hover:bg-emerald-500/10'}`}
                        title="Resposta útil"
                      >
                        <ThumbsUp size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRate(msg, -1)}
                        className={`p-1 rounded transition-colors ${msg.rating === -1 ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10'}`}
                        title="Resposta ruim"
                      >
                        <ThumbsDown size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && localMessages[localMessages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="bg-muted px-4 py-2 rounded-2xl rounded-tl-none border border-border/50 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Analisando dados...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border/50 bg-background/50 backdrop-blur-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              console.log('[AIChat] form onSubmit', { inputValue, isLoading });
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (e.target.value.length === 1) console.log('[AIChat] input first char', e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  console.log('[AIChat] Enter pressed', { inputValue, isLoading });
                }
              }}
              placeholder="Pergunte sobre seus dados..."
              className="rounded-full bg-muted/50 border-transparent focus:border-primary shadow-inner text-sm pl-4"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || isLoading}
              onClick={(e) => {
                console.log('[AIChat] send button clicked', { inputValue, isLoading, disabled: !inputValue.trim() || isLoading });
                // Não impede o submit do form — só registra que o click chegou.
              }}
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 w-10 h-10 shrink-0"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={18} />}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIChat;
