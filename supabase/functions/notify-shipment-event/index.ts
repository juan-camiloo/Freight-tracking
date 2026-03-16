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
  // Destinatario unico (retrocompatibilidad con integraciones anteriores).
  target_user_id?: string | null;
  // Lista de destinatarios cuando el evento afecta a multiples usuarios.
  target_user_ids?: string[] | null;
  do_number?: string | null;
  status?: string | null;
};

type PushEndpoint = {
  token: string;
  platform: Platform;
};

// Fila de la tabla de relaciones que vincula un perfil con una carga.
type ProfileShipmentRelation = {
  client_id: string | null;
};

// Subconjunto del JSON de service account de Firebase necesario
// para firmar el JWT y obtener el access_token de Google OAuth.
type ServiceAccount = {
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri?: string;
};

async function readJsonSafe(response: Response): Promise<any> {
  // Evita excepciones si el body de la respuesta no es JSON valido.
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
  // Convierte bytes a base64url (reemplaza +, /, = para cumplir RFC 4648).
  // Necesario para construir el JWT que firma Google OAuth.
  const binary = String.fromCharCode(...input);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeText(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Convierte la private key PEM del service account a CryptoKey utilizable por Web Crypto.
  // Elimina cabecera, pie y espacios del PEM antes de decodificar el DER binario.
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
  // Este flujo es necesario porque FCM HTTP v1 ya no acepta la Server Key legacy.
  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = { alg: "RS256", typ: "JWT" };
  const jwtClaims = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token",
    iat: now,
    // Token valido por 1 hora; suficiente para el ciclo de vida de la funcion.
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
  // Si no hay numero de DO disponible, usa un texto generico para no exponer datos vacios.
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
  // Caso "deleted".
  return {
    title: "Carga eliminada",
    body: `La carga ${doLabel} fue eliminada.`,
  };
}

async function sendExpoPush(tokens: string[], title: string, body: string, link: string) {
  // Envia notificaciones a dispositivos nativos registrados con Expo token.
  // La API de Expo acepta un batch de mensajes en un solo POST.
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

  // Filtra los tokens invalidos devueltos por Expo para desactivarlos en DB
  // y evitar reintentos sobre dispositivos que ya no tienen la app instalada.
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
  // Cada token se envia en una request independiente porque FCM v1 no admite batch nativo.
  if (tokens.length === 0) return [];

  // El access token se obtiene una sola vez y se reutiliza para todas las requests del lote.
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
        // FCM devuelve 400/404 para tokens expirados o de dispositivos no registrados.
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
  // Marca tokens invalidos como inactivos para no intentar enviarles futuras notificaciones.
  // Se registra last_seen_at para auditar cuándo fue detectada la invalidez del token.
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
    // Error no critico: el envio ya ocurrio; solo se pierde la limpieza del token.
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

    // Se usa anon key para validar el JWT del usuario sin privilegios elevados.
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

    // Service role para consultas que requieren acceso sin restricciones de RLS.
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3) Carga opcional de datos del shipment para enriquecer el mensaje.
    // En eventos "deleted" la fila puede ya no existir, por eso el error no es fatal.
    const { data: shipmentRow, error: shipmentError } = await supabase
      .from("shipments")
      .select("id, do_number, current_status")
      .eq("id", body.shipment_id)
      .maybeSingle();

    if (shipmentError && body.event_type !== "deleted") {
      return json(400, { error: shipmentError.message });
    }

    // 4) Resolucion de destinatarios con prioridad:
    //    target_user_ids (lista explicita) > target_user_id (unico) > relaciones en DB.
    const explicitTargetUserIds = (body.target_user_ids ?? []).filter((value): value is string =>
      typeof value === "string" && value.length > 0
    );

    let targetUserIds = Array.from(new Set(explicitTargetUserIds));

    if (targetUserIds.length === 0 && body.target_user_id) {
      targetUserIds = [body.target_user_id];
    }

    // Si no se especificaron destinatarios explicitamente, se resuelven por
    // la tabla de relaciones perfil-carga (todos los asignados a ese shipment).
    if (targetUserIds.length === 0) {
      const { data: relationRows, error: relationsError } = await supabase
        .from("profile_shipment")
        .select("client_id")
        .eq("shipment_id", body.shipment_id);

      if (relationsError && body.event_type !== "deleted") {
        return json(400, { error: relationsError.message });
      }

      const relations = (relationRows ?? []) as ProfileShipmentRelation[];
      targetUserIds = Array.from(
        new Set(
          relations
            .map((row) => row.client_id)
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        ),
      );
    }

    if (targetUserIds.length === 0) {
      return json(200, { sent: 0, reason: "No hay destinatario para notificar" });
    }

    // 5) Obtencion de endpoints push activos filtrando tokens inactivos o expirados.
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

    // 6) Construccion del texto y deep-link segun tipo de evento.
    // El payload del body tiene prioridad sobre los datos del shipment en DB.
    const doNumber = body.do_number ?? shipmentRow?.do_number ?? null;
    const status = body.status ?? shipmentRow?.current_status ?? null;
    const message = buildMessage(body.event_type, doNumber, status);

    // En eventos "deleted" no hay pantalla de detalle a donde navegar.
    const appWebUrl = (Deno.env.get("APP_WEB_URL") ?? "").replace(/\/+$/, "");
    const path = body.event_type === "deleted" ? "/" : `/shipment/${body.shipment_id}`;
    const link = appWebUrl ? `${appWebUrl}${path}` : path;

    // Separar tokens por plataforma para usar el canal de envio correcto.
    const expoTokens = rows.filter((row) => row.platform === "expo").map((row) => row.token);
    const webTokens = rows.filter((row) => row.platform === "web_fcm").map((row) => row.token);

    // Enviar a dispositivos nativos y limpiar tokens invalidos detectados.
    const invalidExpoTokens = await sendExpoPush(expoTokens, message.title, message.body, link);
    await deactivateInvalidTokens(supabase, "expo", invalidExpoTokens);

    // El service account es opcional: si no esta configurado, se omite el envio web
    // sin interrumpir el flujo (la app puede operar solo con Expo por ejemplo).
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
    // Captura errores no controlados para evitar exponer stack traces al cliente.
    return json(500, {
      error: error instanceof Error ? error.message : "Ocurrio un error inesperado",
    });
  }
});
