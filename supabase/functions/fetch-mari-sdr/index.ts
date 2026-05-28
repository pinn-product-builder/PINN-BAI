import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const mariUrl = Deno.env.get("MARI_SUPABASE_URL");
    const mariKey = Deno.env.get("MARI_SUPABASE_KEY");

    if (!mariUrl || !mariKey) {
      return new Response(
        JSON.stringify({ error: "MARI_SUPABASE_URL ou MARI_SUPABASE_KEY não configurados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mari = createClient(mariUrl, mariKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await mari
      .from("sdr_sessions")
      .select(
        "session_id, phone, lead_name, company, sector, stage, pain, role, " +
        "lead_score, urgency_level, follow_up_count, briefing_sent, " +
        "confirmed_slot, last_outbound_at, last_inbound_at, " +
        "handoff, optout, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Mari query error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ sessions: data || [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fetch-mari-sdr error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
