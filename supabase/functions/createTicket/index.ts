// Edge Function: createTicket
// Objetivo:
// - Añade ticket a la tabla tickets con estado "abierto" y el numero de DO extraido del mensaje del cliente.
// - Se envía correo a soporte con los detalles del ticket y al cliente confirmando la creación de este.
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Resend } from "npm:resend";

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
const CATEGORY_EMAILS: Record <string, string> = {
  "administrative": "admin@ingelox.com.co",
  "facturation": "admin@ingelox.com.co",
  "comercial": "daniel@ingelox.com.co",
  "pricing": "daniel@ingelox.com.co",
  "maritime": "ocean@ingelox.com.co",
  "air": "air@ingelox.com.co",
  "other": "practicante@ingelox.com.co"
}
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
        { error: "Falta el encabezado de autorizacion", error_key: "createTicket.authHeaderMissing" },
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
    const supabase= createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);
   
    if (authError || !user) {
      return jsonResponse(
        { error: "Token o sesion invalida", error_key: "createTicket.invalidSession" },
        401,
      );
    }
    const {message, do_number, category} = await req.json();
    const supportEmail= CATEGORY_EMAILS [category] || CATEGORY_EMAILS ["other"]  
    if (!message) {
      return jsonResponse(
        { error: "Mensaje requerido", error_key: "createTicket.messageRequired" },
        400,
      );
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        message: message,
        do_number: do_number || null,
        user_id: user.id,
        category: category || null
      })
      .select()
      
    
    
    if (ticketError|| !ticket || ticket.length === 0) {
      return jsonResponse(
        { error: "Error creando ticket", error_key: "createTicket.createError" },
        500,
      ); 
    }
    const newTicket = ticket[0];
    const ticketId = newTicket.id;
    const emailClient = user.email;
    if (!emailClient){
      return jsonResponse(
        { error: "Usuario sin email", error_key: "createTicket.userNoEmail" },
        400,
      );
    }
    const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
    await Promise.all([
      //Email al cliente
      resend.emails.send({
        from: "soporte@ingelox.com.co",
        to: emailClient,
        subject: "Confirmación de creación de ticket",
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
                        <p style="margin:0 0 12px 0;font-size:16px;line-height:1.5;color:#1B2A3A;">
                          Hola,
                        </p>
                        <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:#1B2A3A;">
                          Hemos recibido tu solicitud correctamente. Nuestro equipo de soporte ya tiene asignado tu caso y lo revisará lo más pronto posible.
                        </p>
                        
                        <div style="background:#FFFBF5; padding:16px; border-radius:8px; border:1px solid #FADCB3; margin-bottom:20px;">
                          <p style="margin:0 0 8px 0; font-size:14px; color:#1B2A3A;">
                            <strong>🚢 Referencia (DO):</strong> ${do_number ? do_number : "No especificado"}
                          </p>
                          <hr style="border:0; border-top:1px solid #D7E3EE; margin:12px 0;">
                          <p style="margin:0; font-size:14px; line-height:1.6; color:#1B2A3A; font-style: italic;">
                            " ${message} "
                          </p>
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:16px 24px 24px 24px;border-top:1px solid #D7E3EE; background:#F9FAFB;">
                        <p style="margin:0;font-size:13px;line-height:1.6;color:#1B2A3A; font-weight: bold;">
                          ¿Qué sigue ahora?
                        </p>
                        <p style="margin:4px 0 0 0;font-size:12px;line-height:1.6;color:#6B7C8F;">
                          Un asesor analizará la información y se pondrá en contacto contigo a través de este correo. No es necesario que abras un nuevo ticket para el mismo asunto.
                        </p>
                      </td>
                    </tr>
                  </table>
                  <p style="margin-top:20px; font-size:12px; color:#6B7C8F; text-align: center;">
                    © 2026 Freight Tracking | Soporte Técnico
                  </p>
                </td>
              </tr>
            </table>
          </body>
        </html>
        `
      }),
      //Email a soporte
      resend.emails.send({
      from: "system@ingelox.com.co",
      to: supportEmail,
      subject: `🚨 [${category.toUpperCase()}]Nuevo Ticket: ${emailClient} - DO: ${do_number || 'N/A'}`,
      html: `
      <!doctype html>
      <html lang="es">
        <body style="margin:0;padding:0;background:#FFF6EC;font-family:Arial,Helvetica,sans-serif;color:#1B2A3A;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF6EC;padding:24px 12px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #D7E3EE;border-radius:12px;overflow:hidden;">
                  <tr>
                    <td style="background:#1E5F99;padding:20px 24px;text-align:center;">
                      <h1 style="margin:0;font-size:20px;line-height:1.2;color:#ffffff;">Freight Tracking</h1>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:28px 24px 8px 24px;">
                      <p style="margin:0 0 12px 0;font-size:16px;line-height:1.5;color:#1B2A3A;font-weight:bold;">
                        Hola equipo,
                      </p>
                      <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:#1B2A3A;">
                        Se ha registrado un nuevo ticket que requiere atención inmediata:
                      </p>
                      
                      <div style="background:#f4f7f9; padding:16px; border-radius:8px; border:1px solid #D7E3EE;">
                        <p style="margin:0 0 8px 0; font-size:14px; color:#1B2A3A;">
                          <strong>📧 Cliente:</strong> ${emailClient}
                        </p>
                        <p style="margin:0 0 8px 0; font-size:14px; color:#1B2A3A;">
                          <strong>🚢 Operación (DO):</strong> ${do_number ? do_number : "No informado"}
                        </p>
                        <hr style="border:0; border-top:1px solid #D7E3EE; margin:12px 0;">
                        <p style="margin:0; font-size:14px; line-height:1.6; color:#1B2A3A;">
                          <strong>💬 Mensaje del usuario:</strong><br>
                          "${message}"
                        </p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px 24px 24px 24px; border-top:1px solid #D7E3EE; background:#fcfcfc;">
                      <p style="margin:0; font-size:12px; line-height:1.6; color:#6B7C8F; text-align:center;">
                        Este es un mensaje automático generado por el sistema de Freight Tracking.
                      </p>
                    </td>
                  </tr>
                </table>
                <p style="margin-top:20px; font-size:12px; color:#6B7C8F;">© 2026 Freight Tracking | Ingelox</p>
              </td>
            </tr>
          </table>
        </body>
      </html>
      `

      })
    ]);
    return new Response(JSON.stringify({ ticket }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }catch (error) {
    console.error("Error en createTicket:", error);
    return jsonResponse(
      { error: "Error interno del servidor", error_key: "createTicket.internalError" },
      500,
    );
  }
});
