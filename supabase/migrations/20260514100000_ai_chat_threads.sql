-- Histórico do BAI Copilot (AIChat): conversas e mensagens por usuário+org.
--
-- ai_chat_threads: 1 linha por conversa. Identificada pelo título (gerado a partir
-- da primeira pergunta) e pertencente a um (org_id, user_id).
--
-- ai_chat_messages: mensagens (user/assistant) dentro de uma thread.
-- rating opcional permite thumbs up/down no lado assistant.

CREATE TABLE IF NOT EXISTS public.ai_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_chat_threads_org_user_idx
  ON public.ai_chat_threads (org_id, user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.ai_chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  rating SMALLINT CHECK (rating IS NULL OR rating IN (-1, 0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_chat_messages_thread_idx
  ON public.ai_chat_messages (thread_id, created_at ASC);

-- RLS: usuário só vê suas próprias threads (escopadas pela sua org).
ALTER TABLE public.ai_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_chat_threads_owner"
  ON public.ai_chat_threads FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ai_chat_messages_via_thread"
  ON public.ai_chat_messages FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_chat_threads t
      WHERE t.id = thread_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_chat_threads t
      WHERE t.id = thread_id AND t.user_id = auth.uid()
    )
  );

-- Trigger: updated_at na thread quando uma mensagem é inserida.
CREATE OR REPLACE FUNCTION public.touch_ai_chat_thread()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.ai_chat_threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_chat_messages_touch_thread ON public.ai_chat_messages;
CREATE TRIGGER ai_chat_messages_touch_thread
  AFTER INSERT ON public.ai_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_ai_chat_thread();

COMMENT ON TABLE public.ai_chat_threads IS 'BAI Copilot — uma conversa por user+org.';
COMMENT ON TABLE public.ai_chat_messages IS 'BAI Copilot — mensagens dentro de threads.';
