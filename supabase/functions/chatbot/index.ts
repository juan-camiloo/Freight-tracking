import { serve } from "https://deno.land/std/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js"
import OpenAI from "https://esm.sh/openai"
import intentsData from "./intents.json" with { type: "json" }

// Lista de intents disponibles para clasificar preguntas.
const intents = intentsData.intents

// Cliente OpenAI para clasificar intents y sintetizar respuestas.
const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")
})
// Cliente service role para consultar tablas protegidas.
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

// ✅ CORS headers globales
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
}

// Normaliza texto para reglas simples (minusculas y sin acentos).
function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

// Pide a la IA que genere un JSON de consulta a DB basado en la pregunta.
async function aiDatabaseAnswer(message: string, do_number: string | null) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `
        Eres un asistente virtual para una empresa de logística.
        tienes la siguiente informacion diponible: 
        De la tabla shipments tienes: 
          Usa estos campos SOLO cuando correspondan a la pregunta:  
          do_number → este es el identificador principal de cada embarque, siempre que la pregunta haga referencia a un número de DO o a un embarque específico, debes usar este campo para filtrar la información.
          shipment_type → tipo de embarque (aereo, maritimo)
          origin → lugar desde donde sale la carga
          destination → lugar de destino de la carga
          eta → fecha estimada de llegada
          etd → fecha estimada de salida
          documentary_cutoff → fecha límite para entrega de documentos  
          current_location → ubicación actual de la carga
          booking_status → estado de la reserva
          inspection_status → estado de inspección
          free_days → días libres de contenedor
          incoterm → incoterm del embarque
          carrier → naviera o aerolínea
          current_status → estado actual del embarque
          current_location → ubicación actual del embarque
        de la tabla shipment_updates tienes:
          event_type → tipo de evento
          status → estado actual, se actualiza con cada novedad
          location → ubicación del embarque 
          observation → observación del evento
          created_at

          Nunca devuelvas un campo que no responda directamente la pregunta.
          
        Si la pregunta puede responderse con la información de la base de datos, responde con un JSON como este:
          {
          "query": {
            "table": "shipments",
            "fields": ["eta","status"]
          }
          }
          Reglas estrictas:

          1. Usa SOLO campos que respondan directamente la pregunta.
          2. Nunca inventes valores.
          3. Nunca uses un campo incorrecto (ej: no usar eta para destino).
          4. Si el dato no responde directamente la pregunta, indícalo
          5. Si falta información di que no está disponible
          6. Si la pregunta no puede responderse con estos campos devuelve:

          {
          "query": null
          }

          7. Nunca inventes un DO. Si el usuario no proporciona DO devuelve query:null.
        `
      },
      {
        role: "user",
        content:`
          mensaje usuario: ${message}
          do detectado: ${do_number || "ninguno"}
          `
      }
    ]
  })
  return completion.choices[0].message?.content.trim()
}

// Clasificador de intención usando OpenAI (devuelve nombre exacto o null).
async function detectIntentWithOpenAI(message: string) {
  const intentList = intents.map(i => i.intent).join(", ")
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `
          Clasifica el mensaje del usuario en UNA de estas intenciones: ${intentList}.  
          Reglas estrictas:
          1. Devuelve SOLO el nombre exacto de la intención, sin explicación.
          2. Solo usa un intent si el mensaje coincide EXACTAMENTE con su propósito.
          3. NO uses un intent de ubicación para preguntas de origen o destino.
          4. NO uses un intent de fecha para preguntas de lugar.
          5. Si no hay un intent que responda EXACTAMENTE la pregunta, responde "ninguna".
          6. Nunca respondas "ninguna" solo porque el usuario no dio el DO todavía.
        `
      },
      {
        role: "user",
        content: message
      }
    ]
  })
  const intentName = completion.choices[0].message?.content.trim().toLowerCase()
  return intents.find(i => i.intent.toLowerCase() === intentName) || null
}

