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
  headers?: Record<string, string>;
  body?: unknown;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { baseUrl, endpoint, method, authType, authValue, headers: customHeaders, body }: RequestBody = await req.json();

    if (!baseUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL base é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build full URL
    const url = endpoint ? `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}` : baseUrl;

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
        if (authValue) fetchHeaders['X-API-Key'] = authValue;
        break;
      case 'basic':
        if (authValue) fetchHeaders['Authorization'] = `Basic ${btoa(authValue)}`;
        break;
    }

    // Make request
    const response = await fetch(url, {
      method,
      headers: fetchHeaders,
      body: method === 'POST' && body ? JSON.stringify(body) : undefined,
    });

    const contentType = response.headers.get('content-type');

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({
          success: false,
          error: `API retornou erro ${response.status}: ${errorText.substring(0, 200)}`,
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let data: unknown;
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Analyze data structure
    let columns: { name: string; type: string }[] = [];
    let rowCount = 0;
    let sampleData: Record<string, unknown>[] = [];

    if (Array.isArray(data)) {
      rowCount = data.length;
      sampleData = data.slice(0, 10) as Record<string, unknown>[];

      if (data.length > 0 && typeof data[0] === 'object') {
        columns = Object.entries(data[0] as Record<string, unknown>).map(([key, value]) => ({
          name: key,
          type: detectType(value),
        }));
      }
    } else if (typeof data === 'object' && data !== null) {
      // Check if there's a data property that's an array
      const dataObj = data as Record<string, unknown>;
      const arrayProp = Object.entries(dataObj).find(([, value]) => Array.isArray(value));

      if (arrayProp) {
        const [propName, arrayData] = arrayProp;
        rowCount = (arrayData as unknown[]).length;
        sampleData = (arrayData as Record<string, unknown>[]).slice(0, 10);

        if ((arrayData as unknown[]).length > 0) {
          const firstItem = (arrayData as unknown[])[0];
          if (typeof firstItem === 'object' && firstItem !== null) {
            columns = Object.entries(firstItem as Record<string, unknown>).map(([key, value]) => ({
              name: key,
              type: detectType(value),
            }));
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            columns,
            rowCount,
            sampleData,
            dataPath: propName,
            message: `Encontrados ${rowCount} registro(s) em '${propName}'`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Single object response
      columns = Object.entries(dataObj).map(([key, value]) => ({
        name: key,
        type: detectType(value),
      }));
      rowCount = 1;
      sampleData = [dataObj];
    }

    return new Response(
      JSON.stringify({
        success: true,
        columns,
        rowCount,
        sampleData,
        message: `Encontrados ${rowCount} registro(s)`,
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
