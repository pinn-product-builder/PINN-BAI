import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RfmChurnModule from '@/components/analytics/RfmChurnModule';

const AdminRfmChurn = () => {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  const { data: organizations } = useQuery({
    queryKey: ['admin-rfm-churn-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const activeOrgId = selectedOrgId || organizations?.[0]?.id || '';

  const { data: dashboards } = useQuery({
    queryKey: ['admin-rfm-churn-dashboards', activeOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboards')
        .select('id, name')
        .eq('org_id', activeOrgId)
        .order('is_default', { ascending: false })
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOrgId,
  });

  const activeOrg = useMemo(
    () => organizations?.find(org => org.id === activeOrgId),
    [organizations, activeOrgId],
  );

  return (
    <div className="p-8 space-y-6 pb-16">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Matriz RFM + Predição de Churn</h1>
        <p className="text-muted-foreground">
          Módulo unificado para acompanhar retenção e risco de churn nas organizações.
        </p>
      </div>

      <div className="max-w-sm">
        <Select value={activeOrgId} onValueChange={setSelectedOrgId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar organização" />
          </SelectTrigger>
          <SelectContent>
            {(organizations || []).map(org => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activeOrgId ? (
        <RfmChurnModule
          orgId={activeOrgId}
          title={`RFM + Churn - ${activeOrg?.name || 'Organização'}`}
          description="Visão analítica pronta para uso nos 3 dashboards principais."
          dashboardNames={(dashboards || []).map(d => d.name)}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Selecione uma organização para iniciar.</p>
      )}
    </div>
  );
};

export default AdminRfmChurn;
