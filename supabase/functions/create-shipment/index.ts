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
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeDateForDb(val: unknown): string | null {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function normalizeDateTimeForDb(val: unknown): string | null {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (/[Zz]|[+-]\d{2}(?::?\d{2})?$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const sec = match[6] ? match[6] : "00";
    return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${sec}-05:00`;
  }
  const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T00:00:00-05:00`;
  }
  return trimmed;
}

serve(async (req) => {
  console.log('Funcion ejecutada, method:', req.method);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  } 

  try {
    // 1) Verificar que el encabezado Authorization exista y tenga formato Bearer.
    const authHeader =
      req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Falta el encabezado de autorizacion", error_key: "createShipment.authHeaderMissing" },
        401,
      );
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
      return jsonResponse(
        {
          error: "Token o sesion invalida",
          error_key: "createShipment.invalidSession",
          details: authError?.message,
        },
        401,
      );
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
      return jsonResponse(
        {
          error: "No autorizado: solo usuarios internos pueden crear cargas",
          error_key: "createShipment.notAuthorized",
        },
        403,
      );
    }

    // 4) Validar que los campos minimos obligatorios esten presentes en el payload.
    let body : any;
    try {
      body = await req.json()
    } catch {
        return jsonResponse (
          {error: "JSON invalido", error_key: "createTicket.invalidJson"},
          400
      );
    }
    const { do_number, origin, destination, owner_email } = body;

    if (!do_number || !origin || !destination) {
      return jsonResponse(
        {
          error: "DO, Origen y Destino son obligatorios",
          error_key: "createShipment.doRequiredError",
        },
        400,
      );
    }

    // 5) Por defecto la carga se asigna al usuario que la crea.
    // Si se proporciona owner_email, se reasigna al cliente correspondiente,
    // lo que permite a operadores crear cargas en nombre de sus clientes.
    const userId = user.id;
    let ownerId = userId;

    if (owner_email) {
      const { data: ownerProfile, error: ownerError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", owner_email)
        .maybeSingle();

      if (ownerError || !ownerProfile) {
        return jsonResponse(
          {
            error: "No se encontro el correo del propietario",
            error_key: "createShipment.ownerEmailNotFound",
          },
          400,
        );
      }

      ownerId = ownerProfile.id;
    }

    // 6) Crear el registro principal de la carga.
    const normalizedFreeDays =
      body.free_days === null || body.free_days === undefined || body.free_days === ""
        ? null
        : Number(body.free_days);

    if (normalizedFreeDays !== null && Number.isNaN(normalizedFreeDays)) {
      return jsonResponse(
        {
          error: "Free days debe ser un numero",
          error_key: "createShipment.freeDaysError",
        },
        400,
      );
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
        shipment_type: body.shipment_type ?? null,
        origin: body.origin,
        destination: body.destination,
        etd: normalizeDateForDb(body.etd),
        eta: normalizeDateForDb(body.eta),
        atd: normalizeDateTimeForDb(body.atd),
        ata: normalizeDateTimeForDb(body.ata),
        documentary_cutoff: normalizeDateTimeForDb(body.documentary_cutoff),
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
        created_by: userId,
      })
      .select()
      .single();

    if (shipmentError) {
      return jsonResponse(
        {
          error: "No se pudo crear la carga",
          error_key: "createShipment.createError",
          details: shipmentError.message,
        },
        400,
      );
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
      return jsonResponse(
        {
          error: "No se pudo asociar la carga al usuario",
          error_key: "createShipment.relationError",
          details: relationError.message,
        },
        400,
      );
    }
    try {
      const doPrefix = (body.do_number as string)?.[0]?.toLowerCase();
      const operationType = doPrefix === 'x' ? 'EXPO' : 'IMPO';
      const folderResponse = await fetch('https://default470219e75ba1443584e0186963d8e1.20.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/aed6f86809f2474fbe02f08db48046b9/triggers/manual/paths/invoke?api-version=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          do_number: body.do_number,
          type: operationType,
        }),
      });
      console.log('Power Automate response status:', folderResponse.status);
    } catch (paError) {
      console.warn('Power Automate trigger failed (non-blocking):', paError);
    }
    // 8) Registrar novedad de tracking solo si se incluyó una observación con texto.
    let shipmentUpdateData = null;
    const hasObservation = typeof body.observation === "string" && body.observation.trim().length > 0;
    if (hasObservation) {
      const { data: updateData, error: shipmentUpdateError } = await supabase
        .from("shipment_updates")
        .insert({
          shipment_id: shipmentData?.id,
          status: body.current_status ?? null,
          location: body.current_location ?? null,
          observation: body.observation.trim(),
          updated_by: userId,
        })
        .select()
        .single();

      if (shipmentUpdateError) {
        return jsonResponse(
          {
            error: "No se pudo registrar la primera novedad",
            error_key: "createShipment.updateError",
            details: shipmentUpdateError.message,
          },
          400,
        );
      }
      shipmentUpdateData = updateData;
    }

    // Devuelve la información de la carga (y la novedad si se creó)
    return jsonResponse({ ...shipmentData, ...(shipmentUpdateData ?? {}) }, 201);
  } catch (error) {
    // Captura errores no controlados para evitar exponer stack traces al cliente.
    return jsonResponse(
      {
        error: "Error interno del servidor",
        error_key: "createShipment.internalError",
        details: error instanceof Error ? error.message : "Ocurrio un error inesperado",
      },
      500,
    );
  }
});
