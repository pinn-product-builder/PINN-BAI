import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase as supabaseClient } from '@/integrations/supabase/client';

// Tabela ainda não está nos tipos gerados — cast pra desbloquear.
const supabase = supabaseClient as any;

export interface ChatThread {
  id: string;
  org_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  rating: -1 | 0 | 1 | null;
  created_at: string;
}

const threadsKey = (orgId: string | null | undefined, userId: string | null | undefined) =>
  ['ai-chat-threads', orgId ?? null, userId ?? null];

const messagesKey = (threadId: string | null | undefined) =>
  ['ai-chat-messages', threadId ?? null];

/** Lista as threads do usuário corrente nesta org, mais recentes primeiro (até 20). */
export const useChatThreads = (orgId: string | null | undefined, userId: string | null | undefined) =>
  useQuery({
    queryKey: threadsKey(orgId, userId),
    enabled: !!orgId && !!userId,
    queryFn: async (): Promise<ChatThread[]> => {
      const { data, error } = await supabase
        .from('ai_chat_threads')
        .select('*')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(20);
      if (error) {
        console.warn('[useChatThreads] falha:', error.message);
        return [];
      }
      return (data ?? []) as ChatThread[];
    },
    staleTime: 30 * 1000,
  });

/** Carrega mensagens de uma thread em ordem cronológica. */
export const useChatMessages = (threadId: string | null | undefined) =>
  useQuery({
    queryKey: messagesKey(threadId),
    enabled: !!threadId,
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from('ai_chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      if (error) {
        console.warn('[useChatMessages] falha:', error.message);
        return [];
      }
      return (data ?? []) as ChatMessage[];
    },
  });

/** Cria uma nova thread. Título inicial é "Nova conversa" — pode ser renomeada depois. */
export const useCreateThread = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, userId, title }: { orgId: string; userId: string; title?: string }): Promise<ChatThread> => {
      const { data, error } = await supabase
        .from('ai_chat_threads')
        .insert({ org_id: orgId, user_id: userId, title: title ?? 'Nova conversa' })
        .select()
        .single();
      if (error) throw error;
      return data as ChatThread;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: threadsKey(vars.orgId, vars.userId) });
    },
  });
};

/** Renomeia uma thread (chamado quando a primeira pergunta vira título). */
export const useUpdateThreadTitle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, title }: { threadId: string; title: string }) => {
      const { error } = await supabase
        .from('ai_chat_threads')
        .update({ title })
        .eq('id', threadId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-chat-threads'] });
    },
  });
};

/** Apaga uma thread (e suas mensagens via cascade). */
export const useDeleteThread = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase
        .from('ai_chat_threads')
        .delete()
        .eq('id', threadId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-chat-threads'] });
    },
  });
};

/** Salva uma mensagem (user ou assistant). */
export const useSaveMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      threadId,
      role,
      content,
    }: {
      threadId: string;
      role: 'user' | 'assistant';
      content: string;
    }): Promise<ChatMessage> => {
      const { data, error } = await supabase
        .from('ai_chat_messages')
        .insert({ thread_id: threadId, role, content })
        .select()
        .single();
      if (error) throw error;
      return data as ChatMessage;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: messagesKey(data.thread_id) });
    },
  });
};

/** Atualiza rating (thumbs up/down) de uma mensagem do assistant. */
export const useRateMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, rating }: { messageId: string; rating: -1 | 0 | 1 }) => {
      const { error } = await supabase
        .from('ai_chat_messages')
        .update({ rating })
        .eq('id', messageId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-chat-messages'] });
    },
  });
};
