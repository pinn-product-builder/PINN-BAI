import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import type { PlatformSettings } from '@/lib/mock-data';

// Tabela platform_settings ainda não está nos tipos gerados — cast pra unblock.
const supabase = supabaseClient as any;

interface PlatformSettingsRow {
  platform_name: string;
  support_email: string;
  default_plan: number;
  trial_days: number;
  maintenance_mode: boolean;
  allow_new_registrations: boolean;
  enable_notifications: boolean;
  enable_auto_insights: boolean;
  insights_interval: number;
  enable_rls: boolean;
  max_file_size: number;
  log_retention: number;
  updated_at?: string | null;
  updated_by?: string | null;
}

const PLATFORM_SETTINGS_KEY = ['platform-settings'];

const FALLBACK: PlatformSettings = {
  platformName: 'Pinn BAI',
  supportEmail: 'suporte@pinn.com.br',
  defaultPlan: 2,
  trialDays: 14,
  maintenanceMode: false,
  allowNewRegistrations: true,
  enableNotifications: true,
  enableAutoInsights: true,
  insightsInterval: 24,
  enableRLS: true,
  maxFileSize: 50,
  logRetention: 90,
};

const rowToSettings = (r: PlatformSettingsRow): PlatformSettings => ({
  platformName: r.platform_name,
  supportEmail: r.support_email,
  defaultPlan: r.default_plan,
  trialDays: r.trial_days,
  maintenanceMode: r.maintenance_mode,
  allowNewRegistrations: r.allow_new_registrations,
  enableNotifications: r.enable_notifications,
  enableAutoInsights: r.enable_auto_insights,
  insightsInterval: r.insights_interval,
  enableRLS: r.enable_rls,
  maxFileSize: r.max_file_size,
  logRetention: r.log_retention,
});

const settingsToRow = (s: PlatformSettings): Omit<PlatformSettingsRow, 'updated_at' | 'updated_by'> => ({
  platform_name: s.platformName,
  support_email: s.supportEmail,
  default_plan: s.defaultPlan,
  trial_days: s.trialDays,
  maintenance_mode: s.maintenanceMode,
  allow_new_registrations: s.allowNewRegistrations,
  enable_notifications: s.enableNotifications,
  enable_auto_insights: s.enableAutoInsights,
  insights_interval: s.insightsInterval,
  enable_rls: s.enableRLS,
  max_file_size: s.maxFileSize,
  log_retention: s.logRetention,
});

export const usePlatformSettings = () => {
  return useQuery({
    queryKey: PLATFORM_SETTINGS_KEY,
    queryFn: async (): Promise<PlatformSettings> => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('id', true)
        .maybeSingle();

      if (error) {
        // Tabela pode não existir ainda (migração não aplicada). Cai pro fallback.
        console.warn('[usePlatformSettings] falha ao buscar; usando defaults.', error.message);
        return FALLBACK;
      }
      if (!data) return FALLBACK;
      return rowToSettings(data as PlatformSettingsRow);
    },
    staleTime: 60 * 1000,
  });
};

export const useUpdatePlatformSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: PlatformSettings) => {
      const { error } = await supabase
        .from('platform_settings')
        .update({
          ...settingsToRow(settings),
          updated_at: new Date().toISOString(),
        })
        .eq('id', true);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLATFORM_SETTINGS_KEY });
    },
  });
};
