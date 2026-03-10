// Edge Function: invite-user
// Objetivo:
// - Validar que quien invita este autenticado y sea usuario interno.
// - Invitar por email usando Supabase Admin API.
// - Ajustar flags del perfil creado por trigger (is_internal).

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
    // 1) Validar encabezado de autorizacion.
    const authHeader =
      req.headers.get("authorization") ?? req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Falta el encabezado de autorizacion" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // 2) Cliente anon para resolver usuario actual desde JWT.
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
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

    // 3) Datos de invitacion enviados por frontend.
    const { email, is_internal, nickname } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Cliente service role para acciones administrativas.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 5) Solo perfiles internos pueden invitar.
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

    // 6) Invitacion por email. El trigger de BD crea el perfil base.
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        nickname: nickname || null,
      },
    });

    if (error) {
      return new Response(JSON.stringify({
        error: error.message,
        code: error.code,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7) Espera corta para evitar carrera antes de actualizar el perfil.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 8) Ajustar atributo interno/externo del perfil recien creado.
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ is_internal: is_internal })
      .eq("id", data.user.id);

    if (updateError) {
      // No bloqueamos respuesta: el usuario ya fue invitado correctamente.
      console.error("Error al actualizar perfil:", updateError);
    }

    return new Response(JSON.stringify({
      success: true,
      user: { id: data.user.id, email: data.user.email },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Error desconocido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
