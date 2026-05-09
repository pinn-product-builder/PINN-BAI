/**
 * LinkedInPinnSDRTab — wrapper que aparece dentro do tab "LinkedIn" do
 * "Pinn SDR Painel". Mostra:
 *   1. Sub-tab "Geral" — visão de todas as campanhas e perfis (mesmo que /admin/linkedin-sdr)
 *   2. Uma sub-tab por campanha ativa — dashboard escopado àquela campanha
 *
 * Cada sub-tab renderiza o mesmo OverviewTab, com filtro `campaignId` aplicado.
 */

import { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { LayoutDashboard, Linkedin, Target } from 'lucide-react';

import {
  useLinkedInCampaigns,
  INSTANCE_PROFILE_MAP,
} from '@/hooks/useLinkedInCampaigns';
import { isMariSupabaseConfigured } from '@/integrations/supabase/mariClient';

import { OverviewTab } from './OverviewTab';

// Truncamento útil para nome em sub-tab
function truncate(s: string, n: number) {
  if (!s) return '';
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

export function LinkedInPinnSDRTab() {
  // Se Supabase da Mari não está configurado, mostra warning e segue
  if (!isMariSupabaseConfigured) {
    return (
      <Card className="border-dashed border-amber-500/30">
        <CardContent className="py-10 text-center space-y-2">
          <Linkedin className="w-10 h-10 mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Defina <code className="text-xs bg-muted px-1 rounded">VITE_MARI_SUPABASE_URL</code> e{' '}
            <code className="text-xs bg-muted px-1 rounded">VITE_MARI_SUPABASE_KEY</code> no{' '}
            <strong>.env</strong> do PINN-BAI para exibir o dashboard LinkedIn.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { data: campaigns = [], isLoading } = useLinkedInCampaigns();

  // Considera "prospecções ativas" todas com status active. Se não houver
  // ativa, mostra também as draft+paused para o usuário ter visibilidade.
  const activeCampaigns = useMemo(
    () => campaigns.filter((c) => c.status === 'active'),
    [campaigns]
  );

  const fallbackCampaigns = useMemo(
    () => campaigns.filter((c) => c.status === 'paused' || c.status === 'draft'),
    [campaigns]
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  // Lista de campanhas a mostrar como sub-tab — prioriza ativas; se não houver,
  // mostra as draft/paused para não deixar o tab vazio
  const campsToShow =
    activeCampaigns.length > 0 ? activeCampaigns : fallbackCampaigns.slice(0, 5);

  return (
    <Tabs defaultValue="geral" className="w-full">
      <TabsList className="flex-wrap h-auto justify-start gap-1">
        <TabsTrigger value="geral" className="gap-2">
          <LayoutDashboard className="w-3.5 h-3.5" />
          Geral
          <Badge variant="outline" className="text-[10px] ml-1 px-1.5 py-0">
            {campaigns.length}
          </Badge>
        </TabsTrigger>
        {campsToShow.map((c) => {
          const profileLabel = c.linkedin_account_id
            ? INSTANCE_PROFILE_MAP[c.linkedin_account_id] ?? '—'
            : '—';
          return (
            <TabsTrigger
              key={c.id}
              value={c.id}
              className="gap-2 data-[state=active]:border-primary"
              title={`${c.name} (${profileLabel}) · ${c.status}`}
            >
              <Target className="w-3.5 h-3.5" />
              {truncate(c.name, 24)}
              <Badge
                variant={c.status === 'active' ? 'default' : 'secondary'}
                className="text-[10px] px-1.5 py-0"
              >
                {profileLabel}
              </Badge>
            </TabsTrigger>
          );
        })}
      </TabsList>

      <TabsContent value="geral" className="mt-4">
        <OverviewTab />
      </TabsContent>

      {campsToShow.map((c) => (
        <TabsContent key={c.id} value={c.id} className="mt-4">
          <OverviewTab campaignId={c.id} hideProfileBreakdown />
        </TabsContent>
      ))}

      {campaigns.length === 0 && (
        <TabsContent value="geral" className="mt-4">
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-2">
              <Linkedin className="w-10 h-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Nenhuma campanha LinkedIn cadastrada ainda.
              </p>
              <p className="text-xs text-muted-foreground">
                Vá em <code className="text-xs bg-muted px-1 rounded">LinkedIn SDR Manager</code>{' '}
                para criar a primeira.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      )}
    </Tabs>
  );
}
