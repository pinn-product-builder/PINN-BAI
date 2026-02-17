import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Loader2,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';

interface InsightResult {
  type: 'recommendation' | 'alert' | 'trend';
  priority: 'high' | 'medium' | 'low';
  title: string;
  content: string;
}

const insightConfig = {
  recommendation: {
    icon: Lightbulb,
    label: 'Recomendação',
    className: 'bg-accent/10 text-accent',
    borderColor: 'border-l-accent',
  },
  alert: {
    icon: AlertTriangle,
    label: 'Alerta',
    className: 'bg-warning/10 text-warning',
    borderColor: 'border-l-warning',
  },
  trend: {
    icon: TrendingUp,
    label: 'Tendência',
    className: 'bg-success/10 text-success',
    borderColor: 'border-l-success',
  },
};

const priorityConfig = {
  high: { label: 'Alta', className: 'bg-destructive/10 text-destructive' },
  medium: { label: 'Média', className: 'bg-warning/10 text-warning' },
  low: { label: 'Baixa', className: 'bg-muted text-muted-foreground' },
};

const Insights = () => {
  const { orgId } = useParams();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Fetch real AI insights from the edge function
  const { data: insights, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['ai-insights', orgId],
    queryFn: async (): Promise<InsightResult[]> => {
      // Call the AI edge function to generate insights based on real data
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-data-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          orgId,
          messages: [
            {
              role: 'user',
              content: `Analise todos os dados disponíveis da organização e gere exatamente 5 insights acionáveis. 
              
Para cada insight, responda APENAS com um JSON array válido (sem markdown, sem backticks, sem explicação), seguindo este formato:
[
  {"type": "recommendation|alert|trend", "priority": "high|medium|low", "title": "Título curto", "content": "Descrição detalhada com dados concretos e ação sugerida"}
]

Use dados reais dos leads, conversões, fontes e tendências. Inclua números e porcentagens concretas.`,
            },
          ],
        }),
      });

      if (!resp.ok) throw new Error('Falha ao gerar insights');

      // Read streamed response
      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No stream');

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullContent += content;
          } catch { /* skip */ }
        }
      }

      // Parse the JSON from AI response
      try {
        // Try to extract JSON array from response
        const jsonMatch = fullContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('Failed to parse insights JSON:', e, fullContent);
      }

      // Fallback: return as single insight
      return [{
        type: 'recommendation',
        priority: 'medium',
        title: 'Análise Geral',
        content: fullContent || 'Não foi possível gerar insights no momento.',
      }];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const handleSpeak = (text: string) => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleSpeakAll = () => {
    if (!insights?.length) return;
    const fullText = insights
      .map((i, idx) => `Insight ${idx + 1}: ${i.title}. ${i.content}`)
      .join('. ');
    handleSpeak(fullText);
  };

  const stats = {
    total: insights?.length || 0,
    recommendations: insights?.filter((i) => i.type === 'recommendation').length || 0,
    alerts: insights?.filter((i) => i.type === 'alert').length || 0,
    highPriority: insights?.filter((i) => i.priority === 'high').length || 0,
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-accent font-bold text-xs uppercase tracking-tight mb-1">
            <Sparkles className="w-3 h-3 fill-current" />
            Powered by AI
          </div>
          <h1 className="text-3xl font-bold text-foreground">Inteligência IA</h1>
          <p className="text-muted-foreground mt-1">
            Insights gerados a partir dos seus dados reais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSpeakAll}
            disabled={!insights?.length}
            className="gap-2"
          >
            <Volume2 className="w-4 h-4" />
            {isSpeaking ? 'Parar' : 'Ouvir Todos'}
          </Button>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Gerar Novos Insights
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Insights</p>
                <p className="text-3xl font-bold text-foreground">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Lightbulb className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Recomendações</p>
                <p className="text-3xl font-bold text-accent">{stats.recommendations}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Alertas</p>
                <p className="text-3xl font-bold text-warning">{stats.alerts}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Alta Prioridade</p>
                <p className="text-3xl font-bold text-destructive">{stats.highPriority}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <div>
              <CardTitle>Insights Gerados por IA</CardTitle>
              <CardDescription>Análise em tempo real baseada nos seus dados</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
              <p className="text-sm text-muted-foreground">A IA está analisando seus dados...</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {insights?.map((insight, idx) => {
                  const config = insightConfig[insight.type] || insightConfig.recommendation;
                  const priority = priorityConfig[insight.priority] || priorityConfig.medium;
                  const Icon = config.icon;

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border border-l-4 bg-card hover:bg-muted/30 transition-colors ${config.borderColor}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${config.className}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className={config.className}>{config.label}</Badge>
                            <Badge variant="outline" className={priority.className}>{priority.label}</Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 ml-auto"
                              onClick={() => handleSpeak(insight.content)}
                              title="Ouvir este insight"
                            >
                              <Volume2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <p className="font-semibold text-foreground text-sm mb-1">{insight.title}</p>
                          <div className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{insight.content}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Insights;
