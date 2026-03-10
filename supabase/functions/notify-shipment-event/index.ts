// Edge Function: notify-shipment-event
// Objetivo:
// 1) Validar al usuario que dispara el evento.
// 2) Resolver destinatarios (explicitos o por relacion profile_shipment).
// 3) Enviar push en Expo y/o FCM web segun plataforma registrada.
// 4) Devolver resultado sin romper el flujo de la app cliente.
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
export const config = { auth: true };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EventType = "assigned" | "updated" | "deleted";
type Platform = "expo" | "web_fcm";

type NotifyBody = {
  event_type: EventType;
  shipment_id: string;
  target_user_id?: string | null;
  target_user_ids?: string[] | null;
  do_number?: string | null;
  status?: string | null;
};

type PushEndpoint = {
  token: string;
  platform: Platform;
};

type ProfileShipmentRelation = {
  profile_id: string | null;
};

type ServiceAccount = {
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri?: string;
};

async function readJsonSafe(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function json(status: number, payload: Record<string, unknown>) {
  // Helper para respuestas JSON consistentes con CORS.
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toBase64Url(input: Uint8Array): string {
  const binary = String.fromCharCode(...input);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeText(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Convierte la private key PEM del service account a CryptoKey utilizable por Web Crypto.
  const sanitized = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");

  const binaryDer = Uint8Array.from(atob(sanitized), (ch) => ch.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function getGoogleAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  // Construye y firma un JWT para intercambiarlo por un access_token OAuth de Google.
  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = { alg: "RS256", typ: "JWT" };
  const jwtClaims = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = toBase64Url(encodeText(JSON.stringify(jwtHeader)));
  const encodedClaims = toBase64Url(encodeText(JSON.stringify(jwtClaims)));
  const unsignedToken = `${encodedHeader}.${encodedClaims}`;
  const key = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encodeText(unsignedToken) as BufferSource,
  );
  const encodedSignature = toBase64Url(new Uint8Array(signature));
  const assertion = `${unsignedToken}.${encodedSignature}`;

  const tokenResponse = await fetch(serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`No se pudo obtener access token de Google: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData?.access_token as string | undefined;
  if (!accessToken) {
    throw new Error("Respuesta invalida de Google OAuth (sin access_token).");
  }

  return accessToken;
}

function buildMessage(eventType: EventType, doNumber?: string | null, status?: string | null) {
  // Normaliza el texto de notificacion segun tipo de evento.
  const doLabel = doNumber?.trim() ? doNumber : "tu carga";
  if (eventType === "assigned") {
    return {
      title: "Nueva carga asignada",
      body: `Se te asigno la carga ${doLabel}.`,
    };
  }
  if (eventType === "updated") {
    return {
      title: "Carga actualizada",
      body: status?.trim()
        ? `La carga ${doLabel} fue actualizada. Estado: ${status}.`
        : `La carga ${doLabel} fue actualizada.`,
    };
  }
  return {
    title: "Carga eliminada",
    body: `La carga ${doLabel} fue eliminada.`,
  };
}

async function sendExpoPush(tokens: string[], title: string, body: string, link: string) {
  // Envia notificaciones a dispositivos nativos registrados con Expo token.
  if (tokens.length === 0) return [];
  const messages = tokens.map((token) => ({
    to: token,
    title,
    body,
    data: { link },
  }));

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Expo Push respondio ${response.status}: ${errorText}`);
  }

  const payload = await readJsonSafe(response);
  const tickets = Array.isArray(payload?.data) ? payload.data : [];

  const invalidExpoTokens = tickets
    .map((ticket: any, index: number) => ({ ticket, token: tokens[index] }))
    .filter(({ ticket }) =>
      ticket?.status === "error" &&
      (ticket?.details?.error === "DeviceNotRegistered" ||
        ticket?.details?.error === "InvalidCredentials"),
    )
    .map(({ token }) => token)
    .filter((token): token is string => typeof token === "string" && token.length > 0);

  return invalidExpoTokens;
}

async function sendWebPush(
  tokens: string[],
  title: string,
  body: string,
  link: string,
  serviceAccount: ServiceAccount,
) {
  // Envia notificaciones web via FCM HTTP v1 usando OAuth de service account.
  if (tokens.length === 0) return [];
  const accessToken = await getGoogleAccessToken(serviceAccount);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

  const invalidWebTokens: string[] = [];
  await Promise.all(
    tokens.map(async (token) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data: { link },
            webpush: {
              notification: {
                title,
                body,
                data: { link },
              },
              fcm_options: { link },
            },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const looksInvalidToken =
          response.status === 400 ||
          response.status === 404 ||
          /UNREGISTERED|registration token/i.test(errorText);
        if (looksInvalidToken) {
          invalidWebTokens.push(token);
        }
      }
    }),
  );

  return invalidWebTokens;
}

