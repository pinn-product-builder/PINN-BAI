import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformUserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  org_id: string | null;
  org_name: string | null;
  roles: string[];
  is_active: boolean;
  last_sign_in_at: string | null;
  created_at: string;
}

const SUPABASE_URL = 'https://bkgwzxrutzmmxmxzfhmw.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZ3d6eHJ1dHptbXhteHpmaG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMjc2ODUsImV4cCI6MjA4NTcwMzY4NX0.QlOjmLhKmpiOYr_qm-IDLoSjhE7Z18YKlmin5SFht90';

interface ManageUsersBody {
  action: 'list' | 'reset-password' | 'set-active' | 'update-email';
  userId?: string;
  newPassword?: string;
  isActive?: boolean;
  newEmail?: string;
}

const callManageUsers = async <T>(body: ManageUsersBody): Promise<T> => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error ?? `HTTP ${res.status}`);
  }
  return payload as T;
};

const PLATFORM_USERS_KEY = ['platform-users'];

export const usePlatformUsers = () => {
  return useQuery({
    queryKey: PLATFORM_USERS_KEY,
    queryFn: async (): Promise<PlatformUserRow[]> => {
      const data = await callManageUsers<{ users: PlatformUserRow[] }>({ action: 'list' });
      return data.users ?? [];
    },
    staleTime: 30 * 1000,
  });
};

export const useResetUserPassword = () => {
  return useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      await callManageUsers({ action: 'reset-password', userId, newPassword });
    },
  });
};

export const useSetUserActive = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      await callManageUsers({ action: 'set-active', userId, isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_USERS_KEY });
    },
  });
};

export const useUpdateUserEmail = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, newEmail }: { userId: string; newEmail: string }) => {
      await callManageUsers({ action: 'update-email', userId, newEmail });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_USERS_KEY });
    },
  });
};
