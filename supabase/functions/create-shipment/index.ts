// Archivo: C:\Users\usuario\freight-tracking\supabase\functions\create-shipment\index.ts
// Descripcion: Este archivo forma parte de la logica principal de la aplicacion.

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

  try{
    const authHeader =
      req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("Falta el encabezado de autorizacion", {
        status: 401,
        headers: corsHeaders,
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
      return new Response(JSON.stringify({ 
        error: "Token o sesion invalida",
        details: authError?.message
      }), { 
        status: 401, 
        headers: {...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const body: Shipment = await req.json();
    const { do_number, origin, destination, owner_email } = body;

    if (!do_number || !origin || !destination) {
      return new Response("DO, Origen y Destino son obligatorios", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    const { data: shipmentData, error: shipmentError } = await supabase
      .from("shipments")
      .insert({
        do_number: body.do_number ,
        shipment_type: body.shipment_type?? null,
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
  } catch(error) {
    return new Response(
      error instanceof Error ? error.message : "Ocurrio un error inesperado",
      {
        status: 500,
        headers: corsHeaders,
    });
  }
});
