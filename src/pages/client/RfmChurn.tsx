import { useParams } from 'react-router-dom';
import RfmChurnModule from '@/components/analytics/RfmChurnModule';

const ClientRfmChurn = () => {
  const { orgId } = useParams();

  return (
    <div className="p-6 space-y-6 pb-24 max-w-7xl mx-auto">
      <RfmChurnModule
        orgId={orgId || ''}
        title="Módulo RFM + Churn"
        description="Tela nova para análise de segmentação e retenção aplicada aos dashboards do cliente."
      />
    </div>
  );
};

export default ClientRfmChurn;
