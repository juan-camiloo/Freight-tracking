// Edge Function: list-profiles
// Objetivo:
// - Validar identidad del usuario via JWT Bearer.
// - Permitir acceso solo a perfiles internos.
// - Retornar lista completa de perfiles para pantallas administrativas.

import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST, GET",
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  // Respuesta inmediata al preflight CORS sin procesar autenticacion.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1) Verificar que el encabezado Authorization exista y tenga formato Bearer.
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Falta el encabezado de autorizacion", error_key: "listProfiles.authHeaderMissing" },
        401,
      );
    }

    // Extraer el token JWT eliminando el prefijo "Bearer ".
    const token = authHeader.replace("Bearer ", "").trim();

    // 2) Instanciar cliente con service role para poder consultar tablas
    // protegidas por RLS sin restricciones de politicas de fila.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 3) Validar el JWT contra Supabase Auth para obtener el usuario autenticado.
    // Se usa el mismo cliente admin porque getUser con service role
    // no requiere el anon key para resolver la sesion.
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse(
        {
          error: "Token o sesion invalida",
          error_key: "listProfiles.invalidSession",
          details: authError?.message,
        },
        401,
      );
    }

    // 4) Verificar que el usuario autenticado tenga perfil interno antes de exponer
    // datos de otros usuarios. Usuarios externos no deben acceder a esta ruta.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_internal")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.is_internal) {
      return jsonResponse(
        {
          error: "El perfil no es interno",
          error_key: "listProfiles.notInternal",
          details: profileError?.message,
        },
        403,
      );
    }

    // 5) Obtener todos los perfiles ordenados por fecha de creacion descendente
    // para que los registros mas recientes aparezcan primero en la vista administrativa.
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) {
      return jsonResponse(
        {
          error: "No se pudieron cargar los perfiles",
          error_key: "listProfiles.loadError",
          details: profilesError.message,
        },
        400,
      );
    }

    return jsonResponse(profiles ?? [], 200);
  } catch (error) {
    // Captura errores no controlados para evitar exponer stack traces al cliente.
    return jsonResponse(
      {
        error: "Error interno del servidor",
        error_key: "listProfiles.internalError",
        details: error instanceof Error ? error.message : "Ocurrio un error inesperado",
      },
      500,
    );
  }
});
