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

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1) Verificar que el encabezado Authorization exista y tenga formato Bearer.
    const authHeader =
      req.headers.get("authorization") ?? req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Falta el encabezado de autorizacion", error_key: "inviteUser.authHeaderMissing" },
        401,
      );
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
      return jsonResponse(
        {
          error: "Token o sesion invalida",
          error_key: "inviteUser.invalidSession",
          details: authError?.message,
        },
        401,
      );
    }

    // 3) Extraer datos de la invitacion enviados por el frontend.
    const { email, is_internal, nickname } = await req.json();

    if (!email) {
      return jsonResponse(
        { error: "Email requerido", error_key: "inviteUser.emailRequired" },
        400,
      );
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
      return jsonResponse(
        { error: "No autorizado", error_key: "inviteUser.notAuthorized" },
        403,
      );
    }

    // 6) Enviar invitacion por email. Un trigger de BD crea automaticamente
    // el perfil base al insertarse el usuario en auth.users.
    const { data, error } = await supabase.auth.admin.createUser({
      email: email,
      email_confirm: true,
      user_metadata: {
        nickname: nickname || null,
      },
    })

    if (error) {
      return jsonResponse(
        {
          error: "No se pudo enviar la invitacion",
          error_key: "inviteUser.inviteError",
          details: error.message,
          code: error.code,
        },
        400,
      );
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

    return jsonResponse({
      success: true,
      user: { id: data.user.id, email: data.user.email },
    });
  } catch (error) {
    // Captura errores no controlados para evitar exponer stack traces al cliente.
    return jsonResponse(
      {
        error: "Error interno del servidor",
        error_key: "inviteUser.internalError",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      500,
    );
  }
});
