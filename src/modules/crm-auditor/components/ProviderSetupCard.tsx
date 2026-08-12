import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Visibility, VisibilityOff, Save, Sync, CheckCircleOutline, ErrorOutline } from '@mui/icons-material';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PROVIDER_SCHEMAS, SECRET_PLACEHOLDER, type ProviderSchema } from '../providerSchemas';

type Credentials = Record<string, string | undefined>;

interface ConnRow {
  id: string;
  tenant_id: string;
  credentials: Credentials | null;
  sync_status: string;
  sync_error: string | null;
  last_sync_at: string | null;
}

interface Props {
  orgId: string;
  provider: string;
}

const qk = (orgId: string, provider: string) => ['crm-auditor', orgId, provider] as const;

/**
 * Card genérico de setup para providers CRM/ERP do tipo "API key" — renderiza
 * form, persistência e sync baseado no schema em providerSchemas.ts. Substitui
 * PloomesSetupSection e OmieSetupSection (Kommo segue à parte, OAuth).
 */
export function ProviderSetupCard({ orgId, provider }: Props) {
  const schema: ProviderSchema | undefined = PROVIDER_SCHEMAS[provider.toLowerCase()];
  if (!schema) return null;

  return <ProviderSetupCardInner orgId={orgId} schema={schema} />;
}

