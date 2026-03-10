// Edge Function: create-shipment
// Objetivo:
// - Validar sesion del usuario solicitante.
// - Crear una carga en shipments y su relacion profile_shipment.
// - Registrar la primera novedad en shipment_updates.

import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

export const config = { auth: true };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Shipment = {
  do_number: string;
  shipment_type?: string | null;
  origin: string;
  destination: string;
  etd?: string | null;
  eta?: string | null;
  incoterm?: string | null;
  current_status?: string | null;
  current_location?: string | null;
  exporter?: string | null;
  consignee?: string | null;
  air_waybill?: string | null;
  flight_vessel?: string | null;
  container_number?: string | null;
  carrier?: string | null;
  owner_email?: string | null;
  observation?: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1) Validar JWT en Authorization header.
    const authHeader =
      req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("Falta el encabezado de autorizacion", {
        status: 401,
        headers: corsHeaders,
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // 2) Resolver usuario autenticado.
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({
        error: "Token o sesion invalida",
        details: authError?.message,
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Cliente admin para validar permisos e insertar en tablas protegidas.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Solo usuarios internos pueden crear cargas.
    const { data: requesterProfile, error: requesterProfileError } = await supabase
      .from("profiles")
      .select("is_internal")
      .eq("id", user.id)
      .single();

    if (requesterProfileError || !requesterProfile?.is_internal) {
      return new Response("No autorizado: solo usuarios internos pueden crear cargas", {
        status: 403,
        headers: corsHeaders,
      });
    }

    // 4) Validar payload obligatorio.
    const body: Shipment = await req.json();
    const { do_number, origin, destination, owner_email } = body;

    if (!do_number || !origin || !destination) {
      return new Response("DO, Origen y Destino son obligatorios", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 5) Por defecto, el dueno de la carga es quien crea el registro.
    let ownerId = user.id;

    // Si se envia owner_email, reasignamos propiedad a ese perfil.
    if (owner_email) {
      const { data: ownerProfile, error: ownerError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", owner_email)
        .maybeSingle();

      if (ownerError || !ownerProfile) {
        return new Response("No se encontro el correo del propietario", {
          status: 400,
          headers: corsHeaders,
        });
      }

      ownerId = ownerProfile.id;
    }

    // 6) Crear carga principal.
    const { data: shipmentData, error: shipmentError } = await supabase
      .from("shipments")
      .insert({
        do_number: body.do_number,
        shipment_type: body.shipment_type ?? null,
        origin: body.origin,
        destination: body.destination,
        etd: body.etd ?? null,
        eta: body.eta ?? null,
        incoterm: body.incoterm ?? null,
        current_status: body.current_status ?? null,
        current_location: body.current_location ?? null,
        exporter: body.exporter ?? null,
        consignee: body.consignee ?? null,
        air_waybill: body.air_waybill ?? null,
        flight_vessel: body.flight_vessel ?? null,
        container_number: body.container_number ?? null,
        carrier: body.carrier ?? null,
        client_id: ownerId,
      })
      .select()
      .single();

    if (shipmentError) {
      return new Response(shipmentError.message, {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 7) Asegurar relacion usuario-carga para RLS y vistas del cliente.
    const { error: relationError } = await supabase
      .from("profile_shipment")
      .upsert(
        { profile_id: ownerId, shipment_id: shipmentData.id },
        { onConflict: "profile_id,shipment_id" },
      );

    if (relationError) {
      // Rollback simple para no dejar carga huerfana sin relacion.
      await supabase.from("shipments").delete().eq("id", shipmentData.id);
      return new Response(relationError.message, {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 8) Registrar primera novedad de tracking.
    const { data: shipmentUpdateData, error: shipmentUpdateError } = await supabase
      .from("shipment_updates")
      .insert({
        shipment_id: shipmentData?.id,
        status: body.current_status ?? null,
        location: body.current_location ?? null,
        observation: body.observation || null,
      })
      .select()
      .single();

    if (shipmentUpdateError) {
      return new Response(shipmentUpdateError.message, {
        status: 400,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ ...shipmentData, ...shipmentUpdateData }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 201,
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Ocurrio un error inesperado",
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});
