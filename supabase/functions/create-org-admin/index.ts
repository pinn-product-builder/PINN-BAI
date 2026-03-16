import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateAdminRequest {
  email: string;
  password: string;
  fullName: string;
  orgId: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the request is from an authenticated platform admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create regular client to verify the caller is a platform admin
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: callerError } = await supabase.auth.getUser();
    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is platform admin
    const { data: isPlatformAdmin } = await supabaseAdmin.rpc('is_platform_admin', { 
      _user_id: caller.id 
    });
    
    if (!isPlatformAdmin) {
      return new Response(
        JSON.stringify({ error: "Only platform admins can create organization admins" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, fullName, orgId }: CreateAdminRequest = await req.json();

    // Validate input
    if (!email || !password || !fullName || !orgId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, password, fullName, orgId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify org exists
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("id", orgId)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);
    
    let userId: string;
    let isNewUser = false;
    
    if (existingUser) {
      // User exists - check if already assigned to an org
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("org_id")
        .eq("user_id", existingUser.id)
        .single();
      
      if (existingProfile?.org_id) {
        return new Response(
          JSON.stringify({ error: "Este email já está associado a outra organização. Use um email diferente." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // User exists but has no org - we can use them
      userId = existingUser.id;
      console.log(`Using existing user ${email} for org ${orgId}`);
    } else {
      // Create new user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

      if (authError) {
        console.error("Auth error:", authError);
        return new Response(
          JSON.stringify({ error: authError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      userId = authData.user.id;
      isNewUser = true;
    }

    // Update profile with org_id (trigger already created base profile)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        org_id: orgId,
        full_name: fullName,
        email: email,
      })
      .eq("user_id", userId);

    if (profileError) {
      console.error("Profile error:", profileError);
      // Cleanup: delete the created user only if we created it
      if (isNewUser) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }
      return new Response(
        JSON.stringify({ error: "Failed to update profile: " + profileError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already has client_admin role
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "client_admin")
      .maybeSingle();

    // Only insert role if it doesn't exist
    if (!existingRole) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "client_admin",
        });

      if (roleError) {
        console.error("Role error:", roleError);
        // Cleanup only if we created the user
        if (isNewUser) {
          await supabaseAdmin.from("profiles").update({ org_id: null }).eq("user_id", userId);
          await supabaseAdmin.auth.admin.deleteUser(userId);
        }
        return new Response(
          JSON.stringify({ error: "Failed to assign role: " + roleError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`Created admin user ${email} for org ${orgId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId,
        message: `Admin user ${email} created successfully` 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in create-org-admin:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("Error stack:", stack);
    return new Response(
      JSON.stringify({ 
        error: message,
        details: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
