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

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  sampleValues: unknown[];
}

interface TableInfo {
  name: string;
  columns: ColumnInfo[];
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

    // Try to get all tables by querying PostgreSQL information schema via RPC
    // First, check if the database has a custom function to list tables
    let tableNames: string[] = [];
    
    try {
      // Try using a custom RPC function if available
      const { data: schemaData, error: schemaError } = await externalSupabase
        .rpc('get_public_tables');
      
      if (!schemaError && schemaData) {
        tableNames = schemaData.map((t: { table_name: string }) => t.table_name);
      }
    } catch {
      // RPC doesn't exist, will use fallback
    }

    // If no custom function, try to discover tables by testing common ones
    // and also try to query information_schema if accessible
    if (tableNames.length === 0) {
      // Extended list of common table names to check
      const commonTables = [
        // Core business tables
        'users', 'profiles', 'accounts', 'organizations', 'companies', 'teams',
        // Sales/CRM
        'leads', 'contacts', 'customers', 'clients', 'opportunities', 'deals', 'sales',
        // E-commerce
        'orders', 'order_items', 'products', 'categories', 'carts', 'cart_items', 'inventory',
        // Financial
        'transactions', 'payments', 'invoices', 'subscriptions', 'plans', 'prices',
        // Communication
        'messages', 'notifications', 'emails', 'comments', 'reviews',
        // Content
        'posts', 'articles', 'pages', 'media', 'files', 'documents',
        // Analytics/Logs
        'events', 'logs', 'activity_logs', 'analytics', 'sessions', 'page_views',
        // Settings
        'settings', 'configurations', 'preferences',
        // Misc
        'items', 'entries', 'records', 'data', 'tags', 'labels',
        // Dashboards
        'dashboards', 'widgets', 'dashboard_widgets', 'metrics', 'reports',
        // Integrations
        'integrations', 'connections', 'webhooks', 'api_keys',
        // Tasks/Projects
        'tasks', 'projects', 'milestones', 'tickets', 'issues',
        // HR
        'employees', 'departments', 'roles', 'user_roles', 'permissions',
        // Mappings
        'data_mappings', 'field_mappings', 'selected_tables',
      ];

      // Test each table to see if it's accessible
      const accessibleTables: string[] = [];
      
      // Process tables in parallel batches for speed
      const batchSize = 10;
      for (let i = 0; i < commonTables.length; i += batchSize) {
        const batch = commonTables.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (tableName) => {
            const { error } = await externalSupabase
              .from(tableName)
              .select('*', { count: 'exact', head: true })
              .limit(1);
            
            if (!error) {
              return tableName;
            }
            throw new Error('Not accessible');
          })
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            accessibleTables.push(result.value);
          }
        }
      }

      tableNames = accessibleTables;
    }

    // Now fetch detailed info for each accessible table
    const tables: TableInfo[] = [];

    for (const tableName of tableNames) {
      try {
        const { data, error, count } = await externalSupabase
          .from(tableName)
          .select('*', { count: 'exact', head: false })
          .limit(5);

        if (!error && data) {
          // Extract column info from sample data
          const columns: ColumnInfo[] = [];
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
        // Table not accessible, skip
      }
    }

    // Sort tables alphabetically for better UX
    tables.sort((a, b) => a.name.localeCompare(b.name));

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
