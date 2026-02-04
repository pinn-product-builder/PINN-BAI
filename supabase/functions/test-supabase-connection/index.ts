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

    let tableNames: string[] = [];
    let discoveryMethod = 'unknown';
    
    // STRATEGY 1: Try RPC function get_public_tables (if user created it)
    try {
      const { data: schemaData, error: schemaError } = await externalSupabase
        .rpc('get_public_tables');
      
      if (!schemaError && schemaData && Array.isArray(schemaData) && schemaData.length > 0) {
        tableNames = schemaData.map((t: { table_name: string }) => t.table_name);
        discoveryMethod = 'rpc_function';
        console.log(`Found ${tableNames.length} tables via RPC function`);
      }
    } catch (e) {
      console.log('RPC get_public_tables not available:', e);
    }

    // STRATEGY 2: Try RPC function list_tables (alternative name)
    if (tableNames.length === 0) {
      try {
        const { data: schemaData, error: schemaError } = await externalSupabase
          .rpc('list_tables');
        
        if (!schemaError && schemaData && Array.isArray(schemaData) && schemaData.length > 0) {
          tableNames = schemaData.map((t: { table_name?: string; name?: string }) => 
            t.table_name || t.name || ''
          ).filter(Boolean);
          discoveryMethod = 'rpc_list_tables';
          console.log(`Found ${tableNames.length} tables via list_tables RPC`);
        }
      } catch (e) {
        console.log('RPC list_tables not available:', e);
      }
    }

    // STRATEGY 3: Comprehensive table discovery by testing known patterns
    if (tableNames.length === 0) {
      // Massive list of common table names (300+)
      const commonTables = [
        // Core/Auth
        'users', 'profiles', 'accounts', 'sessions', 'tokens', 'auth_tokens', 'refresh_tokens',
        'user_sessions', 'user_tokens', 'user_settings', 'user_preferences', 'user_profiles',
        
        // Organizations/Teams
        'organizations', 'orgs', 'companies', 'teams', 'workspaces', 'tenants', 'clients',
        'org_members', 'team_members', 'workspace_members', 'organization_users',
        
        // Contacts/CRM
        'leads', 'contacts', 'customers', 'prospects', 'opportunities', 'deals', 'pipelines',
        'pipeline_stages', 'sales', 'sales_orders', 'quotes', 'proposals', 'contracts',
        'customer_contacts', 'contact_notes', 'lead_sources', 'lead_status', 'conversions',
        
        // E-commerce
        'products', 'categories', 'product_categories', 'subcategories', 'brands', 'suppliers',
        'inventory', 'stock', 'warehouses', 'locations', 'variants', 'product_variants',
        'skus', 'product_images', 'product_attributes', 'attributes', 'attribute_values',
        'orders', 'order_items', 'order_history', 'order_status', 'shipments', 'shipping',
        'carts', 'cart_items', 'shopping_carts', 'wishlists', 'wishlist_items',
        'discounts', 'coupons', 'promotions', 'promo_codes', 'gift_cards',
        
        // Payments/Finance
        'transactions', 'payments', 'payment_methods', 'invoices', 'invoice_items',
        'billing', 'billing_history', 'subscriptions', 'subscription_plans', 'plans',
        'prices', 'pricing', 'charges', 'refunds', 'credits', 'wallets', 'balances',
        'bank_accounts', 'payouts', 'transfers', 'fees', 'taxes', 'tax_rates',
        'expenses', 'expense_categories', 'budgets', 'financial_reports', 'accounts_payable',
        'accounts_receivable', 'ledger', 'ledger_entries', 'journal_entries',
        
        // Communication
        'messages', 'chats', 'chat_rooms', 'conversations', 'threads', 'comments',
        'replies', 'mentions', 'notifications', 'alerts', 'announcements',
        'emails', 'email_templates', 'email_logs', 'sms', 'sms_logs',
        'push_notifications', 'in_app_notifications',
        
        // Content/CMS
        'posts', 'articles', 'blogs', 'blog_posts', 'pages', 'sections', 'blocks',
        'media', 'files', 'uploads', 'documents', 'attachments', 'assets', 'images',
        'videos', 'galleries', 'albums', 'folders', 'tags', 'tag_relations',
        'labels', 'categories', 'menus', 'menu_items', 'navigation', 'widgets',
        'templates', 'layouts', 'themes', 'translations', 'locales', 'languages',
        
        // Reviews/Feedback
        'reviews', 'ratings', 'testimonials', 'feedback', 'surveys', 'survey_responses',
        'questions', 'answers', 'faqs', 'help_articles', 'support_tickets', 'tickets',
        
        // Analytics/Logs
        'events', 'event_logs', 'activity', 'activity_logs', 'audit_logs', 'logs',
        'analytics', 'metrics', 'stats', 'statistics', 'page_views', 'visits',
        'sessions', 'user_activity', 'tracking', 'conversions', 'goals',
        'reports', 'report_data', 'insights', 'dashboards', 'dashboard_widgets',
        
        // Settings/Config
        'settings', 'configurations', 'config', 'options', 'preferences', 'features',
        'feature_flags', 'flags', 'toggles', 'system_settings', 'app_settings',
        'metadata', 'meta', 'parameters', 'variables', 'constants',
        
        // Tasks/Projects
        'tasks', 'task_lists', 'todos', 'to_dos', 'checklists', 'checklist_items',
        'projects', 'project_members', 'milestones', 'sprints', 'epics', 'stories',
        'issues', 'bugs', 'tickets', 'boards', 'columns', 'cards', 'lanes',
        'time_entries', 'time_tracking', 'timesheets', 'work_logs',
        
        // HR/People
        'employees', 'staff', 'personnel', 'departments', 'divisions', 'branches',
        'positions', 'job_titles', 'salaries', 'payroll', 'benefits', 'leave',
        'leave_requests', 'attendance', 'schedules', 'shifts', 'holidays',
        'performance_reviews', 'goals', 'objectives', 'kpis', 'okrs',
        
        // Roles/Permissions
        'roles', 'permissions', 'role_permissions', 'user_roles', 'capabilities',
        'access_control', 'acl', 'groups', 'user_groups', 'group_members',
        'policies', 'rules', 'restrictions', 'scopes',
        
        // Integrations
        'integrations', 'connections', 'connectors', 'webhooks', 'webhook_logs',
        'api_keys', 'api_tokens', 'oauth_tokens', 'oauth_clients', 'apps',
        'external_accounts', 'linked_accounts', 'sync_logs', 'sync_status',
        
        // Data/Mappings
        'data_mappings', 'field_mappings', 'mappings', 'transformations', 'rules',
        'selected_tables', 'data_sources', 'sources', 'imports', 'exports',
        'migrations', 'migration_logs', 'seeds', 'fixtures',
        
        // Addresses/Locations
        'addresses', 'locations', 'places', 'countries', 'states', 'cities',
        'regions', 'districts', 'zip_codes', 'postal_codes', 'geo_locations',
        'coordinates', 'maps', 'routes', 'directions',
        
        // Scheduling/Calendar
        'events', 'calendar_events', 'appointments', 'bookings', 'reservations',
        'availability', 'slots', 'time_slots', 'schedules', 'recurring_events',
        'reminders', 'alarms', 'deadlines',
        
        // Education/Learning
        'courses', 'lessons', 'modules', 'chapters', 'quizzes', 'exams',
        'questions', 'answers', 'grades', 'scores', 'certificates', 'enrollments',
        'students', 'instructors', 'teachers', 'classes', 'classrooms',
        
        // Healthcare
        'patients', 'doctors', 'appointments', 'medical_records', 'prescriptions',
        'diagnoses', 'treatments', 'medications', 'lab_results', 'vitals',
        
        // Real Estate
        'properties', 'listings', 'real_estate', 'rentals', 'leases', 'units',
        'buildings', 'floors', 'rooms', 'amenities', 'inspections',
        
        // Inventory specific
        'items', 'item_categories', 'stock_movements', 'purchase_orders', 'suppliers',
        'vendor', 'vendors', 'manufacturer', 'manufacturers', 'batches', 'serial_numbers',
        
        // Social
        'friends', 'followers', 'following', 'connections', 'relationships',
        'likes', 'shares', 'reposts', 'bookmarks', 'saves', 'favorites',
        'groups', 'communities', 'forums', 'topics', 'discussions',
        
        // Misc common
        'items', 'entries', 'records', 'data', 'rows', 'objects', 'entities',
        'history', 'versions', 'revisions', 'backups', 'archives', 'trash',
        'queue', 'jobs', 'background_jobs', 'scheduled_tasks', 'cron_jobs',
        'cache', 'temp', 'temporary', 'staging', 'draft', 'drafts',
        'ai_anomalies', 'alert_triggers', 'dashboard_templates', 'data_joins',
      ];

      // Remove duplicates
      const uniqueTables = [...new Set(commonTables)];

      // Test each table to see if it's accessible (parallel batches for speed)
      const accessibleTables: string[] = [];
      const batchSize = 20;
      
      for (let i = 0; i < uniqueTables.length; i += batchSize) {
        const batch = uniqueTables.slice(i, i + batchSize);
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
      discoveryMethod = 'pattern_discovery';
      console.log(`Found ${tableNames.length} tables via pattern discovery`);
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
          discoveryMethod,
          message: 'Conexão bem-sucedida, mas nenhuma tabela acessível foi encontrada. Verifique as políticas RLS ou crie a função get_public_tables() no banco.',
          hint: `Para listar TODAS as tabelas, crie esta função no seu banco Supabase:
          
CREATE OR REPLACE FUNCTION get_public_tables()
RETURNS TABLE(table_name text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT table_name::text 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
$$;`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        tables,
        discoveryMethod,
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
    // Check if it's a UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return 'uuid';
    // Check if it's an email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';
    // Check if it's a URL
    if (/^https?:\/\//.test(value)) return 'url';
    return 'string';
  }
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'unknown';
}