function ProviderSetupCardInner({ orgId, schema }: { orgId: string; schema: ProviderSchema }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [values, setValues] = useState<Credentials>({});
  const [shownSecrets, setShownSecrets] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  const conn = useQuery<ConnRow | null>({
    queryKey: qk(orgId, schema.key),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('crm_auditor_connections')
        .select('id, tenant_id, credentials, sync_status, sync_error, last_sync_at')
        .eq('tenant_id', orgId)
        .eq('provider', schema.key)
        .maybeSingle();
      if (error) {
        console.warn(`[ProviderSetup:${schema.key}] fetch falhou:`, error.message);
        return null;
      }
      return data as ConnRow | null;
    },
    enabled: !!orgId,
  });

  // Inicializa form com mascaramento de senhas e valores texto reais.
  useEffect(() => {
    if (dirty) return;
    const next: Credentials = {};
    for (const f of schema.fields) {
      const stored = conn.data?.credentials?.[f.key];
      if (f.type === 'password') {
        next[f.key] = stored ? SECRET_PLACEHOLDER : '';
      } else {
        next[f.key] = stored ?? '';
      }
    }
    setValues(next);
  }, [conn.data, dirty, schema]);

  const save = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const merged: Credentials = { ...(conn.data?.credentials ?? {}) };
      for (const f of schema.fields) {
        const v = (values[f.key] ?? '').trim();
        if (f.type === 'password' && v === SECRET_PLACEHOLDER) continue; // preserva
        merged[f.key] = v;
      }
      const wasConnected = schema.fields
        .filter((f) => f.required)
        .every((f) => !!conn.data?.credentials?.[f.key]);
      if (conn.data?.id) {
        const { error } = await sb
          .from('crm_auditor_connections')
          .update({ credentials: merged, sync_error: null })
          .eq('id', conn.data.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('crm_auditor_connections').insert({
          tenant_id: orgId,
          provider: schema.key,
          credentials: merged,
          sync_status: 'idle',
        });
        if (error) throw error;
      }
      return { wasConnected };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: qk(orgId, schema.key) });
      qc.invalidateQueries({ queryKey: ['crm-auditor', orgId, 'connections-summary'] });
      setDirty(false);
      // Restaura placeholders dos password fields
      setValues((v) => {
        const next = { ...v };
        for (const f of schema.fields) if (f.type === 'password' && next[f.key]) next[f.key] = SECRET_PLACEHOLDER;
        return next;
      });
      toast({
        title: `${schema.displayName}: credenciais salvas`,
        description: result?.wasConnected
          ? undefined
          : 'Buscando seus dados agora… você pode acompanhar abaixo.',
      });
      // Dispara sync imediato — primeira conexão OU re-save (credenciais mudaram).
      // Não bloqueia o save; toast já confirmou.
      void syncNow.mutateAsync().catch(() => { /* erro já é toast via onError */ });
    },
    onError: (err: Error) =>
      toast({ variant: 'destructive', title: 'Falha ao salvar', description: err.message }),
  });

  const syncNow = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(schema.syncFunction, {
        body: { org_id: orgId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk(orgId, schema.key) });
      // Tenta extrair número sincronizado pra mostrar no toast.
      const synced = (data as { synced?: Record<string, number> | undefined })?.synced;
      const summary = synced ? Object.entries(synced).map(([k, v]) => `${v} ${k}`).join(', ') : null;
      toast({ title: `${schema.displayName}: sync disparado`, description: summary ?? undefined });
    },
    onError: (err: Error) =>
      toast({ variant: 'destructive', title: 'Sync falhou', description: err.message }),
  });

  const isConnected = schema.fields
    .filter((f) => f.required)
    .every((f) => !!conn.data?.credentials?.[f.key]);
  const status = conn.data?.sync_status ?? 'idle';

  const requiredFilled = schema.fields
    .filter((f) => f.required)
    .every((f) => {
      const v = (values[f.key] ?? '').trim();
      return f.type === 'password' ? !!v : !!v;
    });

  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 2, borderRadius: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Integração {schema.displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {schema.blurb}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {isConnected ? (
              <Chip
                size="small"
                icon={status === 'error' ? <ErrorOutline /> : <CheckCircleOutline />}
                color={status === 'error' ? 'error' : status === 'success' ? 'success' : 'default'}
                label={
                  status === 'error' ? 'Erro na última sync'
                  : status === 'success' ? 'Sincronizado'
                  : status === 'syncing' ? 'Sincronizando…'
                  : 'Pronto'
                }
              />
            ) : (
              <Chip size="small" label="Sem credenciais" />
            )}
          </Stack>
        </Stack>

        {conn.data?.sync_error && status === 'error' && (
          <Alert severity="error" variant="outlined" sx={{ py: 0.5 }}>
            <Typography variant="caption" sx={{ wordBreak: 'break-word' }}>{conn.data.sync_error}</Typography>
          </Alert>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          {schema.fields.map((f) => {
            const isPassword = f.type === 'password';
            const inputType = isPassword && !shownSecrets[f.key] ? 'password' : 'text';
            return (
              <TextField
                key={f.key}
                label={f.label}
                value={values[f.key] ?? ''}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [f.key]: e.target.value }));
                  setDirty(true);
                }}
                type={inputType}
                fullWidth
                size="small"
                placeholder={f.placeholder}
                InputProps={isPassword ? {
                  endAdornment: (
                    <IconButton size="small" edge="end" onClick={() => setShownSecrets((s) => ({ ...s, [f.key]: !s[f.key] }))}>
                      {shownSecrets[f.key] ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  ),
                } : undefined}
              />
            );
          })}
        </Stack>

        {schema.helpUrl && (
          <Typography variant="caption" color="text.secondary">
            Onde achar:{' '}
            <a href={schema.helpUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
              documentação {schema.displayName}
            </a>
            .
          </Typography>
        )}

        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <Button
            variant="contained"
            startIcon={<Save />}
            disabled={!dirty || save.isPending || !requiredFilled}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Salvando…' : 'Salvar credenciais'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Sync />}
            disabled={!isConnected || syncNow.isPending}
            onClick={() => syncNow.mutate()}
          >
            {syncNow.isPending ? 'Sincronizando…' : 'Sincronizar agora'}
          </Button>
        </Stack>

        {conn.data?.last_sync_at && (
          <Typography variant="caption" color="text.secondary">
            Última sync: {new Date(conn.data.last_sync_at).toLocaleString('pt-BR')}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

export default ProviderSetupCard;
