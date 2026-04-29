import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp: number;
  category: 'sales' | 'quality' | 'growth' | 'retention';
}

export interface UserAchievement {
  id: string;
  org_id: string;
  user_id: string;
  achievement_id: string;
  earned_at: string;
  achievement_definitions?: AchievementDefinition;
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_initial: string;
  metric_key: string;
  value: number;
  rank: number;
  xp_total: number;
}

// ── Achievements ──────────────────────────────────────────────────────────────

export const useAchievementDefinitions = () =>
  useQuery({
    queryKey: ['achievement-definitions'],
    queryFn: async (): Promise<AchievementDefinition[]> => {
      const { data, error } = await supabase
        .from('achievement_definitions')
        .select('*')
        .order('xp', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AchievementDefinition[];
    },
    staleTime: 30 * 60 * 1000,
  });

export const useMyAchievements = (orgId: string | undefined) => {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['my-achievements', orgId, profile?.id],
    queryFn: async (): Promise<UserAchievement[]> => {
      if (!orgId || !profile?.id) return [];
      const { data, error } = await supabase
        .from('user_achievements')
        .select('*, achievement_definitions(*)')
        .eq('org_id', orgId)
        .eq('user_id', profile.id)
        .order('earned_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as UserAchievement[];
    },
    enabled: !!orgId && !!profile?.id,
    staleTime: 5 * 60 * 1000,
  });
};

export const useOrgAchievements = (orgId: string | undefined) =>
  useQuery({
    queryKey: ['org-achievements', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('user_achievements')
        .select('user_id, achievement_id, earned_at, achievement_definitions(xp, name, icon)')
        .eq('org_id', orgId)
        .order('earned_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

export const useGrantAchievement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orgId, userId, achievementId,
    }: { orgId: string; userId: string; achievementId: string }) => {
      const { data, error } = await supabase
        .from('user_achievements')
        .upsert({ org_id: orgId, user_id: userId, achievement_id: achievementId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['my-achievements', vars.orgId] });
      qc.invalidateQueries({ queryKey: ['org-achievements', vars.orgId] });
    },
  });
};

// ── Leaderboard ────────────────────────────────────────────────────────────────

export const useLeaderboard = (
  orgId: string | undefined,
  periodType: 'week' | 'month' = 'month',
) =>
  useQuery({
    queryKey: ['leaderboard', orgId, periodType],
    queryFn: async () => {
      if (!orgId) return [];

      const now = new Date();
      let periodKey: string;
      if (periodType === 'month') {
        periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      } else {
        // ISO week
        const jan1 = new Date(now.getFullYear(), 0, 1);
        const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
        periodKey = `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
      }

      const { data, error } = await supabase
        .from('leaderboard_entries')
        .select('user_id, metric_key, value, rank')
        .eq('org_id', orgId)
        .eq('period_type', periodType)
        .eq('period_key', periodKey)
        .order('rank', { ascending: true })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

// ── XP per user in org ────────────────────────────────────────────────────────

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000';

export const useCheckAchievements = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string) => {
      const resp = await fetch(`${BACKEND}/kpi/achievements/check/${orgId}`, { method: 'POST' });
      if (!resp.ok) throw new Error('Falha ao verificar conquistas');
      return resp.json() as Promise<{ checked_members: number; granted: number }>;
    },
    onSuccess: (_, orgId) => {
      qc.invalidateQueries({ queryKey: ['my-achievements', orgId] });
      qc.invalidateQueries({ queryKey: ['org-achievements', orgId] });
      qc.invalidateQueries({ queryKey: ['org-xp-ranking', orgId] });
    },
  });
};

export const useOrgXpRanking = (orgId: string | undefined) =>
  useQuery({
    queryKey: ['org-xp-ranking', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      // Join achievements with their XP
      const { data, error } = await supabase
        .from('user_achievements')
        .select('user_id, achievement_definitions(xp, icon, name)')
        .eq('org_id', orgId);
      if (error) throw error;

      const xpByUser: Record<string, { xp: number; count: number }> = {};
      for (const row of data ?? []) {
        const uid = row.user_id;
        const xp = (row.achievement_definitions as any)?.xp ?? 0;
        if (!xpByUser[uid]) xpByUser[uid] = { xp: 0, count: 0 };
        xpByUser[uid].xp += xp;
        xpByUser[uid].count++;
      }

      // Fetch profiles for display names
      const userIds = Object.keys(xpByUser);
      if (!userIds.length) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      return Object.entries(xpByUser)
        .sort((a, b) => b[1].xp - a[1].xp)
        .map(([userId, stats], i) => {
          const profile = profiles?.find(p => p.id === userId);
          return {
            rank: i + 1,
            user_id: userId,
            display_name: profile?.full_name ?? 'Usuário',
            avatar_initial: (profile?.full_name ?? 'U').charAt(0).toUpperCase(),
            xp: stats.xp,
            achievements: stats.count,
          };
        });
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
