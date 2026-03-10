// Archivo: C:\Users\usuario\freight-tracking\supabase\functions\invite-user\index.ts
// Descripcion: Este archivo forma parte de la logica principal de la aplicacion.

import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader =
      req.headers.get("authorization") ?? req.headers.get("Authorization");
    
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Falta el encabezado de autorizacion" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token o sesion invalida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, is_internal, nickname } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verificar que el usuario actual es interno
    const { data: profile, error: profileFetchError } = await supabase
      .from("profiles")
      .select("is_internal")
      .eq("id", user.id)
      .single();

    if (profileFetchError || !profile?.is_internal) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Invitar usuario - el trigger creará el perfil automáticamente
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        nickname: nickname || null
      }
    });
    
    if (error) {
    console.error("Error al invitar:", error);
      return new Response(JSON.stringify({ 
        error: error.message,
        code: error.code 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("User invited:", data.user.id);

    // Esperar un poco para que el trigger cree el perfil
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Actualizar is_internal
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ is_internal: is_internal })
      .eq("id", data.user.id);

    if (updateError) {
      console.error("Error al actualizar perfil:", updateError);
      // No retornar error, el usuario ya fue creado e invitado
    }

    return new Response(JSON.stringify({ 
      success: true, 
      user: { id: data.user.id, email: data.user.email }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("Error en Edge Function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Error desconocido"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

