import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  orgId: string;
  tableName?: string;
  limit?: number;
}

interface RowData {
  [key: string]: unknown;
}

interface AggregatedCustomer {
  customerKey: string;
  customerName: string | null;
  customerEmail: string | null;
  recencyDays: number;
  frequency: number;
  monetary: number;
}

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

const daysFromNow = (dateInput: string | null | undefined): number => {
  if (!dateInput) return 999;
  const ts = new Date(dateInput).getTime();
  if (Number.isNaN(ts)) return 999;
  return Math.max(0, Math.round((Date.now() - ts) / (1000 * 60 * 60 * 24)));
};

const quantileScore = (value: number, sorted: number[], higherIsBetter = true): number => {
  if (sorted.length <= 1) return 3;
  const idx = sorted.findIndex(v => v >= value);
  const rank = idx === -1 ? sorted.length - 1 : idx;
  const percentile = rank / (sorted.length - 1);
  const raw = higherIsBetter ? 1 + Math.round(percentile * 4) : 5 - Math.round(percentile * 4);
  return Math.max(1, Math.min(5, raw));
};

const resolveSegment = (r: number, f: number): string => {
  if (r >= 4 && f >= 4) return "Champions";
  if (r >= 4 && f >= 2) return "Promissores";
  if (r <= 2 && f >= 4) return "Em Risco";
  if (r <= 2 && f <= 2) return "Hibernando";
  return "Regulares";
};

