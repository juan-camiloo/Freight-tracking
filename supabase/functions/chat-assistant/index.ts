/*import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatRequest = {
  conversation_id?: string;
  message?: string;
};

type TriageResult = {
  can_answer: boolean;
  answer: string;
  area: string;
  confidence: number;
  handoff_reason: string;
};

const MODEL = Deno.env.get("OPENAI_ASSISTANT_MODEL") ?? "gpt-5-mini";
const CONFIDENCE_THRESHOLD = Number(Deno.env.get("AI_HANDOFF_THRESHOLD") ?? "0.72");

function normalizeArea(input: string) {
  const value = input.trim().toLowerCase();
  if (["operaciones", "operacion", "logistica", "tracking"].includes(value)) return "operaciones";
  if (["documentacion", "documentos", "aduana"].includes(value)) return "documentacion";
  if (["facturacion", "factura", "pagos", "cobro"].includes(value)) return "facturacion";
  if (["soporte_tecnico", "soporte", "tecnico"].includes(value)) return "soporte_tecnico";
  return "operaciones";
}

function parseTriageResult(payload: unknown): TriageResult | null {
  if (!payload || typeof payload !== "object") return null;
  const asRecord = payload as Record<string, unknown>;
  if (
    typeof asRecord.can_answer !== "boolean" ||
    typeof asRecord.answer !== "string" ||
    typeof asRecord.area !== "string" ||
    typeof asRecord.confidence !== "number" ||
    typeof asRecord.handoff_reason !== "string"
  ) {
    return null;
  }

  return {
    can_answer: asRecord.can_answer,
    answer: asRecord.answer.trim(),
    area: normalizeArea(asRecord.area),
    confidence: Math.max(0, Math.min(1, asRecord.confidence)),
    handoff_reason: asRecord.handoff_reason.trim(),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Falta el encabezado de autorizacion" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiApiKey) {
      return new Response(JSON.stringify({ error: "Falta OPENAI_API_KEY en secretos" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token o sesion invalida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json()) as ChatRequest;
    const message = body.message?.trim() ?? "";

    if (!message) {
      return new Response(JSON.stringify({ error: "El mensaje es obligatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let conversationId = body.conversation_id?.trim() || "";

    if (conversationId) {
      const { data: existingConversation, error: conversationError } = await supabase
        .from("ai_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (conversationError) {
        return new Response(JSON.stringify({ error: conversationError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!existingConversation) {
        return new Response(JSON.stringify({ error: "Conversacion no encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { data: createdConversation, error: createConversationError } = await supabase
        .from("ai_conversations")
        .insert({ user_id: user.id })
        .select("id")
        .single();

      if (createConversationError || !createdConversation) {
        return new Response(JSON.stringify({ error: createConversationError?.message ?? "No se pudo crear conversacion" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      conversationId = createdConversation.id;
    }

    const { error: userMessageError } = await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: "user",
      content: message,
    });

    if (userMessageError) {
      return new Response(JSON.stringify({ error: userMessageError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: areaRows } = await supabase.from("support_areas").select("name");
    const areaNames = (areaRows ?? []).map((row) => row.name);

    const systemPrompt = `Eres un asistente de soporte para una app de seguimiento de carga.
Devuelve SIEMPRE JSON valido con estos campos:
- can_answer: boolean
- answer: string corto en espanol
- area: una de ${areaNames.join(", ")}
- confidence: numero entre 0 y 1
- handoff_reason: string corto

Reglas:
- Si no estas seguro o faltan datos concretos del caso, can_answer=false.
- Nunca inventes estados de carga ni datos de facturacion.
- Si can_answer=true, da una respuesta util y accionable.`;

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_output_tokens: 400,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: message }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "triage_output",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                can_answer: { type: "boolean" },
                answer: { type: "string" },
                area: { type: "string" },
                confidence: { type: "number" },
                handoff_reason: { type: "string" },
              },
              required: ["can_answer", "answer", "area", "confidence", "handoff_reason"],
            },
          },
        },
      }),
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      return new Response(JSON.stringify({ error: `OpenAI error: ${errorText}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openAiData = await openAiResponse.json();
    const outputText = openAiData.output_text as string | undefined;
    const usage = openAiData.usage as { input_tokens?: number; output_tokens?: number } | undefined;

    let triage = parseTriageResult(outputText ? JSON.parse(outputText) : null);
    if (!triage) {
      triage = {
        can_answer: false,
        answer: "",
        area: "operaciones",
        confidence: 0,
        handoff_reason: "No fue posible clasificar con confianza.",
      };
    }

    const canAutoAnswer = triage.can_answer && triage.confidence >= CONFIDENCE_THRESHOLD && triage.answer.length > 0;

    if (canAutoAnswer) {
      await supabase.from("ai_messages").insert({
        conversation_id: conversationId,
        user_id: null,
        role: "assistant",
        content: triage.answer,
        model: MODEL,
        tokens_in: usage?.input_tokens ?? 0,
        tokens_out: usage?.output_tokens ?? 0,
        metadata: {
          mode: "ai_answer",
          confidence: triage.confidence,
          area: triage.area,
        },
      });

      await supabase
        .from("ai_conversations")
        .update({ status: "open" })
        .eq("id", conversationId);

      return new Response(
        JSON.stringify({
          conversation_id: conversationId,
          mode: "ai_answer",
          answer: triage.answer,
          confidence: triage.confidence,
          area: triage.area,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    const resolvedArea = normalizeArea(triage.area);
    const { data: areaRow } = await supabase
      .from("support_areas")
      .select("id, name")
      .eq("name", resolvedArea)
      .maybeSingle();

    const { data: existingTickets, error: ticketLookupError } = await supabase
      .from("support_tickets")
      .select("id, status, assigned_to")
      .eq("conversation_id", conversationId)
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (ticketLookupError) {
      return new Response(JSON.stringify({ error: ticketLookupError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let ticketId = existingTickets?.[0]?.id as string | undefined;
    let assignedTo = existingTickets?.[0]?.assigned_to as string | undefined;

    if (!ticketId) {
      const { data: candidateAgents } = await supabase
        .from("support_agents")
        .select("profile_id")
        .eq("active", true)
        .eq("area_id", areaRow?.id ?? "")
        .limit(1);

      assignedTo = candidateAgents?.[0]?.profile_id;

      const { data: insertedTicket, error: insertTicketError } = await supabase
        .from("support_tickets")
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          area_id: areaRow?.id ?? null,
          assigned_to: assignedTo ?? null,
          status: assignedTo ? "in_progress" : "open",
          priority: "normal",
          handoff_reason: triage.handoff_reason || "Consulta derivada por baja confianza.",
          ai_confidence: triage.confidence,
        })
        .select("id")
        .single();

      if (insertTicketError || !insertedTicket) {
        return new Response(JSON.stringify({ error: insertTicketError?.message ?? "No se pudo crear ticket" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      ticketId = insertedTicket.id;
    }

    const handoffText = assignedTo
      ? `No tengo suficiente confianza para responder con precision. Ya derive tu caso al equipo de ${resolvedArea}.`
      : `No tengo suficiente confianza para responder con precision. Cree un ticket para el equipo de ${resolvedArea}.`;

    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      user_id: null,
      role: "assistant",
      content: handoffText,
      model: MODEL,
      tokens_in: usage?.input_tokens ?? 0,
      tokens_out: usage?.output_tokens ?? 0,
      metadata: {
        mode: "handoff",
        confidence: triage.confidence,
        area: resolvedArea,
        ticket_id: ticketId,
      },
    });

    await supabase
      .from("ai_conversations")
      .update({ status: "handed_off" })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({
        conversation_id: conversationId,
        mode: "handoff",
        ticket_id: ticketId,
        area: resolvedArea,
        confidence: triage.confidence,
        answer: handoffText,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error en chat-assistant:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Ocurrio un error inesperado",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});*/
