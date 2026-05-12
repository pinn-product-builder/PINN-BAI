import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Sparkles, X, Bot, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isDemoOrg } from '@/lib/featureFlags';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

const ARGUTO_GREETING = `Olá! Sou o **BAI Copilot** — sua inteligência dedicada da Arguto.

Já analisei os dados visíveis nesta tela. Pergunte qualquer coisa sobre:

- "Quais clientes estão em risco alto de churn agora?"
- "Quanto a Arguto deixa de faturar com visitas de baixo retorno?"
- "Quais os top 5 clientes pra visitar nas próximas 24h?"
- "Como o score ICP é calculado pro cliente X?"
- "Compare a conversão atual com o cenário com BAI ativo"

Como posso ajudar?`;

const DEFAULT_GREETING = `Olá! Sou o **BAI Copilot**, sua inteligência dedicada. Posso responder perguntas sobre seus dados reais, como:

- "Qual a taxa de conversão atual?"
- "Quais são os leads mais valiosos?"
- "Compare os canais de aquisição"

Como posso ajudar?`;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-data-chat`;

const AIChat = ({ onClose }: { onClose: () => void }) => {
  const { profile } = useAuth();
  const isArgutoDemo = isDemoOrg(profile?.org_id);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: isArgutoDemo ? ARGUTO_GREETING : DEFAULT_GREETING,
      timestamp: new Date()
    }
  ]);

  // Re-emite a saudação correta quando o profile carrega atrasado (auth async).
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length !== 1 || prev[0].role !== 'assistant') return prev;
      const target = isArgutoDemo ? ARGUTO_GREETING : DEFAULT_GREETING;
      if (prev[0].content === target) return prev;
      return [{ ...prev[0], content: target }];
    });
  }, [isArgutoDemo]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = useCallback(async (userMessages: Message[]) => {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        messages: userMessages.map(m => ({ role: m.role, content: m.content })),
        orgId: profile?.org_id || null,
      }),
    });

    if (resp.status === 429) {
      toast.error("Limite de requisições atingido. Tente novamente em alguns segundos.");
      throw new Error("Rate limited");
    }
    
    if (resp.status === 402) {
      toast.error("Créditos insuficientes. Adicione créditos ao workspace.");
      throw new Error("Payment required");
    }

    if (!resp.ok || !resp.body) {
      throw new Error("Failed to start stream");
    }

    return resp.body.getReader();
  }, [profile?.org_id]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputValue('');
    setIsLoading(true);

    let assistantContent = "";

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.id.startsWith('stream-')) {
          return prev.map((m, i) => 
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [...prev, {
          id: `stream-${Date.now()}`,
          role: 'assistant' as const,
          content: assistantContent,
          timestamp: new Date()
        }];
      });
    };

    try {
      const reader = await streamChat(updatedMessages);
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) updateAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) updateAssistant(content);
          } catch { /* ignore */ }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      if (!(error instanceof Error && (error.message === "Rate limited" || error.message === "Payment required"))) {
        toast.error("Erro ao processar mensagem. Tente novamente.");
      }
      // Remove the streaming message on error
      setMessages(prev => prev.filter(m => !m.id.startsWith('stream-')));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-[420px] h-[650px] flex flex-col shadow-2xl border-accent/20 bg-background/95 backdrop-blur-md fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50 bg-accent/5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-accent text-accent-foreground">
            <Sparkles size={18} />
          </div>
          <div>
            <CardTitle className="text-sm font-bold">BAI Copilot</CardTitle>
            <p className="text-[10px] text-muted-foreground">
              {profile?.org_id ? 'Conectado aos seus dados' : 'Modo demonstração'}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
          <X size={16} />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0 relative flex flex-col">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((msg) => (
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
                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-accent">
                      <Bot size={12} /> BAI Copilot
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none leading-relaxed">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="bg-muted px-4 py-2 rounded-2xl rounded-tl-none border border-border/50 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  <span className="text-xs text-muted-foreground">Analisando dados...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border/50 bg-background/50 backdrop-blur-sm">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
            className="flex items-center gap-2"
          >
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Pergunte sobre seus dados..."
              className="rounded-full bg-muted/50 border-transparent focus:border-accent shadow-inner text-sm pl-4"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || isLoading}
              className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20 w-10 h-10 shrink-0"
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