// Re-valida que el intent realmente responda la pregunta.
async function validateIntent(message: string, intent: any): Promise<boolean> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `
          Eres un validador de intenciones. Tu única tarea es determinar si 
          el intent detectado responde DIRECTAMENTE la pregunta del usuario.
          
          Responde SOLO con: "si" o "no".
          
          Responde "no" si:
          - El intent es sobre un tema diferente al de la pregunta
          - El intent respondería una pregunta distinta a la que hizo el usuario
          - La pregunta pide información que ese intent no cubre
        `
      },
      {
        role: "user",
        content: `
          Pregunta del usuario: "${message}"
          Intent detectado: "${intent.intent}"
          Ejemplos de ese intent: ${JSON.stringify(intent.examples)}
          
          ¿Este intent responde directamente la pregunta?
        `
      }
    ]
  })

  const answer = completion.choices[0].message?.content.trim().toLowerCase()
  return answer === "si"
}

// Extrae un posible DO desde el mensaje.
function extractDO(message: string) {
  const patterns = [
    /x[- ]?\d+/i,    
    /m[- ]?\d+/i,
    /X[- ]?\d+/i,
    /M[- ]?\d+/i,
    /\b\d{5,}\b/
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match) {
      return match[0].toLowerCase() // ✅ fix: toLowerCase (no tolowerCase)
    }
  }

  return null
}

