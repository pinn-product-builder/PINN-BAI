import { supabase } from '@/integrations/supabase/client';

/**
 * Registra um evento na trilha LGPD (`activity_logs`).
 *
 * Use em qualquer operação que toque dado pessoal: visualizar lista de leads,
 * exportar CSV, editar contato, mudar permissão, etc. A RPC `log_event` grava
 * com a forma exigida pela LGPD: ação + finalidade + escopo de PII tocado.
 *
 * Fire-and-forget — falhas logam no console mas não interrompem a UI.
 */
export interface AuditLogInput {
  orgId: string;
  action: string;
  purpose: 'view' | 'export' | 'edit' | 'delete' | 'consent_change' | 'sync' | 'access';
  entityType?: string;
  entityId?: string;
  /** Campos pessoais tocados, ex: ['email', 'phone', 'cpf']. */
  fields?: string[];
  /** Quantidade de registros com PII envolvidos (útil em exports em massa). */
  piiCount?: number;
  source?: 'ui' | 'api' | 'job' | 'edge_function' | 'import';
}

export async function logAuditEvent(input: AuditLogInput): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc('log_event', {
      _org_id: input.orgId,
      _action: input.action,
      _entity_type: input.entityType ?? null,
      _entity_id: input.entityId ?? null,
      _purpose: input.purpose,
      _data_scope: {
        entities: input.entityType ? [input.entityType] : [],
        fields: input.fields ?? [],
        pii_count: input.piiCount ?? 0,
      },
      _source: input.source ?? 'ui',
    });
  } catch (err) {
    console.warn('[auditLog] falha ao registrar evento (não bloqueia UI):', err);
  }
}
