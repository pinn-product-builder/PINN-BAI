import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  projectUrl: string;
  anonKey: string;
}

interface TableInfo {
  name: string;
  columns: {
    name: string;
    type: string;
    nullable: boolean;
    sampleValues: unknown[];
  }[];
  rowCount: number;
  sampleData: Record<string, unknown>[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectUrl, anonKey }: RequestBody = await req.json();

    if (!projectUrl || !anonKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL e Anon Key são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL format
    if (!projectUrl.includes('.supabase.co')) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL do projeto inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client to external Supabase
    const externalSupabase = createClient(projectUrl, anonKey);

    // Test connection by fetching schema info
    // We'll query the public schema tables
    const { data: tablesData, error: tablesError } = await externalSupabase
      .rpc('get_schema_info')
      .select('*');

    // If RPC doesn't exist, try alternative approach
    let tables: TableInfo[] = [];

    if (tablesError) {
      // Try to list common table names and check which ones exist
      const commonTables = [
        'users', 'profiles', 'leads', 'customers', 'orders', 'products',
        'transactions', 'contacts', 'accounts', 'events', 'logs',
        'messages', 'notifications', 'settings', 'categories', 'items'
      ];

      for (const tableName of commonTables) {
        try {
          const { data, error, count } = await externalSupabase
            .from(tableName)
            .select('*', { count: 'exact', head: false })
            .limit(5);

          if (!error && data) {
            // Extract column info from sample data
            const columns: TableInfo['columns'] = [];
            if (data.length > 0) {
              const sampleRow = data[0];
              for (const [colName, value] of Object.entries(sampleRow)) {
                const sampleValues = data
                  .map(row => (row as Record<string, unknown>)[colName])
                  .filter(v => v !== null && v !== undefined)
                  .slice(0, 3);

                columns.push({
                  name: colName,
                  type: detectType(value),
                  nullable: data.some(row => (row as Record<string, unknown>)[colName] === null),
                  sampleValues,
                });
              }
            }

            tables.push({
              name: tableName,
              columns,
              rowCount: count || data.length,
              sampleData: data as Record<string, unknown>[],
            });
          }
        } catch {
          // Table doesn't exist or no access, skip
        }
      }
    } else {
      tables = tablesData || [];
    }

    if (tables.length === 0) {
      // Connection works but no accessible tables
      return new Response(
        JSON.stringify({
          success: true,
          tables: [],
          message: 'Conexão bem-sucedida, mas nenhuma tabela acessível foi encontrada. Verifique as políticas RLS.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        tables,
        message: `Encontradas ${tables.length} tabela(s) acessível(is)`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error testing connection:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao testar conexão',
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
    // Check if it's a date
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    return 'string';
  }
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'unknown';
}