const resolveField = (available: string[], preferred: string[], fallbackContains: string[]): string | null => {
  for (const p of preferred) {
    const exact = available.find(c => c.toLowerCase() === p.toLowerCase());
    if (exact) return exact;
  }
  for (const token of fallbackContains) {
    const candidate = available.find(c => c.toLowerCase().includes(token.toLowerCase()));
    if (candidate) return candidate;
  }
  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientSupabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const internalSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await clientSupabase.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Invalid auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orgId, tableName, limit = 10000 }: RequestBody = await req.json();
    if (!orgId) {
      return new Response(JSON.stringify({ error: "orgId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    const { data: profile } = await internalSupabase
      .from("profiles")
      .select("org_id")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: userRoles } = await internalSupabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isPlatformAdmin = (userRoles || []).some(r => r.role === "platform_admin");
    const canAccessOrg = isPlatformAdmin || profile?.org_id === orgId;
    if (!canAccessOrg) {
      return new Response(JSON.stringify({ error: "Access denied for this organization" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: integration, error: integrationError } = await internalSupabase
      .from("integrations")
      .select("id, config")
      .eq("org_id", orgId)
      .eq("type", "supabase")
      .eq("status", "connected")
      .maybeSingle();

    if (integrationError || !integration) {
      return new Response(JSON.stringify({ error: "No connected Supabase integration found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = integration.config as { projectUrl?: string; anonKey?: string };
    if (!config.projectUrl || !config.anonKey) {
      return new Response(JSON.stringify({ error: "Invalid integration credentials" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sourceTable = tableName || "";

    // 1) Try selected_tables (primary first)
    if (!sourceTable) {
      const { data: selectedTables } = await internalSupabase
        .from("selected_tables")
        .select("table_name, is_primary")
        .eq("integration_id", integration.id)
        .order("is_primary", { ascending: false })
        .limit(1);
      sourceTable = selectedTables?.[0]?.table_name || "";
    }

    // 2) Fallback: check data_mappings for a source_table
    if (!sourceTable) {
      const { data: mappingRows } = await internalSupabase
        .from("data_mappings")
        .select("source_table")
        .eq("org_id", orgId)
        .limit(1);
      sourceTable = mappingRows?.[0]?.source_table || "";
    }

    // 3) Fallback: auto-discover tables from the external Supabase
    if (!sourceTable) {
      const externalDiscovery = createClient(config.projectUrl, config.anonKey);
      const commonTables = ["leads", "customers", "contacts", "orders", "sales", "clientes", "vendas", "pedidos", "transactions"];
      for (const candidate of commonTables) {
        const { data: probe, error: probeError } = await externalDiscovery
          .from(candidate)
          .select("*")
          .limit(1);
        if (!probeError && probe && probe.length > 0) {
          sourceTable = candidate;
          break;
        }
      }
    }

    if (!sourceTable) {
      return new Response(JSON.stringify({ error: "No source table found. Configure selected_tables or data_mappings, or ensure your external DB has a known table (leads, customers, contacts, orders, sales).", debug: { integrationId: integration.id } }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: mappings } = await internalSupabase
      .from("data_mappings")
      .select("source_column, target_metric")
      .eq("org_id", orgId)
      .eq("source_table", sourceTable);

    const externalSupabase = createClient(config.projectUrl, config.anonKey);
    const { data: previewRows, error: previewError } = await externalSupabase
      .from(sourceTable)
      .select("*")
      .limit(1);

    if (previewError) {
      return new Response(JSON.stringify({ error: `Failed to read table ${sourceTable}: ${previewError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const availableColumns = Object.keys((previewRows && previewRows[0]) || {});
    if (availableColumns.length === 0) {
      return new Response(JSON.stringify({ error: `Table ${sourceTable} returned no readable columns` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mappedColumn = (metric: string): string | null =>
      mappings?.find(m => m.target_metric === metric)?.source_column || null;

    const customerField = resolveField(
      availableColumns,
      [mappedColumn("customer_id"), mappedColumn("lead_id"), mappedColumn("email")].filter(Boolean) as string[],
      ["customer", "cliente", "lead_id", "email", "user_id", "contact"],
    );

    const recencyField = resolveField(
      availableColumns,
      [mappedColumn("created_date")].filter(Boolean) as string[],
      ["updated_at", "created_at", "date", "data", "last", "timestamp"],
    );

    const frequencyField = resolveField(
      availableColumns,
      [mappedColumn("frequency")].filter(Boolean) as string[],
      ["frequency", "count", "orders", "qtd", "total"],
    );

    const monetaryField = resolveField(
      availableColumns,
      [mappedColumn("revenue"), mappedColumn("monetary"), mappedColumn("value"), mappedColumn("mrr")].filter(Boolean) as string[],
      ["revenue", "amount", "valor", "value", "price", "total_spent", "mrr", "cost"],
    );

    const nameField = resolveField(availableColumns, [], ["name", "nome", "customer_name", "lead_name"]);
    const emailField = resolveField(availableColumns, [], ["email", "mail"]);

    if (!customerField || !recencyField) {
      return new Response(
        JSON.stringify({
          error: "Could not infer required fields (customer identifier and recency date)",
          debug: { customerField, recencyField, availableColumns },
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: rawRows, error: dataError } = await externalSupabase
      .from(sourceTable)
      .select("*")
      .limit(limit);

    if (dataError) {
      return new Response(JSON.stringify({ error: `Failed to fetch source rows: ${dataError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const grouped = new Map<string, RowData[]>();
    for (const row of (rawRows || []) as RowData[]) {
      const rawCustomer = row[customerField];
      const key = String(rawCustomer ?? "").trim().toLowerCase();
      if (!key) continue;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    const customers: AggregatedCustomer[] = Array.from(grouped.entries()).map(([customerKey, rows]) => {
      const sortedByRecency = [...rows].sort(
        (a, b) => new Date(String(b[recencyField] ?? "")).getTime() - new Date(String(a[recencyField] ?? "")).getTime(),
      );
      const latest = sortedByRecency[0];
      const recencyDays = daysFromNow(String(latest[recencyField] ?? null));

      const frequency = frequencyField
        ? rows.reduce((acc, row) => {
            const n = Number(row[frequencyField]);
            return acc + (Number.isFinite(n) ? n : 0);
          }, 0) || rows.length
        : rows.length;

      const monetary = monetaryField
        ? rows.reduce((acc, row) => {
            const n = Number(row[monetaryField]);
            return acc + (Number.isFinite(n) ? n : 0);
          }, 0)
        : 0;

      // Build a meaningful display name even when there's no name column
      let displayName: string | null = null;
      if (nameField) {
        displayName = String(latest[nameField] ?? "").trim() || null;
      }
      if (!displayName) {
        // Use the customer identifier (e.g. lead_id) as a readable label
        const rawId = String(latest[customerField] ?? customerKey);
        displayName = `Lead #${rawId}`;
      }

      const displayEmail = emailField ? String(latest[emailField] ?? "").trim() || null : null;

      return {
        customerKey,
        customerName: displayName,
        customerEmail: displayEmail,
        recencyDays,
        frequency: Math.max(1, Math.round(frequency)),
        monetary: Math.max(0, monetary),
      };
    });

    if (customers.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No customer rows found", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recencySorted = customers.map(c => c.recencyDays).sort((a, b) => a - b);
    const frequencySorted = customers.map(c => c.frequency).sort((a, b) => a - b);
    const monetarySorted = customers.map(c => c.monetary).sort((a, b) => a - b);

    const rowsToUpsert = customers.map(c => {
      const rScore = quantileScore(c.recencyDays, recencySorted, false);
      const fScore = quantileScore(c.frequency, frequencySorted, true);
      const mScore = quantileScore(c.monetary, monetarySorted, true);
      const rfmScore = `${rScore}${fScore}${mScore}`;
      const rfmSegment = resolveSegment(rScore, fScore);
      return {
        org_id: orgId,
        customer_key: c.customerKey,
        customer_name: c.customerName,
        customer_email: c.customerEmail,
        source_table: sourceTable,
        recency_days: c.recencyDays,
        frequency: c.frequency,
        monetary: c.monetary,
        r_score: rScore,
        f_score: fScore,
        m_score: mScore,
        rfm_score: rfmScore,
        rfm_segment: rfmSegment,
        calculated_at: new Date().toISOString(),
      };
    });

    const { error: upsertError } = await internalSupabase
      .from("customer_rfm_scores")
      .upsert(rowsToUpsert, { onConflict: "org_id,customer_key" });

    if (upsertError) {
      return new Response(JSON.stringify({ error: `Failed to persist RFM scores: ${upsertError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const avgRecency = rowsToUpsert.reduce((acc, row) => acc + row.recency_days, 0) / rowsToUpsert.length;
    const avgFrequency = rowsToUpsert.reduce((acc, row) => acc + row.frequency, 0) / rowsToUpsert.length;
    const totalMonetary = rowsToUpsert.reduce((acc, row) => acc + Number(row.monetary || 0), 0);

    return new Response(
      JSON.stringify({
        success: true,
        sourceTable,
        count: rowsToUpsert.length,
        summary: {
          customers: rowsToUpsert.length,
          avgRecencyDays: Math.round(avgRecency),
          avgFrequency: Number(avgFrequency.toFixed(2)),
          totalMonetary: Number(totalMonetary.toFixed(2)),
          confidence: clamp(rowsToUpsert.length / 100),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
