/**
 * useAiPrompts — versionamento de prompts da IA (tabela `ai_prompts`).
 * A versão ativa de cada prompt_key é lida pela edge function ai-data-chat.
 * Admin gerencia em /admin/ai-prompts sem deploy; histórico fica para rollback.
 *
 * Reconstruído fielmente a partir do bundle de produção
 * (dist/assets/index-*.js, build de 05/jul/2026).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AiPrompt {
  id: string;
  prompt_key: string;
  version: number;
  title: string;
  body: string;
  description: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at: string;
}

export interface CreatePromptVersionInput {
  prompt_key: string;
  title: string;
  body: string;
  description?: string;
  /** Quando true, a nova versão já nasce ativa. */
  activate?: boolean;
}

// `ai_prompts` não está nos types gerados do Supabase (padrão da casa: cast local).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const promptsTable = () => (supabase as any).from("ai_prompts");

export function useAiPrompts() {
  return useQuery({
    queryKey: ["ai-prompts"],
    queryFn: async (): Promise<AiPrompt[]> => {
      const { data, error } = await promptsTable()
        .select("*")
        .order("prompt_key", { ascending: true })
        .order("version", { ascending: false });
      if (error) {
        console.warn("[useAiPrompts] fetch falhou:", error.message);
        return [];
      }
      return (data ?? []) as AiPrompt[];
    },
    staleTime: 30 * 1000,
  });
}

export function useCreatePromptVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePromptVersionInput): Promise<AiPrompt> => {
      // Próxima versão = maior versão existente do prompt_key + 1.
      const { data: latest } = await promptsTable()
        .select("version")
        .eq("prompt_key", input.prompt_key)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextVersion = (latest?.version ?? 0) + 1;
      const { data, error } = await promptsTable()
        .insert({
          prompt_key: input.prompt_key,
          version: nextVersion,
          title: input.title,
          body: input.body,
          description: input.description ?? null,
          is_active: !!input.activate,
        })
        .select()
        .single();
      if (error) throw error;
      return data as AiPrompt;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-prompts"] }),
  });
}

export function useActivatePromptVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // A desativação das demais versões do mesmo prompt_key é feita no banco
      // (trigger/única ativa) — aqui só promovemos a versão escolhida.
      const { error } = await promptsTable().update({ is_active: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-prompts"] }),
  });
}