serve(async (req) => {

  // ✅ Manejo del preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {

    if (req.method !== "POST") {
      return new Response(JSON.stringify({
        mode: "error",
        answer: "Método no permitido"
      }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    // Payload esperado desde el frontend.
    const { message, do_number } = await req.json()

    if (!message) {
      return new Response(JSON.stringify({
        mode: "error",
        answer: "No se recibió ningún mensaje."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    // 1) Detecta intent y lo valida con un segundo modelo.
    const rawIntent = await detectIntentWithOpenAI(message)
    let intent = rawIntent && await validateIntent(message, rawIntent) ? rawIntent : null
    // 2) Usa DO enviado o lo detecta desde el texto.
    const DO = do_number?.toLowerCase() || extractDO(message)

    // Si el intent no cubre los campos solicitados, degradamos al flujo genérico.
    const requestedFields = inferRequestedFields(message)
    if (requestedFields.size > 0 && intent) {
      const intentFields = intent.database?.fields ?? []
      const coversAny = intentFields.some((field: string) => requestedFields.has(field))
      if (!coversAny) {
        intent = null
      }
    }

    console.error("INTENT:", intent?.intent || "null")
    console.error("DO:", DO)

    // 3) siempre_escalar - corta antes que todo
    if (intent?.escalate_if?.includes("siempre_escalar")) {
      return new Response(JSON.stringify({
        mode: "handoff",
        answer: "Esta consulta requiere atención de nuestro equipo. Te contactaremos pronto."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    // 4) Sin intent y sin DO - pedimos el DO.
    if (intent === null && !DO) {
      return new Response(JSON.stringify({
        mode: "ask_do",
        answer: "Para ayudarte mejor, por favor proporciona tu número de DO."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    // 5) Sin intent pero con DO - flujo IA libre contra DB.
    if (!intent) {
      const aiResult = await aiDatabaseAnswer(message, DO)
      console.log("AI RESULT:", aiResult)
      let parsed
      try {
        const clean = aiResult?.replace(/```json|```/g, "").trim() || ""
        parsed = JSON.parse(clean)
      } catch (error) {
        console.error("Error parsing AI response:", error, "Response was:", aiResult)
        return new Response(JSON.stringify({
          mode: "handoff",
          answer: "No pude entender tu consulta. Por favor reformúlala o contacta a nuestro equipo para asistencia personalizada."
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      if (!parsed.query) {
        return new Response(JSON.stringify({
          mode: "handoff",
          answer: "No pude encontrar información para darle respuesta a tu consulta."
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      // Tabla y campos propuestos por la IA.
      const { table, fields } = parsed.query

      const ALLOWED_TABLES = ["shipments", "shipment_updates"]
      const ALLOWED_FIELDS: Record<string, string[]> = {
        shipments: ["do_number","eta","etd","origin","destination",
          "documentary_cutoff","current_location","booking_status",
          "inspection_status","free_days","incoterm","carrier","current_status"],
        shipment_updates: ["event_type","status","location","observation","created_at"]
      }

      if (!ALLOWED_TABLES.includes(table)) {
        return new Response(JSON.stringify({
          mode: "handoff",
          answer: "No pude procesar esa consulta. Por favor contacta a nuestro equipo."
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      // Filtro estricto de campos permitidos.
      const safeFields = fields?.filter(
        (f: string) => ALLOWED_FIELDS[table]?.includes(f)
      ) || []

      // ✅ Logs después de declarar safeFields (fix: "Cannot access safeFields before initialization")
      console.log("=== AI DATABASE ANSWER ===")
      console.log("DO:", DO)
      console.log("TABLE:", table)
      console.log("FIELDS de la IA:", fields)
      console.log("FIELDS después de whitelist:", safeFields)

      if (safeFields.length === 0) {
        return new Response(JSON.stringify({
          mode: "handoff",
          answer: "No encontré campos válidos para responder esa consulta."
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      // Consulta la tabla con los campos aprobados.
      const { data, error } = await supabase
        .from(table)
        .select(safeFields.join(","))
        .eq("do_number", DO)
        .single()

      console.log("DATA:", JSON.stringify(data))
      console.log("ERROR:", JSON.stringify(error))

      if (error || !data) {
        return new Response(JSON.stringify({
          mode: "handoff",
          answer: "No encontré información para esa consulta."
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      // Redacta respuesta final usando solo datos reales.
      const finalAnswer = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `
            Eres un asistente virtual para una empresa de logística. Respondes a las preguntas utilizando exclusivamente
            la información que te proporciono a continuación, sin hacer suposiciones ni agregar información adicional. 
            Si la información no es suficiente para responder a la pregunta, indícalo claramente. Tu modelo de respuesta 
            debe ser con un tono amable, profesional, directo, conciso y servicial.`
          },
          {
            role: "user",
            content: `
            Pregunta del usuario: ${message} 
            Información disponible: ${JSON.stringify(data)}`
          }
        ]
      })

      return new Response(JSON.stringify({
        mode: "answer",
        answer: finalAnswer.choices[0].message?.content.trim() || "No pude generar una respuesta a tu consulta."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    // 6) Intent encontrado pero requires_do y no hay DO.
    if (intent.requires_do && !DO) {
      return new Response(JSON.stringify({
        mode: "ask_do",
        answer: "Para ayudarte necesito tu número de DO."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    // 7) Intent encontrado - flujo normal con template.
    let shipmentData: any = null

    // Si el intent requiere DO, cargamos la carga.
    if (intent.requires_do) {
      const { data, error } = await supabase
        .from("shipments")
        .select("*")
        .eq("do_number", DO)
        .single()

      if (error || !data) {
        return new Response(JSON.stringify({
          mode: "handoff",
          answer: "No pude encontrar información para ese DO. Por favor verifica el número o contacta a nuestro equipo."
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      shipmentData = data
    }

    // Campos requeridos por el intent para rellenar el template.
    const requiredFields = intent.database?.fields?.filter((f: string) => f !== "do_number") || []
    let response = intent.response_template || ""

    // Reemplaza placeholders y valida campos faltantes.
    if (requiredFields.length > 0 && shipmentData) {
      for (const field of requiredFields) {
        const value = shipmentData[field]

        if (!value) {
          return new Response(JSON.stringify({
            mode: "missing_data",
            answer: "En este momento no tengo registrada esa información para tu embarque. Nuestro equipo de operaciones puede confirmarla manualmente."
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        response = response.replace(`{${field}}`, value)
      }
    }

    return new Response(JSON.stringify({
      mode: "answer",
      answer: response,
      intent: intent.intent
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (error) {

    console.error("ERROR:", error)

    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  }

})
