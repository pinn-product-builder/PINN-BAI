import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useAchievementDefinitions, useMyAchievements, useOrgAchievements,
  useOrgXpRanking, useCheckAchievements,
} from '@/hooks/useGamification';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Medal, Star, Users, Loader2, Lock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Helpers ─────────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG = {
  sales:     { label: 'Vendas',    color: 'bg-blue-500/10 text-blue-500' },
  quality:   { label: 'Qualidade', color: 'bg-purple-500/10 text-purple-500' },
  growth:    { label: 'Crescimento', color: 'bg-emerald-500/10 text-emerald-500' },
  retention: { label: 'Retenção',  color: 'bg-amber-500/10 text-amber-500' },
};

const RANK_ICONS = ['🥇', '🥈', '🥉'];

function XpBar({ xp, maxXp = 1000 }: { xp: number; maxXp?: number }) {
  const pct = Math.min(100, Math.round((xp / maxXp) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{xp} XP</span>
        <span>{maxXp} XP</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Achievement Card ─────────────────────────────────────────────────────────────

function AchievementCard({
  def,
  earned,
  earnedAt,
}: {
  def: { id: string; name: string; description: string; icon: string; xp: number; category: string };
  earned: boolean;
  earnedAt?: string;
}) {
  const catCfg = CATEGORY_CONFIG[def.category as keyof typeof CATEGORY_CONFIG] ?? CATEGORY_CONFIG.sales;

  return (
    <div className={cn(
      'relative rounded-xl border p-4 transition-all',
      earned
        ? 'border-primary/30 bg-primary/5 shadow-sm'
        : 'border-border/40 bg-muted/20 opacity-50 grayscale',
    )}>
      {!earned && (
        <Lock className="absolute top-3 right-3 w-3.5 h-3.5 text-muted-foreground" />
      )}
      <div className="flex items-start gap-3">
        <div className={cn(
          'text-2xl w-11 h-11 rounded-lg flex items-center justify-center shrink-0',
          earned ? 'bg-primary/10' : 'bg-muted',
        )}>
          {def.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{def.name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{def.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge className={cn('text-[10px] px-1.5', catCfg.color)}>{catCfg.label}</Badge>
            <span className="text-[10px] font-semibold text-primary">+{def.xp} XP</span>
            {earned && earnedAt && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {format(new Date(earnedAt), 'dd/MM/yy', { locale: ptBR })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Gamification() {
  const { orgId } = useParams<{ orgId: string }>();
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const { toast } = useToast();
  const { data: definitions = [] } = useAchievementDefinitions();
  const { data: myAchievements = [], isLoading: loadingMine } = useMyAchievements(orgId);
  const { data: xpRanking = [], isLoading: loadingRanking } = useOrgXpRanking(orgId);
  const checkAchievements = useCheckAchievements();

  const handleCheck = async () => {
    if (!orgId) return;
    try {
      const r = await checkAchievements.mutateAsync(orgId);
      toast({ title: r.granted > 0 ? `🎉 ${r.granted} nova(s) conquista(s) desbloqueada(s)!` : 'Nenhuma conquista nova por enquanto.' });
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao verificar conquistas.' });
    }
  };

  const earnedIds = new Set(myAchievements.map(a => a.achievement_id));
  const myXp = myAchievements.reduce(
    (s, a) => s + ((a.achievement_definitions as any)?.xp ?? 0), 0
  );
  const totalXpPossible = definitions.reduce((s, d) => s + d.xp, 0);

  const filteredDefs = activeCategory === 'all'
    ? definitions
    : definitions.filter(d => d.category === activeCategory);

  const categories = ['all', 'sales', 'quality', 'growth', 'retention'];
  const categoryLabels: Record<string, string> = {
    all: 'Todas', ...Object.fromEntries(
      Object.entries(CATEGORY_CONFIG).map(([k, v]) => [k, v.label])
    ),
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-500" />
          Conquistas & Ranking
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Desbloqueie conquistas e suba no ranking do time.
        </p>
        </div>
      <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={handleCheck} disabled={checkAchievements.isPending}>
        {checkAchievements.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        Verificar Conquistas
      </Button>
      </div>

      {/* My progress */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="sm:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl shadow-md shrink-0">
                🏆
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-lg">{myXp} XP Total</p>
                  <Badge className="bg-amber-500/10 text-amber-500">
                    {myAchievements.length} / {definitions.length} conquistas
                  </Badge>
                </div>
                <XpBar xp={myXp} maxXp={Math.max(totalXpPossible, 100)} />
                <p className="text-xs text-muted-foreground">
                  {definitions.length - myAchievements.length} conquistas ainda não desbloqueadas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recentes</p>
            {loadingMine ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : myAchievements.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma conquista ainda.</p>
            ) : (
              myAchievements.slice(0, 3).map(a => (
                <div key={a.id} className="flex items-center gap-2">
                  <span className="text-xl">{(a.achievement_definitions as any)?.icon ?? '🏅'}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{(a.achievement_definitions as any)?.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(a.earned_at), 'dd/MM/yy', { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="achievements">
        <TabsList>
          <TabsTrigger value="achievements" className="gap-2">
            <Star className="w-4 h-4" /> Conquistas
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-2">
            <Users className="w-4 h-4" /> Ranking do Time
          </TabsTrigger>
        </TabsList>

        {/* Achievements tab */}
        <TabsContent value="achievements" className="mt-4 space-y-4">
          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'h-7 px-3 rounded-full text-xs font-medium transition-colors',
                  activeCategory === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {categoryLabels[cat]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredDefs.map(def => {
              const earned = earnedIds.has(def.id);
              const earnedRecord = myAchievements.find(a => a.achievement_id === def.id);
              return (
                <AchievementCard
                  key={def.id}
                  def={def}
                  earned={earned}
                  earnedAt={earnedRecord?.earned_at}
                />
              );
            })}
          </div>
        </TabsContent>

        {/* Ranking tab */}
        <TabsContent value="ranking" className="mt-4">
          {loadingRanking ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : xpRanking.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Medal className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Ranking vazio</p>
              <p className="text-sm mt-1">Desbloqueie conquistas para aparecer no ranking.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {xpRanking.map((entry) => (
                <div
                  key={entry.user_id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-all',
                    entry.rank <= 3 ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/50',
                  )}
                >
                  <div className="w-7 text-center shrink-0">
                    {entry.rank <= 3
                      ? <span className="text-xl">{RANK_ICONS[entry.rank - 1]}</span>
                      : <span className="text-sm font-bold text-muted-foreground">#{entry.rank}</span>
                    }
                  </div>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: `hsl(${entry.user_id.charCodeAt(0) * 137}deg 60% 50%)`, color: 'white' }}
                  >
                    {entry.avatar_initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{entry.display_name}</p>
                    <p className="text-xs text-muted-foreground">{entry.achievements} conquistas</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-primary">{entry.xp} XP</p>
                    <XpBar xp={entry.xp} maxXp={Math.max(...xpRanking.map(e => e.xp), 100)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
