import { useCallback, useEffect, useRef, useState } from 'react';
import type { Layouts } from 'react-grid-layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_VERSION = 'v1';

interface UseDashboardLayoutArgs {
  /** Identifica a página/grid. Ex: 'arguto:snapshot', 'unit-economics'. */
  pageKey: string;
  /** Org dona do layout (multi-tenant). Sem org_id, salva só local. */
  orgId?: string | null;
}

interface UseDashboardLayoutReturn {
  layouts: Layouts | null;
  isReady: boolean;
  saveLayouts: (next: Layouts) => void;
  resetLayouts: () => void;
}

function localKey(pageKey: string, orgId: string | null | undefined) {
  return `pinn:layout:${orgId ?? 'global'}:${pageKey}:${STORAGE_VERSION}`;
}

function readLocal(pageKey: string, orgId: string | null | undefined): Layouts | null {
  try {
    const raw = window.localStorage.getItem(localKey(pageKey, orgId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Layouts) : null;
  } catch {
    return null;
  }
}

function writeLocal(pageKey: string, orgId: string | null | undefined, layouts: Layouts) {
  try {
    window.localStorage.setItem(localKey(pageKey, orgId), JSON.stringify(layouts));
  } catch {
    /* localStorage pode estar cheio ou bloqueado */
  }
}

/**
 * Hook genérico de persistência de layout drag/drop.
 *
 * Estratégia híbrida:
 * 1. Lê PRIMEIRO o localStorage (UI instantânea, sem flicker).
 * 2. Em paralelo, tenta puxar do Supabase. Se a tabela existir e a row
 *    estiver mais recente, sobrescreve o local.
 * 3. Save: escreve local imediatamente + faz upsert no Supabase async.
 *    Se Supabase falhar (tabela ainda não migrada, offline, RLS), o
 *    local segue funcionando — sem quebrar UX.
 */
export function useDashboardLayout(
  { pageKey, orgId }: UseDashboardLayoutArgs,
): UseDashboardLayoutReturn {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [layouts, setLayouts] = useState<Layouts | null>(() => readLocal(pageKey, orgId));
  const [isReady, setIsReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Initial load: tenta Supabase, fallback no localStorage. ───────
  useEffect(() => {
    let active = true;
    setIsReady(false);

    const local = readLocal(pageKey, orgId);
    if (local) setLayouts(local);

    if (!userId || !orgId) {
      setIsReady(true);
      return () => { active = false; };
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from('user_widget_layouts')
          .select('layouts')
          .eq('user_id', userId)
          .eq('org_id', orgId)
          .eq('page_key', pageKey)
          .maybeSingle();

        if (!active) return;

        if (error) {
          // Tabela pode não existir ainda (migration pendente) — segue local.
          setIsReady(true);
          return;
        }

        if (data?.layouts && typeof data.layouts === 'object') {
          setLayouts(data.layouts as Layouts);
          writeLocal(pageKey, orgId, data.layouts as Layouts);
        }
      } catch {
        /* network/auth error — segue só com localStorage */
      } finally {
        if (active) setIsReady(true);
      }
    })();

    return () => { active = false; };
  }, [userId, orgId, pageKey]);

  const persistRemote = useCallback(
    (next: Layouts) => {
      if (!userId || !orgId) return;
      // Debounce 500ms pra não martelar Supabase a cada drag tick.
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await supabase.from('user_widget_layouts').upsert(
            {
              user_id: userId,
              org_id: orgId,
              page_key: pageKey,
              layouts: next as unknown as object,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,org_id,page_key' },
          );
        } catch {
          /* offline / RLS / tabela ausente — local já salvou, OK */
        }
      }, 500);
    },
    [userId, orgId, pageKey],
  );

  const saveLayouts = useCallback(
    (next: Layouts) => {
      setLayouts(next);
      writeLocal(pageKey, orgId, next);
      persistRemote(next);
    },
    [pageKey, orgId, persistRemote],
  );

  const resetLayouts = useCallback(() => {
    setLayouts(null);
    try { window.localStorage.removeItem(localKey(pageKey, orgId)); } catch { /* noop */ }
    if (userId && orgId) {
      supabase
        .from('user_widget_layouts')
        .delete()
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .eq('page_key', pageKey)
        .then(() => { /* noop */ });
    }
  }, [pageKey, orgId, userId]);

  // Cleanup do debounce timer no unmount.
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  return { layouts, isReady, saveLayouts, resetLayouts };
}
