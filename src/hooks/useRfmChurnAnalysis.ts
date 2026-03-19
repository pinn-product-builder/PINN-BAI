import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type LeadRow = {
  id: string;
  name: string;
  email: string | null;
  status: string;
  value: number;
  created_at: string;
  updated_at: string;
  converted_at: string | null;
};

export type RiskBand = 'baixo' | 'medio' | 'alto';

export interface RfmCustomerScore {
  customerKey: string;
  name: string;
  email: string | null;
  recencyDays: number;
  frequency: number;
  monetary: number;
  rScore: number;
  fScore: number;
  mScore: number;
  rfmScore: string;
  rfmSegment: string;
  churnProbability: number;
  churnRiskBand: RiskBand;
}

interface RfmSummary {
  customers: number;
  avgRecencyDays: number;
  avgFrequency: number;
  totalMonetary: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  segments: Record<string, number>;
}

interface RfmAnalysisResult {
  rows: RfmCustomerScore[];
  summary: RfmSummary;
}

const statusRiskWeight = (status: string): number => {
  const normalized = status.toLowerCase();
  if (normalized === 'lost') return 1;
  if (normalized === 'proposal') return 0.7;
  if (normalized === 'in_analysis') return 0.6;
  if (normalized === 'qualified') return 0.4;
  if (normalized === 'new') return 0.5;
  if (normalized === 'converted') return 0.1;
  return 0.5;
};

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

const daysFromNow = (dateInput: string): number => {
  const now = Date.now();
  const ts = new Date(dateInput).getTime();
  if (Number.isNaN(ts)) return 999;
  return Math.max(0, Math.round((now - ts) / (1000 * 60 * 60 * 24)));
};

const quantileScore = (value: number, sorted: number[], higherIsBetter = true): number => {
  if (sorted.length === 0) return 3;
  const idx = sorted.findIndex(v => v >= value);
  const rank = idx === -1 ? sorted.length - 1 : idx;
  const percentile = sorted.length <= 1 ? 1 : rank / (sorted.length - 1);
  const raw = higherIsBetter
    ? 1 + Math.round(percentile * 4)
    : 5 - Math.round(percentile * 4);
  return Math.max(1, Math.min(5, raw));
};

const resolveSegment = (r: number, f: number): string => {
  if (r >= 4 && f >= 4) return 'Champions';
  if (r >= 4 && f >= 2) return 'Promissores';
  if (r <= 2 && f >= 4) return 'Em Risco';
  if (r <= 2 && f <= 2) return 'Hibernando';
  return 'Regulares';
};

