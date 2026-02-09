import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser(token);
    
    if (claimsError || !claimsData.user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requesterId = claimsData.user.id;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if requester is admin OR super_admin
    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", requesterId)
      .in("role", ["admin", "super_admin"])
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "Solo los administradores pueden crear usuarios" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requesterIsSuperAdmin = roleData.role === "super_admin";

    // Parse request body
    const { email, password, fullName, phone, role, storeName, organizacionId } = await req.json();

    if (!email || !password || !fullName || !role) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validRoles = ["admin", "motorizado", "cliente", "despachador"];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: "Rol inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (role === "cliente" && !storeName) {
      return new Response(
        JSON.stringify({ error: "El nombre de la tienda es obligatorio para clientes" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine organizacion_id:
    // - super_admin can specify any org
    // - regular admin uses their own org
    let resolvedOrgId: string;
    if (requesterIsSuperAdmin && organizacionId) {
      resolvedOrgId = organizacionId;
    } else {
      // Get requester's own org
      const { data: requesterProfile } = await adminClient
        .from("profiles")
        .select("organizacion_id")
        .eq("user_id", requesterId)
        .maybeSingle();
      resolvedOrgId = requesterProfile?.organizacion_id || "a0000000-0000-0000-0000-000000000001";
    }

    // Create user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      if (createError.message?.includes("already been registered")) {
        return new Response(
          JSON.stringify({ error: "Este email ya está registrado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: "Error al crear el usuario" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create profile with organizacion_id
    const { error: profileError } = await adminClient.from("profiles").upsert({
      user_id: newUser.user.id,
      full_name: fullName,
      email,
      phone: phone || null,
      store_name: role === "cliente" ? storeName : null,
      organizacion_id: resolvedOrgId,
    }, { onConflict: "user_id" });

    if (profileError) {
      console.error("Profile creation error:", profileError);
    }

    // Assign role with organizacion_id
    const { error: assignRoleError } = await adminClient.from("user_roles").insert({
      user_id: newUser.user.id,
      role,
      organizacion_id: resolvedOrgId,
    });

    if (assignRoleError) {
      console.error("Role assignment error:", assignRoleError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { 
          id: newUser.user.id, 
          email: newUser.user.email,
          fullName,
          role,
          organizacionId: resolvedOrgId,
        } 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
