const MARI_API = 'https://mari.pinnpb.com';

interface MariAPIResponse {
  ok: boolean;
  data?: any;
  error?: string;
}

async function mariRequest(path: string, method = 'POST', body?: object): Promise<MariAPIResponse> {
  try {
    const headers: Record<string, string> = {};
    if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(`${MARI_API}${path}`, {
      method,
      headers,
      body: body !== undefined && method !== 'GET' && method !== 'HEAD' ? JSON.stringify(body) : undefined,
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const detail = data?.detail;
      let detailStr = '';
      if (typeof detail === 'string') detailStr = detail;
      else if (Array.isArray(detail))
        detailStr = detail.map((x: any) => x?.msg ?? JSON.stringify(x)).join('; ');
      else if (detail != null) detailStr = String(detail);
      return {
        ok: false,
        error: detailStr || (data?.message ?? data?.error ?? `HTTP ${res.status}`),
      };
    }

    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Erro de conexão' };
  }
}

/** Dispara uma campanha LinkedIn pelo ID */
export async function dispatch(campaignId: string): Promise<MariAPIResponse> {
  return mariRequest(`/campaigns/${campaignId}/dispatch`);
}

/** Solicita descoberta de leads (modo hunting) para a campanha */
export async function discover(campaignId: string): Promise<MariAPIResponse> {
  return mariRequest(`/campaigns/${campaignId}/discover`);
}

/** Pausa uma campanha LinkedIn ativa */
export async function pause(campaignId: string): Promise<MariAPIResponse> {
  return mariRequest(`/campaigns/${campaignId}/pause`);
}

/** Remove campanha no Mari. `force=true` apaga mesmo paused/active/completed (para recriar). */
export async function deleteCampaign(campaignId: string, force = true): Promise<MariAPIResponse> {
  const q = force ? '?force=true' : '';
  return mariRequest(`/campaigns/${campaignId}${q}`, 'DELETE');
}

/** Configuração operacional da Mari (hunting scheduler, CORS) — GET/PATCH /settings */
export async function getMariRuntimeSettings(): Promise<MariAPIResponse> {
  return mariRequest('/settings', 'GET');
}

export async function patchMariRuntimeSettings(patch: Record<string, unknown>): Promise<MariAPIResponse> {
  return mariRequest('/settings', 'PATCH', patch);
}

export const useMariAPI = () => ({ dispatch, discover, pause, deleteCampaign });
