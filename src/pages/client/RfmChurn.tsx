import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import RfmChurnModule from '@/components/analytics/RfmChurnModule';

const ClientRfmChurn = () => {
  const { orgId } = useParams();

  const { data: dashboards } = useQuery({
    queryKey: ['rfm-churn-dashboards', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboards')
        .select('id, name')
        .eq('org_id', orgId)
        .order('is_default', { ascending: false })
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 pb-32">
      <RfmChurnModule
        orgId={orgId || ''}
        title="Módulo RFM + Churn"
        description="Tela nova para análise de segmentação e retenção aplicada aos dashboards do cliente."
        dashboardNames={(dashboards || []).map(d => d.name)}
      />
    </div>
  );
};

export default ClientRfmChurn;
