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
  do_number?: string | null;
  status?: string | null;
};

type PushEndpoint = {
  token: string;
  platform: Platform;
};

type ServiceAccount = {
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri?: string;
};

function json(status: number, payload: Record<string, unknown>) {
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
  if (tokens.length === 0) return;
  const messages = tokens.map((token) => ({
    to: token,
    title,
    body,
    data: { link },
  }));

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(messages),
  });
}

async function sendWebPush(
  tokens: string[],
  title: string,
  body: string,
  link: string,
  serviceAccount: ServiceAccount,
) {
  if (tokens.length === 0) return;
  const accessToken = await getGoogleAccessToken(serviceAccount);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

  await Promise.all(
    tokens.map(async (token) => {
      await fetch(endpoint, {
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
    }),
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const body = (await req.json()) as NotifyBody;
    if (!body?.event_type || !body?.shipment_id) {
      return json(400, { error: "event_type y shipment_id son obligatorios" });
    }

    if (!["assigned", "updated", "deleted"].includes(body.event_type)) {
      return json(400, { error: "event_type invalido" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: shipmentRow, error: shipmentError } = await supabase
      .from("shipments")
      .select("id, do_number, client_id, current_status")
      .eq("id", body.shipment_id)
      .maybeSingle();

    // En delete la fila puede no existir si ya fue borrada.
    if (shipmentError && body.event_type !== "deleted") {
      return json(400, { error: shipmentError.message });
    }

    const targetUserId = body.target_user_id ?? shipmentRow?.client_id ?? null;
    if (!targetUserId) {
      return json(200, { sent: 0, reason: "No hay destinatario para notificar" });
    }

    const { data: endpoints, error: endpointsError } = await supabase
      .from("notifications")
      .select("token, platform")
      .eq("user_id", targetUserId)
      .eq("active", true);

    if (endpointsError) {
      return json(400, { error: endpointsError.message });
    }

    const rows = (endpoints ?? []) as PushEndpoint[];
    if (rows.length === 0) {
      return json(200, { sent: 0, reason: "Usuario sin tokens activos" });
    }

    const doNumber = body.do_number ?? shipmentRow?.do_number ?? null;
    const status = body.status ?? shipmentRow?.current_status ?? null;
    const message = buildMessage(body.event_type, doNumber, status);

    const appWebUrl = (Deno.env.get("APP_WEB_URL") ?? "").replace(/\/+$/, "");
    const path = body.event_type === "deleted" ? "/" : `/shipment/${body.shipment_id}`;
    const link = appWebUrl ? `${appWebUrl}${path}` : path;

    const expoTokens = rows.filter((row) => row.platform === "expo").map((row) => row.token);
    const webTokens = rows.filter((row) => row.platform === "web_fcm").map((row) => row.token);

    await sendExpoPush(expoTokens, message.title, message.body, link);

    if (webTokens.length > 0) {
      const serviceJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
      if (serviceJson) {
        const serviceAccount = JSON.parse(serviceJson) as ServiceAccount;
        await sendWebPush(webTokens, message.title, message.body, link, serviceAccount);
      }
    }

    return json(200, { sent: rows.length });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Ocurrio un error inesperado",
    });
  }
});
