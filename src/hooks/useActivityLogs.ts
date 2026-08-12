import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ActivityLog } from '@/lib/types';
import type { Json } from '@/integrations/supabase/types';

// Fetch activity logs for an organization
export const useActivityLogs = (
  orgId: string | undefined,
  options?: {
    limit?: number;
    entityType?: string;
    startDate?: string;
    endDate?: string;
  }
) => {
  const limit = options?.limit || 50;

  return useQuery({
    queryKey: ['activity-logs', orgId, options],
    queryFn: async (): Promise<ActivityLog[]> => {
      if (!orgId) return [];

      let query = supabase
        .from('activity_logs')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (options?.entityType) {
        query = query.eq('entity_type', options.entityType);
      }

      if (options?.startDate) {
        query = query.gte('created_at', options.startDate);
      }

      if (options?.endDate) {
        query = query.lte('created_at', options.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });
};

// Fetch platform-wide activity logs (for platform admins)
export const usePlatformActivityLogs = (options?: {
  limit?: number;
  entityType?: string;
  startDate?: string;
  endDate?: string;
}) => {
  const limit = options?.limit || 100;

  return useQuery({
    queryKey: ['platform-activity-logs', options],
    queryFn: async (): Promise<ActivityLog[]> => {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (options?.entityType) {
        query = query.eq('entity_type', options.entityType);
      }

      if (options?.startDate) {
        query = query.gte('created_at', options.startDate);
      }

      if (options?.endDate) {
        query = query.lte('created_at', options.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });
};

// Create activity log
export const useCreateActivityLog = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (log: {
      org_id?: string | null;
      user_id?: string | null;
      action: string;
      entity_type?: string | null;
      entity_id?: string | null;
      details?: Json;
      ip_address?: string | null;
    }): Promise<ActivityLog> => {
      const { data, error } = await supabase
        .from('activity_logs')
        .insert({
          org_id: log.org_id,
          user_id: log.user_id,
          action: log.action,
          entity_type: log.entity_type,
          entity_id: log.entity_id,
          details: log.details || {},
          ip_address: log.ip_address,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.org_id) {
        queryClient.invalidateQueries({ queryKey: ['activity-logs', data.org_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['platform-activity-logs'] });
    },
  });
};

// Helper function to log activity
export const logActivity = async (
  action: string,
  entityType: string | null,
  entityId: string | null,
  details: Json = {},
  orgId?: string | null
) => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from('activity_logs').insert({
    org_id: orgId,
    user_id: user.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  });
};
