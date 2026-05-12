import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
const supabase = supabaseClient as any;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Loader2, ExternalLink, ShieldCheck, AlertCircle, RefreshCw, CheckCircle2, Trash2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSyncAdPlatform } from '@/hooks/usePaidTraffic';

type PlatformSlug = 'meta_ads' | 'google_ads';

type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'password';
  required?: boolean;
  helper?: string;
};

const PLATFORMS: Record<PlatformSlug, {
  name: string;
  emoji: string;
  description: string;
  docsUrl: string;
  docsLabel: string;
  fields: FieldDef[];
}> = {
  meta_ads: {
    name: 'Meta Ads',
    emoji: '🔵',
    description: 'Conecte sua conta de anúncios do Facebook/Instagram para sincronizar campanhas, gastos, leads e ROAS.',
    docsUrl: 'https://developers.facebook.com/docs/marketing-api/get-started',
    docsLabel: 'Como obter access_token e ad_account_id',
    fields: [
      { key: 'access_token', label: 'Access Token', type: 'password', required: true, helper: 'Token de longa duração com permissão ads_read.' },
      { key: 'ad_account_id', label: 'Ad Account ID', placeholder: '123456789 (sem o prefixo act_)', required: true, helper: 'Encontre em Gerenciador de Anúncios → Configurações da conta.' },
    ],
  },
  google_ads: {
    name: 'Google Ads',
    emoji: '🔴',
    description: 'Conecte sua conta Google Ads via OAuth refresh token para sincronizar campanhas e conversões.',
    docsUrl: 'https://developers.google.com/google-ads/api/docs/oauth/overview',
    docsLabel: 'Como obter developer token, refresh token e customer ID',
    fields: [
      { key: 'developer_token', label: 'Developer Token', type: 'password', required: true, helper: 'Em Tools & Settings → API Center.' },
      { key: 'customer_id', label: 'Customer ID', placeholder: '123-456-7890', required: true, helper: 'ID da conta Google Ads (com ou sem hífens).' },
      { key: 'login_customer_id', label: 'Login Customer ID (MCC)', placeholder: 'opcional', helper: 'Preencha apenas se acessar via uma conta gerenciadora (MCC).' },
      { key: 'client_id', label: 'OAuth Client ID', required: true },
      { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', required: true },
      { key: 'refresh_token', label: 'OAuth Refresh Token', type: 'password', required: true },
    ],
  },
};

export default function PaidTrafficConnect() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const syncMutation = useSyncAdPlatform();

  const initialPlatform = (params.get('platform') as PlatformSlug) || 'meta_ads';
  const [platform, setPlatform] = useState<PlatformSlug>(initialPlatform);
  const platformDef = PLATFORMS[platform];

  const [creds, setCreds] = useState<Record<string, string>>({});
  const [accountName, setAccountName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Carrega conexão existente
  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['paid-traffic-connections', orgId, platform],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('paid_traffic_connections')
        .select('*')
        .eq('org_id', orgId)
        .eq('platform_slug', platform)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  useEffect(() => {
    if (existing) {
      setCreds((existing.credentials ?? {}) as Record<string, string>);
      setAccountName(existing.account_name ?? '');
    } else {
      setCreds({});
      setAccountName('');
    }
  }, [existing, platform]);

  const validate = (): string | null => {
    for (const f of platformDef.fields) {
      if (f.required && !(creds[f.key] ?? '').trim()) return `Campo obrigatório: ${f.label}`;
    }
    return null;
  };

  const saveAndSync = async () => {
    const err = validate();
    if (err) {
      toast({ variant: 'destructive', title: 'Validação', description: err });
      return;
    }
    if (!orgId) return;

    setIsSaving(true);
    try {
      const payload = {
        org_id: orgId,
        platform_slug: platform,
        account_name: accountName || platformDef.name,
        account_id: creds.ad_account_id || creds.customer_id || null,
        credentials: creds,
        sync_status: 'pending',
        sync_error: null,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase
        .from('paid_traffic_connections')
        .upsert(payload, { onConflict: 'org_id,platform_slug' });
      if (upsertErr) throw upsertErr;

      toast({ title: 'Conexão salva!', description: 'Iniciando primeira sincronização…' });

      await syncMutation.mutateAsync({ orgId, platformSlug: platform, daysBack: 30 });

      queryClient.invalidateQueries({ queryKey: ['paid-traffic-connections', orgId] });
      toast({ title: 'Sincronização concluída ✅', description: `${platformDef.name} conectado com sucesso.` });
      navigate(`/client/${orgId}/paid-traffic`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Falha ao conectar', description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) return;
      const { error } = await supabase
        .from('paid_traffic_connections')
        .delete()
        .eq('org_id', orgId)
        .eq('platform_slug', platform);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paid-traffic-connections', orgId] });
      setCreds({});
      setAccountName('');
      toast({ title: 'Conexão removida.' });
    },
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/client/${orgId}/paid-traffic`)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <h1 className="text-2xl font-bold">Conectar Tráfego Pago</h1>
      </div>

      {/* Seletor de plataforma */}
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(PLATFORMS) as PlatformSlug[]).map((slug) => {
          const p = PLATFORMS[slug];
          const isActive = platform === slug;
          return (
            <button
              key={slug}
              onClick={() => setPlatform(slug)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{p.emoji}</span>
                  <span className="font-semibold">{p.name}</span>
                </div>
                {isActive && <Badge variant="default">Selecionado</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-2">{p.description}</p>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span>{platformDef.emoji}</span> Credenciais — {platformDef.name}
              </CardTitle>
              <CardDescription>{platformDef.description}</CardDescription>
            </div>
            {existing?.sync_status === 'success' && (
              <Badge className="bg-emerald-500/10 text-emerald-500 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Conectado
              </Badge>
            )}
            {existing?.sync_status === 'error' && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="w-3 h-3" /> Erro
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <a
            href={platformDef.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" /> {platformDef.docsLabel}
          </a>

          {existing?.sync_error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs break-all">{existing.sync_error}</AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="account-name">Nome da conta (apelido)</Label>
            <Input
              id="account-name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder={`Ex.: ${platformDef.name} Principal`}
            />
          </div>

          {platformDef.fields.map((f) => (
            <div key={f.key}>
              <Label htmlFor={f.key}>
                {f.label} {f.required && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id={f.key}
                type={f.type ?? 'text'}
                value={creds[f.key] ?? ''}
                placeholder={f.placeholder}
                onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
                autoComplete="off"
              />
              {f.helper && <p className="text-[11px] text-muted-foreground mt-1">{f.helper}</p>}
            </div>
          ))}

          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Suas credenciais ficam isoladas via RLS por organização e nunca são expostas ao frontend.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={saveAndSync} disabled={isSaving || loadingExisting}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {existing ? 'Atualizar e sincronizar' : 'Conectar e sincronizar'}
            </Button>
            {existing && (
              <Button
                variant="outline"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Remover conexão
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
