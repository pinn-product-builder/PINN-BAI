import { useQuery } from '@tanstack/react-query';
import { mariSupabase } from '@/integrations/supabase/mariClient';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MariSession {
  session_id: string;
  phone: string | null;
  lead_name: string | null;
  company: string | null;
  sector: string | null;
  stage: string;
  pain: string | null;
  role: string | null;
  lead_score: number;
  urgency_level: string;
  follow_up_count: number;
  briefing_sent: boolean;
  confirmed_slot: string | null;
  last_outbound_at: string | null;
  last_inbound_at: string | null;
  handoff: boolean;
  optout: boolean;
  created_at: string;
}

export interface MariMetrics {
  total: number;
  qualifying: number;
  scheduling: number;
  confirmed: number;
  handoff: number;
  optout: number;
  cancelled: number;
  hotLeads: number;
  followUpActive: number;
  avgScore: number;
  conversionRate: number;
  byStage: { stage: string; count: number }[];
  bySector: { sector: string; count: number }[];
  byUrgency: { level: string; count: number }[];
  recentSessions: MariSession[];
}

// ─── Hook principal ───────────────────────────────────────────────────────────

// Dados demo pré-calculados para exibição instantânea (placeholder)
const _placeholderMetrics = _buildMetrics(_demoSessions());

export const useMariSDR = () => {
  return useQuery<MariMetrics>({
    queryKey: ['mari-sdr-metrics'],
    queryFn: async () => {
      if (!mariSupabase) {
        throw new Error('Mari Supabase não configurado');
      }
      const { data, error } = await mariSupabase
        .from('sdr_sessions')
        .select(
          'session_id, phone, lead_name, company, sector, stage, pain, role, ' +
          'lead_score, urgency_level, follow_up_count, briefing_sent, ' +
          'confirmed_slot, last_outbound_at, last_inbound_at, ' +
          'handoff, optout, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      const sessions: MariSession[] = (data as unknown as MariSession[]) || [];
      return _buildMetrics(sessions);
    },
    placeholderData: _placeholderMetrics,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
};

// ─── Dados de demonstração ────────────────────────────────────────────────────

function _demoSessions(): MariSession[] {
  const now = Date.now();
  const day = 86400000;
  const stages = ['qualifying', 'scheduling', 'confirmed', 'rescheduling', 'handoff', 'cancelled', 'optout'] as const;
  const sectors = ['Tecnologia', 'Saúde', 'E-commerce', 'Educação', 'Indústria', 'Financeiro'];
  const urgencies = ['critical', 'high', 'medium', 'low'];
  const names = [
    'Ana Souza', 'Carlos Mendes', 'Beatriz Lima', 'Diego Oliveira',
    'Fernanda Costa', 'Gabriel Santos', 'Helena Rocha', 'Igor Martins',
    'Julia Alves', 'Leonardo Pereira', 'Mariana Duarte', 'Nathan Ribeiro',
    'Paula Araújo', 'Rafael Gomes', 'Sofia Cardoso',
  ];
  const companies = [
    'TechNova', 'MedStar', 'ShopBR', 'EduPrime', 'Industek',
    'FinCore', 'CloudBase', 'DataWave', 'AgriSol', 'LogiMax',
    'SmartPay', 'GreenTech', 'VitalCare', 'BuildUp', 'NetForce',
  ];

  return names.map((name, i): MariSession => {
    const stageIdx = i < 4 ? 2 : i < 7 ? 1 : i < 10 ? 0 : i % stages.length;
    return {
      session_id: `demo-${i}`,
      phone: `+55 11 9${String(1000 + i * 111).slice(0, 4)}-${String(2000 + i * 222).slice(0, 4)}`,
      lead_name: name,
      company: companies[i % companies.length],
      sector: sectors[i % sectors.length],
      stage: stages[stageIdx],
      pain: 'Automação de vendas',
      role: 'Gerente Comercial',
      lead_score: Math.max(20, Math.min(95, 50 + (i * 7) % 50)),
      urgency_level: urgencies[i % urgencies.length],
      follow_up_count: i % 3,
      briefing_sent: i < 8,
      confirmed_slot: stageIdx === 2 ? new Date(now + day * 2).toISOString() : null,
      last_outbound_at: new Date(now - day * (i % 5)).toISOString(),
      last_inbound_at: new Date(now - day * (i % 3)).toISOString(),
      handoff: stages[stageIdx] === 'handoff',
      optout: stages[stageIdx] === 'optout',
      created_at: new Date(now - day * (i + 1)).toISOString(),
    };
  });
}

// ─── Helpers de métricas ──────────────────────────────────────────────────────

const STAGE_LABEL: Record<string, string> = {
  qualifying:   'Qualificando',
  scheduling:   'Agendando',
  confirmed:    'Confirmado',
  rescheduling: 'Reagendando',
  cancelled:    'Cancelado',
  handoff:      'Handoff',
  optout:       'Optout',
};

function _buildMetrics(sessions: MariSession[]): MariMetrics {
  const total       = sessions.length;
  const qualifying  = sessions.filter(s => s.stage === 'qualifying').length;
  const scheduling  = sessions.filter(s => s.stage === 'scheduling').length;
  const confirmed   = sessions.filter(s => s.stage === 'confirmed').length;
  const handoff     = sessions.filter(s => s.stage === 'handoff').length;
  const optout      = sessions.filter(s => s.stage === 'optout').length;
  const cancelled   = sessions.filter(s => s.stage === 'cancelled').length;
  const hotLeads    = sessions.filter(s => s.lead_score >= 68).length;
  const followUpActive = sessions.filter(s => (s.follow_up_count ?? 0) > 0 &&
    !['confirmed','cancelled','handoff','optout'].includes(s.stage)).length;

  const scores = sessions.map(s => s.lead_score ?? 0).filter(n => n > 0);
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  const activeSessions = total - optout - cancelled;
  const conversionRate = activeSessions > 0
    ? Math.round((confirmed / activeSessions) * 100)
    : 0;

  // Funil por stage
  const stageCounts: Record<string, number> = {};
  sessions.forEach(s => {
    stageCounts[s.stage] = (stageCounts[s.stage] || 0) + 1;
  });
  const byStage = Object.entries(stageCounts)
    .map(([stage, count]) => ({ stage: STAGE_LABEL[stage] || stage, count }))
    .sort((a, b) => b.count - a.count);

  // Por setor
  const sectorCounts: Record<string, number> = {};
  sessions.forEach(s => {
    if (s.sector) {
      const key = s.sector.split(/[,\/]/)[0].trim().slice(0, 30);
      sectorCounts[key] = (sectorCounts[key] || 0) + 1;
    }
  });
  const bySector = Object.entries(sectorCounts)
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Por urgência
  const urgencyCounts: Record<string, number> = {};
  sessions.forEach(s => {
    if (s.urgency_level) {
      urgencyCounts[s.urgency_level] = (urgencyCounts[s.urgency_level] || 0) + 1;
    }
  });
  const urgencyOrder = ['critical', 'high', 'medium', 'low'];
  const urgencyLabel: Record<string, string> = {
    critical: 'Crítico', high: 'Alto', medium: 'Médio', low: 'Baixo',
  };
  const byUrgency = urgencyOrder
    .filter(u => urgencyCounts[u])
    .map(u => ({ level: urgencyLabel[u] || u, count: urgencyCounts[u] }));

  const recentSessions = sessions.slice(0, 50);

  return {
    total, qualifying, scheduling, confirmed,
    handoff, optout, cancelled,
    hotLeads, followUpActive,
    avgScore, conversionRate,
    byStage, bySector, byUrgency,
    recentSessions,
  };
}
