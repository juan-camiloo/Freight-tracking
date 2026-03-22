// Edge Function: update-tickets
// Objective:
// - Validate user via JWT Bearer.
// - Allow access only to internal profiles.
// - Update ticket status and resolved_at.

import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    const authHeader =
      req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Falta el encabezado de autorizacion", error_key: "updateTicket.authHeaderMissing" },
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
          error_key: "updateTicket.invalidSession",
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
          error_key: "updateTicket.notInternal",
          details: profileError?.message,
        },
        403,
      );
    }

    let payload: { ticket_id?: string; status?: string } = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const ticketId = typeof payload.ticket_id === "string" ? payload.ticket_id.trim() : "";
    const status = typeof payload.status === "string" ? payload.status.trim() : "";

    if (!ticketId || !status) {
      return jsonResponse(
        {
          error: "Datos incompletos",
          error_key: "updateTicket.invalidPayload",
        },
        400,
      );
    }

    const validStatuses = new Set(["opened", "in_revision", "resolved"]);
    if (!validStatuses.has(status)) {
      return jsonResponse(
        {
          error: "Estado invalido",
          error_key: "updateTicket.invalidStatus",
        },
        400,
      );
    }

    const updatePayload: Record<string, unknown> = {
      ticket_status: status,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
    };

    const { data: ticket, error: updateError } = await supabaseAdmin
      .from("tickets")
      .update(updatePayload)
      .eq("id", ticketId)
      .select("*")
      .single();

    if (updateError) {
      return jsonResponse(
        {
          error: "No se pudo actualizar el ticket",
          error_key: "updateTicket.updateError",
          details: updateError.message,
        },
        400,
      );
    }

    const responseTicket = { ...ticket };

    if (ticket?.user_id) {
      const { data: profileData } = await supabaseAdmin
        .from("profiles")
        .select("email,nickname")
        .eq("id", ticket.user_id)
        .maybeSingle();

      if (profileData) {
        responseTicket.user_email = profileData.email ?? null;
        responseTicket.user_nickname = profileData.nickname ?? null;

        const emailClient = profileData.email;

        if (status === "resolved" && profileData.email){
          const resend = new Resend (Deno.env.get("RESEND_API_KEY")!);
          await Promise.all([
            resend.emails.send({
              from: "soporte@ingelox.com.co",
              to: emailClient,
              subject: "Su caso ha sido resuelto",
              html: `
              <!doctype html>
              <html lang="es">
                <body style="margin:0;padding:0;background:#FFF6EC;font-family:Arial,Helvetica,sans-serif;color:#1B2A3A;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF6EC;padding:24px 12px;">
                    <tr>
                      <td align="center">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #D7E3EE;border-radius:12px;overflow:hidden;">
                          <tr>
                            <td style="background:#F28A07;padding:20px 24px;text-align:center;">
                              <h1 style="margin:0;font-size:22px;line-height:1.2;color:#1B2A3A;">Freight Tracking</h1>
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:28px 24px 8px 24px;">
                              <p style="margin:0 0 12px 0;font-size:16px;line-height:1.5;color:#1B2A3A;font-weight:bold;">
                                Hola,
                              </p>
                              <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:#1B2A3A;">
                                Te informamos que tu consulta ha sido marcada como <strong>Resuelta</strong> por nuestro equipo de soporte.
                              </p>
                              
                              <div style="background:#f9f9f9; padding:16px; border-radius:8px; margin-bottom:20px; border-left:4px solid #F28A07;">
                                <p style="margin:0; font-size:14px; color:#1B2A3A;">
                                  <strong>Detalle:</strong> "${ticket.message}"
                                </p>
                                ${ticket.do_number ? `<p style="margin:8px 0 0 0; font-size:14px; color:#1B2A3A;"><strong>DO:</strong> ${ticket.do_number}</p>` : ""}
                                <p style="margin:8px 0 0 0; font-size:13px; color:#6B7C8F;">Ticket ID: #${ticket.id.slice(0, 8).toUpperCase()}</p>
                              </div>
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:16px 24px 24px 24px;border-top:1px solid #D7E3EE;">
                              <p style="margin:0;font-size:12px;line-height:1.6;color:#6B7C8F;">
                                Si consideras que necesitas más ayuda o el problema persiste, puedes responder a este correo o abrir un nuevo ticket desde la aplicación. Estamos para ayudarte.
                              </p>
                            </td>
                          </tr>
                        </table>
                        <p style="margin-top:20px; font-size:12px; color:#6B7C8F;">© 2026 Freight Tracking</p>
                      </td>
                    </tr>
                  </table>
                </body>
              </html>
              `,
            })
          ])
        }
      }
    }

    return jsonResponse({ ticket: responseTicket }, 200);
  } catch (error) {
    return jsonResponse(
      {
        error: "Error interno del servidor",
        error_key: "updateTicket.internalError",
        details: error instanceof Error ? error.message : "Unexpected error",
      },
      500,
    );
  }
});
