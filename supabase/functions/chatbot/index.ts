import { serve } from "https://deno.land/std/http/server.ts";
import OpenAI from "https://esm.sh/openai";
import { createClient } from "jsr:@supabase/supabase-js@2";
import intentsData from "./intents.json" with { type: "json" };
const intents = intentsData.intents

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")
})
// Cliente global con service role: el chatbot accede a datos de cualquier usuario.
const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
)
const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
}

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalize(text: string) {
  // Convierte texto a minusculas sin tildes para comparaciones insensibles al acento.
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

async function aiDatabaseAnswer(message: string, do_number: string | null) {
  // Pide a la IA que genere un JSON de consulta a DB basado en la pregunta.
  // Se devuelve { query: { table, fields } } o { query: null } si no aplica.
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

async function detectIntentWithOpenAI(message: string) {
  // Clasifica la pregunta del usuario en uno de los intents predefinidos en intents.json.
  // Devuelve el objeto del intent si hay coincidencia exacta, o null si ninguno aplica.
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

async function validateIntent(message: string, intent: any): Promise<boolean> {
  // Segunda pasada de validacion: verifica que el intent detectado realmente
  // responda la pregunta del usuario antes de usarlo.
  // Reduce falsos positivos del clasificador cuando el intent es ambiguo.
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
async function isRelevantQuestion (message: string): Promise<boolean> {
    // Filtro previo para descartar preguntas que claramente no son sobre embarques
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
            Eres un filtro para un chatbot de logística de un agente de carga internacional especificamente en una aplicación
            para el tracking de cargas
            Tu única tarea es determinar si la pregunta del usuario tiene alguna relación con 
            logística, embarques, cargas o la operación de la empresa.

            Responde "no" SOLO si la pregunta claramente no tiene nada que ver, por ejemplo:
            - Preguntas matemáticas o hipotéticas sin contexto logístico ("si tengo 2 barcos qué hago")
            - Preguntas sobre temas completamente ajenos (cocina, deportes, entretenimiento)
            - Insultos o texto sin sentido

            Responde "si" si la pregunta podría ser de un cliente preguntando por su carga aunque no mencione un DO todavía, 
            información bancaria como por ejemplo donde pagar o información de la empresa, a menos
            de que consideres que esa información no es relevante para el cliente (ej. quien es el dueño de la empresa?).

            Responde SOLO con: "si" o "no".
          `
      },
      {
        role: "user",
        content: message
      }
    ]
  })

  const answer = completion.choices[0].message?.content.trim().toLowerCase()
  return answer === "si"
}


function extractDO(message: string) {
  // Extrae el numero de DO del mensaje usando patrones comunes del dominio:
  // prefijos X o M seguidos de digitos, o numeros de 5+ digitos sin prefijo.
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
      // Normalizar a minusculas para comparar contra do_number en DB.
      return match[0].toLowerCase()
    }
  }

  return null
}

function inferRequestedFields(message: string): Set<string> {
  // Mapea palabras clave del mensaje a campos de la tabla shipments.
  // Se usa para verificar si el intent detectado cubre lo que el usuario pregunto.
  const fieldKeywords: Record<string, string[]> = {
    eta: ["eta", "llegada", "arribo", "cuando llega"],
    etd: ["etd", "salida", "zarpe", "cuando sale"],
    origin: ["origen", "sale desde", "procedencia"],
    destination: ["destino", "hacia donde", "va a"],
    current_status: ["estado", "status", "situacion"],
    current_location: ["ubicacion", "donde esta", "posicion"],
    carrier: ["naviera", "aerolinea", "carrier", "transportista"],
    incoterm: ["incoterm"],
    free_days: ["dias libres", "free days"],
    documentary_cutoff: ["corte documental", "documentary cutoff"],
  }

  const normalized = normalize(message)
  const requested = new Set<string>()

  for (const [field, keywords] of Object.entries(fieldKeywords)) {
    if (keywords.some(kw => normalized.includes(normalize(kw)))) {
      requested.add(field)
    }
  }

  return requested
}

serve(async (req) => {

  // Respuesta inmediata al preflight CORS.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")){
      return jsonResponse(
        { error: "Falta el encabezado de autorizacion", error_key: "chatbot.authHeaderMissing" },
        401,
      );
    }
    const token = authHeader.replace ("Bearer ", "").trim();
    const {
        data: {user},
        error: authError
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user){
        return jsonResponse(
          { error: "Token o sesión invalida", error_key: "chatbot.invalidSession" },
          401,
        );
    }
    if (req.method !== "POST") {
      return jsonResponse(
        {
          mode: "error",
          answer_key: "chatbot.methodNotAllowed",
          answer: "Método no permitido",
        },
        405,
      );
    }

    let body : any;
    try {
      body = await req.json()
    } catch {
        return jsonResponse (
          {error: "JSON invalido"},
          400
      );
    }
    const { message, do_number } = body;

    if (!message) {
      return jsonResponse({
        mode: "error",
        answer_key: "chatbot.noMessage",
        answer: "No se recibió ningún mensaje.",
      });
    }
    //Validación de relevancia del mensaje 
    const isRelevant = await isRelevantQuestion(message)
    if (!isRelevant) {
      return jsonResponse({
        mode: "off_topic",
        answer_key: "chatbot.offTopic",
        answer: "No pude entender tu consulta. Recuerda que soy un asistente para consultas sobre embarques, cargas y procesos logísticos.",
      });
    }
    // Detectar y validar el intent en paralelo con la extraccion del DO.
    const rawIntent = await detectIntentWithOpenAI(message)
    let intent = rawIntent && await validateIntent(message, rawIntent) ? rawIntent : null

    // El DO puede venir en el payload del frontend o extraerse directamente del mensaje.
    const DO = do_number?.toLowerCase() || extractDO(message)

    // Si el intent no cubre los campos que el usuario pregunta,
    // degradar al flujo generico de consulta libre contra DB.
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

    // --- Arbol de decision del chatbot ---

    // 1. Intents marcados como siempre_escalar se derivan al equipo humano
    //    sin intentar responder automaticamente, independientemente del contexto.
    if (intent?.escalate_if?.includes("siempre_escalar")) {
      return jsonResponse({
        mode: "handoff",
        answer_key: "chatbot.handoff",
        answer: "Esta consulta requiere atención de nuestro equipo. Te contactaremos pronto.",
      });
    }

    // 2. Sin intent clasificado y sin DO: no hay suficiente informacion para
    //    responder nada concreto; se le pide al usuario su numero de DO.
    if (intent === null && !DO) {
      return jsonResponse({
        mode: "ask_do",
        answer_key: "chatbot.askDo",
        answer: "Para ayudarte mejor, por favor proporciona tu número de DO.",
      });
    }

    // 3. Sin intent pero con DO: la IA determina libremente que campos consultar
    //    en base a la pregunta, usando la whitelist de tablas y campos permitidos.
    if (!intent) {
      const aiResult = await aiDatabaseAnswer(message, DO)
      let parsed
      try {
        // Limpiar posibles bloques de codigo Markdown que la IA pueda incluir.
        const clean = aiResult?.replace(/```json|```/g, "").trim() || ""
        parsed = JSON.parse(clean)
      } catch (error) {
        console.error("Error parsing AI response:", error, "Response was:", aiResult)
        return jsonResponse({
          mode: "handoff",
          answer_key: "chatbot.aiParseError",
          answer: "No pude entender tu consulta. Por favor reformúlala o contacta a nuestro equipo para asistencia personalizada.",
        });
      }

      if (!parsed.query) {
        return jsonResponse({
          mode: "handoff",
          answer_key: "chatbot.aiNoInfo",
          answer: "No pude encontrar información para darle respuesta a tu consulta.",
        });
      }

      const { table, fields } = parsed.query

      // Whitelist de tablas y campos permitidos para prevenir consultas arbitrarias
      // generadas por la IA que podrian exponer datos sensibles.
      const ALLOWED_TABLES = ["shipments", "shipment_updates"]
      const ALLOWED_FIELDS: Record<string, string[]> = {
        shipments: ["do_number","eta","etd","origin","destination",
          "documentary_cutoff","current_location","booking_status",
          "inspection_status","free_days","incoterm","carrier","current_status"],
        shipment_updates: ["event_type","status","location","observation","created_at"]
      }

      if (!ALLOWED_TABLES.includes(table)) {
        return jsonResponse({
          mode: "handoff",
          answer_key: "chatbot.aiInvalidTable",
          answer: "No pude procesar esa consulta. Por favor contacta a nuestro equipo.",
        });
      }

      // Filtrar los campos sugeridos por la IA contra la whitelist correspondiente.
      const safeFields = fields?.filter(
        (f: string) => ALLOWED_FIELDS[table]?.includes(f)
      ) || []

      if (safeFields.length === 0) {
        return jsonResponse({
          mode: "handoff",
          answer_key: "chatbot.aiNoValidFields",
          answer: "No encontré campos válidos para responder esa consulta.",
        });
      }

    let query = supabase
        .from(table)
        .select(safeFields.join(","))
        .eq("do_number", DO)
    let data: any = null
    let error: any = null
    if (table === "shipments"){
      const {data: userShipments} = await supabase
        .from("profile_shipment")
        .select("shipment_id")
        .eq("client_id", user.id)
      const shipmentIds = (userShipments ?? []).map(s=>s.shipment_id)
      query = query.in("id",shipmentIds)
    }

    if (table === "shipment_updates") {
      const { data: userShipments } = await supabase
        .from("profile_shipment")
        .select("shipment_id")
        .eq("client_id", user.id);

      const shipmentIds = (userShipments ?? []).map(s => s.shipment_id);
      query = query.in("shipment_id", shipmentIds);

      const result = await query.order("created_at", { ascending: false }).limit(1)
      data=result.data
      error=result.error
    } else {
        const result = await query.single()
        data=result.data
        error=result.error
        }

      if (error || !data) {
        return jsonResponse({
          mode: "handoff",
          answer_key: "chatbot.aiNoData",
          answer: "No encontré información para responder tu consulta",
        });
      }

      // La IA genera la respuesta en lenguaje natural usando exclusivamente
      // los datos reales devueltos por la DB, sin inventar informacion.
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

      const resolvedAnswer = finalAnswer.choices[0].message?.content.trim()
      return jsonResponse(
        resolvedAnswer
          ? {
              mode: "answer",
              answer: resolvedAnswer,
            }
          : {
              mode: "answer",
              answer_key: "chatbot.aiNoAnswer",
              answer: "No pude generar una respuesta a tu consulta.",
            },
      )
    }

    // 4. Intent detectado pero requiere DO y el usuario no lo proporciono.
    if (intent.requires_do && !DO) {
      return jsonResponse({
        mode: "ask_do",
        answer_key: "chatbot.askDoRequired",
        answer: "Para ayudarte necesito tu número de DO.",
      });
    }

    // 5. Flujo normal con intent valido: consultar DB y rellenar el template de respuesta.
    let shipmentData: any = null
    const requiredFields = intent.database?.fields?.filter((f: string) => f !== "do_number") || []
    let response = intent.response_template || ""
    console.error("requiredFields:", requiredFields)
console.error("DO en query:", DO)
console.error("select:", requiredFields.join(","))

    if (intent.requires_do) {
      const {data: userShipments} = await supabase
        .from("profile_shipment")
        .select("shipment_id")
        .eq("client_id", user.id)
      
      if (!userShipments || userShipments.length===0){
        return jsonResponse ({
          mode: "handoff",
          answer_key: "chatbot.doNotFound",
          answer: "No pude encontrar información para ese DO."
        })
      }
      const shipmentIds = userShipments.map( s=> s.shipment_id)
      const { data, error } = await supabase
        .from("shipments")
        .select(requiredFields.join(","))
        .eq("do_number", DO)
        .in("id", shipmentIds)
        .single()

      if (error || !data) {
        return jsonResponse({
          mode: "handoff",
          answer_key: "chatbot.doNotFound",
          answer: "No pude encontrar información para ese DO. Por favor verifica el número o contacta a nuestro equipo.",
        });
      }

      shipmentData = data
    }

    

    if (requiredFields.length > 0 && shipmentData) {
      for (const field of requiredFields) {
        const value = shipmentData[field]

        // Si un campo requerido por el template no tiene valor en DB,
        // informar al usuario en lugar de devolver una respuesta con placeholders vacios.
        if (!value) {
          return jsonResponse({
            mode: "missing_data",
            answer_key: "chatbot.missingData",
            answer: "En este momento no tengo registrada esa información para tu embarque. Nuestro equipo de operaciones puede confirmarla manualmente.",
          });
        }

        // Sustituir el placeholder del template con el valor real de DB.
        response = response.replace(`{${field}}`, value)
      }
    }

    return jsonResponse({
      mode: "answer",
      answer: response,
      intent: intent.intent,
    });

  } catch (error) {

    console.error("ERROR:", error)

    // Captura errores no controlados para evitar exponer stack traces al cliente.
    return jsonResponse(
      {
        error: error.message,
        error_key: "chatbot.internalError",
      },
      500,
    );

  }

})
