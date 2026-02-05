import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, CheckCircle2, XCircle, RefreshCw, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import WidgetRecommendationCard, { type RecommendationStatus } from './WidgetRecommendationCard';
import type { WidgetRecommendation, WidgetType } from '@/lib/types';

interface WidgetRecommendationListProps {
  recommendations: WidgetRecommendation[];
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
  onSelectionChange: (acceptedWidgets: WidgetRecommendation[]) => void;
  initialAccepted?: WidgetRecommendation[];
}

interface RecommendationState {
  recommendation: WidgetRecommendation;
  status: RecommendationStatus;
}

const WidgetRecommendationList = ({
  recommendations,
  isLoading,
  isError,
  onRefetch,
  onSelectionChange,
  initialAccepted = [],
}: WidgetRecommendationListProps) => {
  const [states, setStates] = useState<RecommendationState[]>([]);

  // Initialize states when recommendations change
  useEffect(() => {
    if (recommendations.length > 0) {
      const initialStates = recommendations.map((rec) => {
        // Check if this was previously accepted
        const wasAccepted = initialAccepted.some(
          (accepted) => accepted.type === rec.type && accepted.title === rec.title
        );
        
        // Auto-accept high-score recommendations (90+)
        const autoAccept = rec.score >= 90 && !wasAccepted;
        
        return {
          recommendation: rec,
          status: wasAccepted || autoAccept ? 'accepted' : 'pending' as RecommendationStatus,
        };
      });
      setStates(initialStates);
    }
  }, [recommendations]);

  // Notify parent when accepted widgets change
  useEffect(() => {
    const acceptedWidgets = states
      .filter((s) => s.status === 'accepted' || s.status === 'customized')
      .map((s) => s.recommendation);
    onSelectionChange(acceptedWidgets);
  }, [states, onSelectionChange]);

  const updateStatus = (index: number, status: RecommendationStatus) => {
    setStates((prev) =>
      prev.map((state, i) => (i === index ? { ...state, status } : state))
    );
  };

  const acceptAll = () => {
    setStates((prev) =>
      prev.map((state) => ({
        ...state,
        status: 'accepted' as RecommendationStatus,
      }))
    );
  };

  const rejectAll = () => {
    setStates((prev) =>
      prev.map((state) => ({
        ...state,
        status: 'rejected' as RecommendationStatus,
      }))
    );
  };

  const stats = useMemo(() => {
    const accepted = states.filter((s) => s.status === 'accepted' || s.status === 'customized').length;
    const rejected = states.filter((s) => s.status === 'rejected').length;
    const pending = states.filter((s) => s.status === 'pending').length;
    return { accepted, rejected, pending, total: states.length };
  }, [states]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-48" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8 px-4 bg-destructive/5 rounded-lg border border-destructive/20">
        <XCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
        <h3 className="font-medium text-foreground mb-1">Erro ao carregar recomendações</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Não foi possível analisar seus dados. Tente novamente.
        </p>
        <Button variant="outline" size="sm" onClick={onRefetch}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="text-center py-8 px-4 bg-muted/50 rounded-lg border border-border">
        <Wand2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-medium text-foreground mb-1">Nenhuma recomendação disponível</h3>
        <p className="text-sm text-muted-foreground">
          Configure pelo menos 2 mapeamentos de dados para receber recomendações de widgets.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent" />
          <h3 className="font-semibold text-foreground">Recomendações Inteligentes</h3>
          <Badge variant="outline" className="text-xs">
            {stats.total} widgets sugeridos
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={acceptAll}
            disabled={stats.pending === 0 && stats.rejected === 0}
            className="text-success hover:text-success hover:bg-success/10"
          >
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Aceitar Todos
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={rejectAll}
            disabled={stats.accepted === 0 && stats.pending === 0}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <XCircle className="w-4 h-4 mr-1" />
            Limpar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-success" />
          <span className="text-muted-foreground">
            Aceitos: <strong className="text-foreground">{stats.accepted}</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-warning" />
          <span className="text-muted-foreground">
            Pendentes: <strong className="text-foreground">{stats.pending}</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-destructive" />
          <span className="text-muted-foreground">
            Rejeitados: <strong className="text-foreground">{stats.rejected}</strong>
          </span>
        </div>
      </div>

      {/* Recommendation Cards */}
      <div className="space-y-3">
        {states.map((state, index) => (
          <WidgetRecommendationCard
            key={`${state.recommendation.type}-${state.recommendation.title}-${index}`}
            recommendation={state.recommendation}
            status={state.status}
            index={index}
            onAccept={() => updateStatus(index, 'accepted')}
            onReject={() => updateStatus(index, 'rejected')}
          />
        ))}
      </div>

      {/* Minimum widgets warning */}
      {stats.accepted < 3 && (
        <div className={cn(
          'p-4 rounded-lg border flex items-start gap-3',
          stats.accepted === 0 
            ? 'bg-destructive/5 border-destructive/20' 
            : 'bg-warning/5 border-warning/20'
        )}>
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
            stats.accepted === 0 ? 'bg-destructive/10' : 'bg-warning/10'
          )}>
            <span className={cn(
              'text-sm font-bold',
              stats.accepted === 0 ? 'text-destructive' : 'text-warning'
            )}>
              {stats.accepted}
            </span>
          </div>
          <div>
            <p className={cn(
              'text-sm font-medium',
              stats.accepted === 0 ? 'text-destructive' : 'text-warning'
            )}>
              {stats.accepted === 0 
                ? 'Nenhum widget selecionado' 
                : `Apenas ${stats.accepted} widget${stats.accepted > 1 ? 's' : ''} selecionado${stats.accepted > 1 ? 's' : ''}`}
            </p>
            <p className="text-sm text-muted-foreground">
              Recomendamos aceitar pelo menos 3 widgets para criar um dashboard informativo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WidgetRecommendationList;
