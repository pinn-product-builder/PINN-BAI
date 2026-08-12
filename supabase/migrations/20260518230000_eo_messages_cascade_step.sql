-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Fix: permitir DELETE de campanhas mesmo com mensagens históricas        ║
-- ║                                                                          ║
-- ║  Bug: tentar deletar uma eo_campaigns dá 500 com FK violation 23503:     ║
-- ║    "update or delete on table eo_sequence_steps violates foreign key     ║
-- ║     constraint eo_messages_sequence_step_id_fkey on table eo_messages"   ║
-- ║                                                                          ║
-- ║  Causa: eo_messages.sequence_step_id é ON DELETE RESTRICT. Quando o      ║
-- ║  cascade da campanha tenta deletar os steps, o RESTRICT bloqueia mesmo   ║
-- ║  que as messages eventualmente seriam removidas pela outra via cascade   ║
-- ║  (via campaign_lead_id). A ordem das ações de cascade não é garantida.   ║
-- ║                                                                          ║
-- ║  Fix: trocar para ON DELETE CASCADE. Deletar uma campanha agora limpa    ║
-- ║  tudo: steps, inboxes_vinculadas, campaign_leads, messages, events.      ║
-- ║                                                                          ║
-- ║  Auditoria histórica: quem precisa preservar (compliance) deve usar      ║
-- ║  status='archived' em eo_campaigns em vez de DELETE.                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table public.eo_messages
  drop constraint if exists eo_messages_sequence_step_id_fkey;

alter table public.eo_messages
  add constraint eo_messages_sequence_step_id_fkey
    foreign key (sequence_step_id)
    references public.eo_sequence_steps(id)
    on delete cascade;

comment on constraint eo_messages_sequence_step_id_fkey on public.eo_messages is
  'CASCADE: ao deletar um sequence_step (ou a campanha que o contém), as messages dele somem juntas. Para preservar auditoria, usar archive em vez de delete.';
