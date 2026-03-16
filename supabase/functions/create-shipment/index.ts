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
  tracking_number?: string | null;
  shipment_type?: string | null;
  origin: string;
  destination: string;
  etd?: string | null;
  eta?: string | null;
  documentary_cutoff?: string | null;
  incoterm?: string | null;
  status?: string | null;
  booking_status?: string | null;
  inspection_status?: string | null;
  free_days?: number | string | null;
  cargo_type?: string | null;
  current_status?: string | null;
  current_location?: string | null;
  exporter?: string | null;
  consignee?: string | null;
  air_waybill?: string | null;
  flight_vessel?: string | null;
  container_number?: string | null;
  carrier?: string | null;
  // Si se provee, la carga se asigna a este usuario en lugar de al creador.
  owner_email?: string | null;
  // Primera observacion de tracking que se registra en shipment_updates.
  observation?: string | null;
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
      return new Response("Falta el encabezado de autorizacion", {
        status: 401,
        headers: corsHeaders,
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // 2) Resolver el usuario autenticado a partir del JWT con cliente anon.
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

    // 3) Cliente service role para consultar y escribir en tablas protegidas por RLS.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verificar que el solicitante sea un usuario interno antes de crear la carga.
    // Los usuarios externos (clientes) solo pueden consultar, no crear registros.
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

    // 4) Validar que los campos minimos obligatorios esten presentes en el payload.
    const body: Shipment = await req.json();
    const { do_number, origin, destination, owner_email } = body;

    if (!do_number || !origin || !destination) {
      return new Response("DO, Origen y Destino son obligatorios", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 5) Por defecto la carga se asigna al usuario que la crea.
    // Si se proporciona owner_email, se reasigna al cliente correspondiente,
    // lo que permite a operadores crear cargas en nombre de sus clientes.
    let ownerId = user.id;

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

    // 6) Crear el registro principal de la carga.
    const normalizedFreeDays =
      body.free_days === null || body.free_days === undefined || body.free_days === ""
        ? null
        : Number(body.free_days);

    if (normalizedFreeDays !== null && Number.isNaN(normalizedFreeDays)) {
      return new Response("Free days debe ser un numero", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const optionalStatus =
      body.status && body.status.trim() !== "" ? { status: body.status } : {};
    const optionalBookingStatus =
      body.booking_status && body.booking_status.trim() !== ""
        ? { booking_status: body.booking_status }
        : {};
    const optionalInspectionStatus =
      body.inspection_status && body.inspection_status.trim() !== ""
        ? { inspection_status: body.inspection_status }
        : {};
    const optionalCargoType =
      body.cargo_type && body.cargo_type.trim() !== "" ? { cargo_type: body.cargo_type } : {};

    const { data: shipmentData, error: shipmentError } = await supabase
      .from("shipments")
      .insert({
        do_number: body.do_number,
        tracking_number: body.tracking_number ?? null,
        shipment_type: body.shipment_type ?? null,
        origin: body.origin,
        destination: body.destination,
        etd: body.etd ?? null,
        eta: body.eta ?? null,
        documentary_cutoff: body.documentary_cutoff ?? null,
        incoterm: body.incoterm ?? null,
        ...optionalStatus,
        ...optionalBookingStatus,
        ...optionalInspectionStatus,
        ...optionalCargoType,
        free_days: normalizedFreeDays,
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

    // 7) Crear la relacion usuario-carga en profile_shipment.
    // Esta relacion es necesaria para que las politicas RLS del cliente
    // le permitan ver y filtrar sus propias cargas.
    // Se usa upsert para evitar duplicados si la relacion ya existiera por algun motivo.
    const { error: relationError } = await supabase
      .from("profile_shipment")
      .upsert(
        { client_id: ownerId, shipment_id: shipmentData.id },
        { onConflict: "client_id,shipment_id" },
      );

    if (relationError) {
      // Si falla la relacion, se elimina la carga para no dejar un registro
      // huerfano que el cliente no podria ver ni que el sistema asociaria a nadie.
      await supabase.from("shipments").delete().eq("id", shipmentData.id);
      return new Response(relationError.message, {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 8) Registrar la primera novedad de tracking del ciclo de vida de la carga.
    // Garantiza que siempre haya al menos un evento inicial en el historial.
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

    // Devuelve el merge del shipment y su primera novedad para que el cliente
    // tenga todo el estado inicial en una sola respuesta.
    return new Response(JSON.stringify({ ...shipmentData, ...shipmentUpdateData }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 201,
    });
  } catch (error) {
    // Captura errores no controlados para evitar exponer stack traces al cliente.
    return new Response(
      error instanceof Error ? error.message : "Ocurrio un error inesperado",
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});
