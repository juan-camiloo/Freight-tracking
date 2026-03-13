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
    // 1) Verificar que el encabezado Authorization exista y tenga formato Bearer.
    const authHeader =
      req.headers.get("authorization") ?? req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Falta el encabezado de autorizacion" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // 2) Cliente anon para resolver el usuario desde el JWT sin privilegios elevados.
    // Se usa anon key intencionalmente: solo necesitamos identificar al solicitante,
    // no acceder a tablas protegidas todavia.
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

    // 3) Extraer datos de la invitacion enviados por el frontend.
    const { email, is_internal, nickname } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Cliente service role para acciones administrativas como invitar usuarios
    // y actualizar perfiles sin restricciones de RLS.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 5) Verificar que el usuario solicitante tenga perfil interno.
    // Solo personal interno puede crear nuevas cuentas en el sistema.
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

    // 6) Enviar invitacion por email. Un trigger de BD crea automaticamente
    // el perfil base al insertarse el usuario en auth.users.
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

    // 7) Espera minima para que el trigger de BD finalice antes de intentar
    // actualizar el perfil. Sin este delay puede haber una condicion de carrera
    // donde el perfil aun no existe al momento del UPDATE.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 8) Establecer si el nuevo usuario es interno o externo.
    // El trigger crea el perfil con valores por defecto, asi que este UPDATE
    // es el que aplica la configuracion real segun el rol asignado en la invitacion.
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ is_internal: is_internal })
      .eq("id", data.user.id);

    if (updateError) {
      // Error no critico: el usuario ya fue invitado exitosamente.
      // El perfil puede corregirse manualmente si es necesario.
      console.error("Error al actualizar perfil:", updateError);
    }

    return new Response(JSON.stringify({
      success: true,
      user: { id: data.user.id, email: data.user.email },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // Captura errores no controlados para evitar exponer stack traces al cliente.
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