async function deactivateInvalidTokens(
  supabase: ReturnType<typeof createClient>,
  platform: Platform,
  tokens: string[],
) {
  if (tokens.length === 0) return;

  const uniqueTokens = Array.from(new Set(tokens));
  const { error } = await supabase
    .from("notifications")
    .update({
      active: false,
      last_seen_at: new Date().toISOString(),
    })
    .eq("platform", platform)
    .in("token", uniqueTokens);

  if (error) {
    console.error(`No se pudieron desactivar tokens ${platform}:`, error.message);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1) Validacion de autenticacion del request.
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Falta el encabezado de autorizacion" });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return json(500, { error: "Faltan secretos de Supabase para la funcion." });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return json(401, { error: "Token o sesion invalida" });
    }

    // 2) Validacion de payload minimo.
    const body = (await req.json()) as NotifyBody;
    if (!body?.event_type || !body?.shipment_id) {
      return json(400, { error: "event_type y shipment_id son obligatorios" });
    }

    if (!["assigned", "updated", "deleted"].includes(body.event_type)) {
      return json(400, { error: "event_type invalido" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3) Carga opcional de datos de shipment (para enriquecer mensaje).
    const { data: shipmentRow, error: shipmentError } = await supabase
      .from("shipments")
      .select("id, do_number, current_status")
      .eq("id", body.shipment_id)
      .maybeSingle();

    // En delete la fila puede no existir si ya fue borrada.
    if (shipmentError && body.event_type !== "deleted") {
      return json(400, { error: shipmentError.message });
    }

    // 4) Resolucion de destinatarios: target_user_ids -> target_user_id -> relaciones DB.
    const explicitTargetUserIds = (body.target_user_ids ?? []).filter((value): value is string =>
      typeof value === "string" && value.length > 0
    );

    let targetUserIds = Array.from(new Set(explicitTargetUserIds));

    if (targetUserIds.length === 0 && body.target_user_id) {
      targetUserIds = [body.target_user_id];
    }

    if (targetUserIds.length === 0) {
      const { data: relationRows, error: relationsError } = await supabase
        .from("profile_shipment")
        .select("profile_id")
        .eq("shipment_id", body.shipment_id);

      if (relationsError && body.event_type !== "deleted") {
        return json(400, { error: relationsError.message });
      }

      const relations = (relationRows ?? []) as ProfileShipmentRelation[];
      targetUserIds = Array.from(
        new Set(
          relations
            .map((row) => row.profile_id)
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        ),
      );
    }

    if (targetUserIds.length === 0) {
      return json(200, { sent: 0, reason: "No hay destinatario para notificar" });
    }

    // 5) Obtencion de endpoints push activos por usuario.
    const { data: endpoints, error: endpointsError } = await supabase
      .from("notifications")
      .select("token, platform")
      .in("user_id", targetUserIds)
      .eq("active", true);

    if (endpointsError) {
      return json(400, { error: endpointsError.message });
    }

    const rows = (endpoints ?? []) as PushEndpoint[];
    if (rows.length === 0) {
      return json(200, { sent: 0, reason: "Usuario sin tokens activos" });
    }

    // 6) Construccion de mensaje/link y envio por plataforma.
    const doNumber = body.do_number ?? shipmentRow?.do_number ?? null;
    const status = body.status ?? shipmentRow?.current_status ?? null;
    const message = buildMessage(body.event_type, doNumber, status);

    const appWebUrl = (Deno.env.get("APP_WEB_URL") ?? "").replace(/\/+$/, "");
    const path = body.event_type === "deleted" ? "/" : `/shipment/${body.shipment_id}`;
    const link = appWebUrl ? `${appWebUrl}${path}` : path;

    const expoTokens = rows.filter((row) => row.platform === "expo").map((row) => row.token);
    const webTokens = rows.filter((row) => row.platform === "web_fcm").map((row) => row.token);

    const invalidExpoTokens = await sendExpoPush(expoTokens, message.title, message.body, link);
    await deactivateInvalidTokens(supabase, "expo", invalidExpoTokens);

    if (webTokens.length > 0) {
      const serviceJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
      if (serviceJson) {
        const serviceAccount = JSON.parse(serviceJson) as ServiceAccount;
        const invalidWebTokens = await sendWebPush(
          webTokens,
          message.title,
          message.body,
          link,
          serviceAccount,
        );
        await deactivateInvalidTokens(supabase, "web_fcm", invalidWebTokens);
      }
    }

    return json(200, { sent: rows.length });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Ocurrio un error inesperado",
    });
  }
});
