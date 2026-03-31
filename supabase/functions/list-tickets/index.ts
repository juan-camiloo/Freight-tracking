// Edge Function: list-tickets
// Objective:
// - Validate user via JWT Bearer.
// - Allow access only to internal profiles.
// - Return tickets with user email for support inbox.

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader =
      req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Falta el encabezado de autorizacion", error_key: "listTickets.authHeaderMissing" },
        401,
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse(
        {
          error: "Token o sesion invalida",
          error_key: "listTickets.invalidSession",
          details: authError?.message,
        },
        401,
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_internal")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.is_internal) {
      return jsonResponse(
        {
          error: "El perfil no es interno",
          error_key: "listTickets.notInternal",
          details: profileError?.message,
        },
        403,
      );
    }

    const payload = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const ticketId =
      typeof payload?.ticket_id === "string" ? payload.ticket_id.trim() : "";
    const searchQuery =
      typeof payload?.query === "string" ? payload.query.trim() : "";

    let ticketsQuery = supabaseAdmin
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (ticketId) {
      ticketsQuery = ticketsQuery.eq("id", ticketId);
    }

    const { data: tickets, error: ticketsError } = await ticketsQuery;

    if (ticketsError) {
      return jsonResponse(
        {
          error: "No se pudieron cargar los tickets",
          error_key: "listTickets.loadError",
          details: ticketsError.message,
        },
        400,
      );
    }

    const rows = tickets ?? [];
    const userIds = Array.from(
      new Set(rows.map((ticket) => ticket.user_id).filter(Boolean)),
    );

    let profileMap = new Map<string, { email: string | null; nickname: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("id,email,nickname")
        .in("id", userIds);

      if (profilesError) {
        return jsonResponse(
          {
            error: "No se pudieron cargar los tickets",
            error_key: "listTickets.loadError",
            details: profilesError.message,
          },
          400,
        );
      }

      profileMap = new Map(
        (profiles ?? []).map((item) => [
          item.id,
          {
            email: item.email ?? null,
            nickname: item.nickname ?? null,
          },
        ]),
      );
    }

    const enriched = rows.map((ticket) => {
      const profile = ticket.user_id ? profileMap.get(ticket.user_id) : undefined;
      return {
        ...ticket,
        user_email: profile?.email ?? null,
        user_nickname: profile?.nickname ?? null,
      };
    });

    if (!searchQuery) {
      return jsonResponse(enriched, 200);
    }

    const clean = searchQuery.toLowerCase();
    const filtered = enriched.filter((ticket) => {
      const doNumber = (ticket.do_number ?? "").toLowerCase();
      const email = (ticket.user_email ?? "").toLowerCase();
      return doNumber.includes(clean) || email.includes(clean);
    });

    return jsonResponse(filtered, 200);
  } catch (error) {
    return jsonResponse(
      {
        error: "Error interno del servidor",
        error_key: "listTickets.internalError",
        details: error instanceof Error ? error.message : "Unexpected error",
      },
      500,
    );
  }
});
