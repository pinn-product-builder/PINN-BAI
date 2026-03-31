import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  baseUrl: string;
  endpoint: string;
  method: 'GET' | 'POST';
  authType: 'none' | 'bearer' | 'api_key' | 'basic';
  authValue?: string;
  apiKeyHeader?: string;
  headers?: Record<string, string>;
  detectActions?: boolean;
  body?: unknown;
}

interface AnalyzedData {
  columns: { name: string; type: string; nullable: boolean; sampleValues: unknown[] }[];
  rowCount: number;
  sampleData: Record<string, unknown>[];
  data: Record<string, unknown>[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      baseUrl,
      endpoint,
      method,
      authType,
      authValue,
      apiKeyHeader = 'X-API-Key',
      headers: customHeaders,
      detectActions = false,
      body,
    }: RequestBody = await req.json();

    if (!baseUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL base é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build headers
    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    // Add auth header
    switch (authType) {
      case 'bearer':
        if (authValue) fetchHeaders['Authorization'] = `Bearer ${authValue}`;
        break;
      case 'api_key':
        if (authValue) fetchHeaders[apiKeyHeader] = authValue;
        break;
      case 'basic':
        if (authValue) fetchHeaders['Authorization'] = `Basic ${btoa(authValue)}`;
        break;
    }

    const base = baseUrl.replace(/\/$/, '');
    const buildUrl = (actionOrEndpoint: string, query: Record<string, string> = {}) => {
      if (actionOrEndpoint.startsWith('?') || actionOrEndpoint.includes('?')) {
        return `${base}${actionOrEndpoint.startsWith('?') ? '' : '/'}${actionOrEndpoint}`;
      }
      if (actionOrEndpoint.startsWith('/')) {
        return `${base}${actionOrEndpoint}`;
      }
      const search = new URLSearchParams(query).toString();
      return `${base}?${search || actionOrEndpoint}`;
    };

    const requestJson = async (url: string) => {
      const response = await fetch(url, {
        method,
        headers: fetchHeaders,
        body: method === 'POST' && body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API retornou erro ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Resposta não-JSON recebida: ${text.substring(0, 200)}`);
      }

      return response.json();
    };

    if (detectActions) {
      const actionRequests: Array<{ action: string; query?: Record<string, string> }> = [
        { action: 'stats' },
        { action: 'campaigns' },
        { action: 'leads', query: { limit: '100', offset: '0' } },
        { action: 'pipeline' },
        { action: 'linkedin-metrics' },
        { action: 'timeline', query: { days: '30' } },
        { action: 'lead-lists' },
      ];

      const tables: Array<{
        name: string;
        columns: { name: string; type: string; nullable: boolean; sampleValues: unknown[] }[];
        rowCount: number;
        sampleData: Record<string, unknown>[];
      }> = [];

      for (const reqConfig of actionRequests) {
        try {
          const query = { action: reqConfig.action, ...(reqConfig.query || {}) };
          const url = buildUrl('', query);
          const payload = await requestJson(url);
          const analyzed = analyzeApiData(payload, reqConfig.action);
          if (analyzed.rowCount > 0) {
            tables.push({
              name: reqConfig.action,
              columns: analyzed.columns,
              rowCount: analyzed.rowCount,
              sampleData: analyzed.sampleData,
            });
          }
        } catch (actionError) {
          console.warn(`Falha ao detectar ação '${reqConfig.action}'`, actionError);
        }
      }

      if (tables.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Não foi possível detectar ações válidas com a configuração informada.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          tables,
          message: `${tables.length} ação(ões) detectada(s) com sucesso`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = endpoint
      ? buildUrl(endpoint)
      : buildUrl('', { action: 'stats' });
    const payload = await requestJson(url);
    const analyzed = analyzeApiData(payload);

    return new Response(
      JSON.stringify({
        success: true,
        data: analyzed.data,
        sampleData: analyzed.sampleData,
        columns: analyzed.columns,
        rowCount: analyzed.rowCount,
        message: `Encontrados ${analyzed.rowCount} registro(s)`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error testing API:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao testar API',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function detectType(value: unknown): string {
  if (value === null || value === undefined) return 'unknown';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    return 'string';
  }
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'unknown';
}

function detectArrayLikeProperty(
  dataObj: Record<string, unknown>,
  preferredKey?: string
): { key: string; value: unknown[] } | null {
  if (preferredKey && Array.isArray(dataObj[preferredKey])) {
    return { key: preferredKey, value: dataObj[preferredKey] as unknown[] };
  }

  const arrayProp = Object.entries(dataObj).find(([, value]) => Array.isArray(value));
  return arrayProp ? { key: arrayProp[0], value: arrayProp[1] as unknown[] } : null;
}

function analyzeApiData(payload: unknown, actionName?: string): AnalyzedData {
  const preferredArrays: Record<string, string> = {
    campaigns: 'campaigns',
    leads: 'leads',
    timeline: 'timeline',
    'lead-lists': 'lead_lists',
    'lead-list-items': 'items',
  };

  const preferredObjects: Record<string, string> = {
    stats: 'stats',
    pipeline: 'pipeline',
    'linkedin-metrics': 'linkedin_metrics',
    campaign: 'campaign',
    lead: 'lead',
  };

  let dataRows: Record<string, unknown>[] = [];

  if (Array.isArray(payload)) {
    dataRows = payload.filter((item) => typeof item === 'object' && item !== null) as Record<string, unknown>[];
  } else if (typeof payload === 'object' && payload !== null) {
    const obj = payload as Record<string, unknown>;
    const preferredArrayKey = actionName ? preferredArrays[actionName] : undefined;
    const preferredObjectKey = actionName ? preferredObjects[actionName] : undefined;
    const arrayProp = detectArrayLikeProperty(obj, preferredArrayKey);

    if (arrayProp) {
      dataRows = (arrayProp.value || []).filter((item) => typeof item === 'object' && item !== null) as Record<string, unknown>[];
    } else if (preferredObjectKey && typeof obj[preferredObjectKey] === 'object' && obj[preferredObjectKey] !== null) {
      dataRows = [obj[preferredObjectKey] as Record<string, unknown>];
    } else if (typeof obj.stats === 'object' && obj.stats !== null) {
      dataRows = [obj.stats as Record<string, unknown>];
    } else if (typeof obj.pipeline === 'object' && obj.pipeline !== null) {
      dataRows = [obj.pipeline as Record<string, unknown>];
    } else if (typeof obj.linkedin_metrics === 'object' && obj.linkedin_metrics !== null) {
      dataRows = [obj.linkedin_metrics as Record<string, unknown>];
    } else {
      dataRows = [obj];
    }
  }

  const rowCount = dataRows.length;
  const sampleData = dataRows.slice(0, 10);
  const firstItem = sampleData[0] || {};
  const columns = Object.entries(firstItem).map(([key, value]) => ({
    name: key,
    type: detectType(value),
    nullable: value === null || value === undefined,
    sampleValues: sampleData.slice(0, 3).map((row) => row[key]),
  }));

  return {
    data: dataRows,
    columns,
    rowCount,
    sampleData,
  };
}
