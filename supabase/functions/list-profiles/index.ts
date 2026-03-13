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

serve(async (req) => {
  // Respuesta inmediata al preflight CORS sin procesar autenticacion.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1) Verificar que el encabezado Authorization exista y tenga formato Bearer.
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Falta el encabezado de autorizacion" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({
        error: "Token o sesion invalida",
        details: authError?.message,
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Verificar que el usuario autenticado tenga perfil interno antes de exponer
    // datos de otros usuarios. Usuarios externos no deben acceder a esta ruta.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_internal")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.is_internal) {
      return new Response(JSON.stringify({ error: profileError?.message || "El perfil no es interno" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5) Obtener todos los perfiles ordenados por fecha de creacion descendente
    // para que los registros mas recientes aparezcan primero en la vista administrativa.
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) {
      return new Response(JSON.stringify({ error: profilesError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(profiles), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    // Captura errores no controlados para evitar exponer stack traces al cliente.
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Ocurrio un error inesperado",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});