export const useRfmChurnAnalysis = (orgId?: string) => {
  const leadsQuery = useQuery({
    queryKey: ['rfm-churn-analysis', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      // 1) Recalcula RFM com leitura das tabelas de integração do cliente
      const { error: rfmInvokeError } = await supabase.functions.invoke('calculate-rfm', {
        body: { orgId },
      });
      if (rfmInvokeError) {
        throw new Error(`Falha ao calcular RFM: ${rfmInvokeError.message}`);
      }

      // 2) Recalcula churn usando os scores RFM persistidos
      const { error: churnInvokeError } = await supabase.functions.invoke('predict-churn', {
        body: { orgId },
      });
      if (churnInvokeError) {
        throw new Error(`Falha ao calcular churn: ${churnInvokeError.message}`);
      }

      // 3) Busca os scores persistidos para renderização
      const rfmResult = await supabase
        .from('customer_rfm_scores')
        .select('*')
        .eq('org_id', orgId);
      const churnResult = await supabase
        .from('customer_churn_scores')
        .select('*')
        .eq('org_id', orgId);

      const { data: rfmData, error: rfmDataError } = rfmResult;
      const { data: churnData, error: churnDataError } = churnResult;

      if (rfmDataError) throw new Error(`Falha ao buscar scores RFM: ${rfmDataError.message}`);
      if (churnDataError) throw new Error(`Falha ao buscar scores de churn: ${churnDataError.message}`);

      const churnByCustomer = new Map(
        (churnData || []).map((row: any) => [row.customer_key, row]),
      );

      return (rfmData || []).map((row: any) => {
        const churn = churnByCustomer.get(row.customer_key);
        return {
          id: row.customer_key,
          name: row.customer_name || 'Cliente sem nome',
          email: row.customer_email || null,
          status: 'new',
          value: Number(row.monetary || 0),
          created_at: row.calculated_at,
          updated_at: row.calculated_at,
          converted_at: null,
          _rfm: row,
          _churn: churn || null,
        };
      }) as unknown as LeadRow[];
    },
    enabled: !!orgId,
  });

  const analysis = useMemo<RfmAnalysisResult>(() => {
    const leads = leadsQuery.data || [];
    if (leads.length === 0) {
      return {
        rows: [],
        summary: {
          customers: 0,
          avgRecencyDays: 0,
          avgFrequency: 0,
          totalMonetary: 0,
          highRiskCount: 0,
          mediumRiskCount: 0,
          lowRiskCount: 0,
          segments: {},
        },
      };
    }

    const hasPersistedScores = (leads[0] as any)?._rfm;
    if (hasPersistedScores) {
      const rows = (leads as any[]).map((leadLike: any) => {
        const rfm = leadLike._rfm;
        const churn = leadLike._churn;
        const churnProbability = Number(churn?.churn_probability || 0);
        const churnRiskBand: RiskBand =
          churn?.churn_risk_band === 'alto'
            ? 'alto'
            : churn?.churn_risk_band === 'medio'
              ? 'medio'
              : 'baixo';

        return {
          customerKey: String(rfm.customer_key),
          name: rfm.customer_name || 'Cliente sem nome',
          email: rfm.customer_email || null,
          recencyDays: Number(rfm.recency_days || 0),
          frequency: Number(rfm.frequency || 0),
          monetary: Number(rfm.monetary || 0),
          rScore: Number(rfm.r_score || 1),
          fScore: Number(rfm.f_score || 1),
          mScore: Number(rfm.m_score || 1),
          rfmScore: String(rfm.rfm_score || '111'),
          rfmSegment: String(rfm.rfm_segment || 'Regulares'),
          churnProbability,
          churnRiskBand,
        } as RfmCustomerScore;
      }).sort((a, b) => b.churnProbability - a.churnProbability);

      const segments: Record<string, number> = {};
      rows.forEach(row => {
        segments[row.rfmSegment] = (segments[row.rfmSegment] || 0) + 1;
      });

      return {
        rows,
        summary: {
          customers: rows.length,
          avgRecencyDays: rows.length ? rows.reduce((acc, row) => acc + row.recencyDays, 0) / rows.length : 0,
          avgFrequency: rows.length ? rows.reduce((acc, row) => acc + row.frequency, 0) / rows.length : 0,
          totalMonetary: rows.reduce((acc, row) => acc + row.monetary, 0),
          highRiskCount: rows.filter(row => row.churnRiskBand === 'alto').length,
          mediumRiskCount: rows.filter(row => row.churnRiskBand === 'medio').length,
          lowRiskCount: rows.filter(row => row.churnRiskBand === 'baixo').length,
          segments,
        },
      };
    }

    const groups = new Map<string, LeadRow[]>();
    leads.forEach(lead => {
      const key = (lead.email || lead.name || lead.id).toLowerCase().trim();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(lead);
    });

    const records = Array.from(groups.entries()).map(([customerKey, customerLeads]) => {
      const sortedByRecency = [...customerLeads].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
      const latest = sortedByRecency[0];
      const recencyDays = daysFromNow(latest.updated_at || latest.created_at);
      const frequency = customerLeads.length;
      const monetary = customerLeads.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0);

      return {
        customerKey,
        name: latest.name || 'Cliente sem nome',
        email: latest.email,
        recencyDays,
        frequency,
        monetary,
        status: latest.status,
      };
    });

    const recencySorted = [...records].map(r => r.recencyDays).sort((a, b) => a - b);
    const frequencySorted = [...records].map(r => r.frequency).sort((a, b) => a - b);
    const monetarySorted = [...records].map(r => r.monetary).sort((a, b) => a - b);

    const scoredRows: RfmCustomerScore[] = records.map(record => {
      const rScore = quantileScore(record.recencyDays, recencySorted, false);
      const fScore = quantileScore(record.frequency, frequencySorted, true);
      const mScore = quantileScore(record.monetary, monetarySorted, true);
      const rfmScore = `${rScore}${fScore}${mScore}`;
      const rfmSegment = resolveSegment(rScore, fScore);

      const recencyRisk = clamp(record.recencyDays / 90);
      const frequencyRisk = 1 - clamp(record.frequency / 8);
      const monetaryRisk = 1 - clamp(record.monetary / 10000);
      const statusRisk = statusRiskWeight(record.status);

      const churnProbability = clamp(
        (recencyRisk * 0.45) + (frequencyRisk * 0.25) + (statusRisk * 0.2) + (monetaryRisk * 0.1),
      );

      let churnRiskBand: RiskBand = 'baixo';
      if (churnProbability >= 0.7) churnRiskBand = 'alto';
      else if (churnProbability >= 0.4) churnRiskBand = 'medio';

      return {
        customerKey: record.customerKey,
        name: record.name,
        email: record.email,
        recencyDays: record.recencyDays,
        frequency: record.frequency,
        monetary: record.monetary,
        rScore,
        fScore,
        mScore,
        rfmScore,
        rfmSegment,
        churnProbability,
        churnRiskBand,
      };
    }).sort((a, b) => b.churnProbability - a.churnProbability);

    const segments: Record<string, number> = {};
    scoredRows.forEach(row => {
      segments[row.rfmSegment] = (segments[row.rfmSegment] || 0) + 1;
    });

    const summary: RfmSummary = {
      customers: scoredRows.length,
      avgRecencyDays: scoredRows.reduce((acc, row) => acc + row.recencyDays, 0) / scoredRows.length,
      avgFrequency: scoredRows.reduce((acc, row) => acc + row.frequency, 0) / scoredRows.length,
      totalMonetary: scoredRows.reduce((acc, row) => acc + row.monetary, 0),
      highRiskCount: scoredRows.filter(row => row.churnRiskBand === 'alto').length,
      mediumRiskCount: scoredRows.filter(row => row.churnRiskBand === 'medio').length,
      lowRiskCount: scoredRows.filter(row => row.churnRiskBand === 'baixo').length,
      segments,
    };

    return { rows: scoredRows, summary };
  }, [leadsQuery.data]);

  return {
    ...leadsQuery,
    analysis,
  };
};
