// Edge Function: list-profiles
// Objetivo:
// - Validar identidad del usuario via JWT Bearer.
// - Permitir acceso solo a perfiles internos.
// - Retornar lista completa de perfiles para pantallas administrativas.

import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST, GET",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1) Validar encabezado de autorizacion.
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Falta el encabezado de autorizacion" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // 2) Cliente administrativo para validar token y consultar tablas protegidas.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 3) Resolver usuario autenticado a partir del JWT.
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({
        error: "Token o sesion invalida",
        details: authError?.message,
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Autorizacion: solo usuarios internos pueden listar perfiles.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_internal")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.is_internal) {
      return new Response(JSON.stringify({ error: profileError?.message || "El perfil no es interno" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5) Consulta principal de perfiles para administracion.
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) {
      return new Response(JSON.stringify({ error: profilesError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(profiles), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
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
});
Administrativo/RRHH

cuando recibiré la factura de mi embarque?
respuesta base: Confirmar num DO
datos mínimos para responder: DO, impo/expo
en qué casos se debería derivar a humano?: cuando el cliente solicite un dato más especifico
fuente de la respuesta: base de datos

Qué retenciones debo aplicar a la factura?
**en qué casos se debería derivar a humano?:**SI O SI A HUMANO
A qué cuenta bancaria debo realizar el pago?
respuesta base: CTA. AHORROS DAVIVIENDA 462400031375 O CTA. AHORROS GLOBAL66 9005269171
Tengo crédito vigente con INGELOX?
**en qué casos se debería derivar a humano?:**SI O SI A HUMANO
Tengo dudas con mi factura
en qué casos se debería derivar a humano?: SI O SI A HUMANO
Por qué me cobran IVA?
respuesta base: Nuestros servicios propios generan IVA
A qué correo llegan las facturas?
respuesta base:
datos mínimos para responder:
en qué casos se debería derivar a humano?: SI O SI A HUMANO
fuente de la respuesta:
Puedo pagar por PSE?
respuesta base: No, por el momento no es posible, los pagos se realizan a CTA. AHORROS DAVIVIENDA 462400031375 O CTA. AHORROS GLOBAL66 9005269171
Dónde envió el soporte de pago?
respuesta base: al correo admin@ingelox.com.co
datos mínimos para responder:
en qué casos se debería derivar a humano?: N/A
fuente de la respuesta:
Cómo genero una disputa o reclamación a una factura de INGELOX?
respuesta base: al correo admin@ingelox.com.co
datos mínimos para responder:
en qué casos se debería derivar a humano?: N/A
fuente de la respuesta:


Operaciones Marítimas expo

Cuantos días libres tengo en origen?
respuesta base: la generalidad son 10 días libres en origen para contenedores dry
datos mínimos para responder: 
en qué casos se debería derivar a humano?: si desea una respuesta mas especifica, contactar humano
fuente de la respuesta: generalidad navieras
quien asumirá los gastos del rollover
respuesta base:
datos mínimos para responder:
en qué casos se debería derivar a humano?: SIEMPRE 
fuente de la respuesta: 
Cuando es cut off / VGM documental?
respuesta base: El cut off será el día ……
datos mínimos para responder: DO y consulta db
en qué casos se debería derivar a humano?: En caso de que en la tabla salga null o vacio
fuente de la respuesta: DB
Cuando se hará el cargue?
respuesta base: Aproximadamente una semana antes del arrivo de la motonave
datos mínimos para responder: DO
en qué casos se debería derivar a humano?: Si pide fecha especifica
fuente de la respuesta: DB
Cuando se hará el retiro del contenedor?
respuesta base: cda caso es especial, generalmente, En caso de que su reserva sea de equipo especial o mercancía peligrosa, de 5 a 7 días calendario antes de la ETD. Si es carga general de 7 a 10 días calendario antes de la ETD.
datos mínimos para responder: DO
**en qué casos se debería derivar a humano?:**Si pide fecha especifica
fuente de la respuesta: DB
Cuando llegará mi embarque a destino?
respuesta base: ETA
datos mínimos para responder: DO
**en qué casos se debería derivar a humano?:**Si pide fecha especifica
fuente de la respuesta:DB
Donde se encuentra mi embarque en este momento?
respuesta base: La fecha de ETA se mantiene de acuerdo al ultimo reporte enviado
datos mínimos para responder: DO
**en qué casos se debería derivar a humano?:**Si pide fecha especifica
fuente de la respuesta: DB
Ya tenemos reserva confirmada para mi embarque?
respuesta base: Si no has recibido la confirmación de tu reserva el tiempo estimado de respuesta por parte de la naviera es de 12 horas para carga general, si es mercancía peligrosa o equipo especial el tiempo puede aumentar
datos mínimos para responder:DO
en qué casos se debería derivar a humano?: si es especial
fuente de la respuesta: Navieras
Mi embarque ha salido para inspección física o documental?
respuesta base: Se verificará esa info y se actualizara el sistema lo más pronto posible
datos mínimos para responder: DO
en qué casos se debería derivar a humano?: si pasan 12 horas sin respuesta
fuente de la respuesta: puerto o agente aduana
¿Cómo puedo hacer seguimiento (tracking) a mi embarque?
respuesta base: CONSULTANDO A TRAVES DEL DO, ORIGEN o DESTINO EN LA Pantalla PRINCIPAL DE LA APLICACION
datos mínimos para responder:
en qué casos se debería derivar a humano?:
fuente de la respuesta:

MARITIMAS IMPO
Cuando llegará mi embarque a destino?
respuesta base: ETA
datos mínimos para responder: DO
**en qué casos se debería derivar a humano?:**Si pide fecha especifica
fuente de la respuesta:DB

Ya tenemos documentos finales del embarque?
respuesta base: Los documentos finales estarán disponibles una vez contemos con fecha On Board y sujeto a condiciones de pago vigentes
datos mínimos para responder:DO
en qué casos se debería derivar a humano?: si pregunta mas
fuente de la respuesta: RTA registrada y Humano
¿Cómo puedo hacer seguimiento (tracking) a mi embarque?
respuesta base: CONSULTANDO A TRAVES DEL DO, ORIGEN o DESTINO EN LA Pantalla PRINCIPAL DE LA APLICACION
datos mínimos para responder:
en qué casos se debería derivar a humano?:
fuente de la respuesta:
Cuantos días libres de importación tenemos?
respuesta base: En la información del embarque se encuentran estos datos
datos mínimos para responder: DO
en qué casos se debería derivar a humano?: null o vacia
fuente de la respuesta: DB
Cuando se hará la devolución de contenedor?
respuesta base:
datos mínimos para responder:
en qué casos se debería derivar a humano?: SI O SI HUMANO
fuente de la respuesta:

Operaciones aéreas

¿Cuál es el tiempo de tránsito real de mi carga?
respuesta base: Tu fecha estimada de llegada es …..
datos mínimos para responder: DO, ETA
en qué casos se debería derivar a humano?: Null, vacia
fuente de la respuesta: DB
¿Qué documentos necesito para entregar la mercancía en la aerolínea?
respuesta base: Factura comercial, lista de empaque, OA, SAE, planilla de traslado, cartas de responsabilidad.
datos mínimos para responder: DO
en qué casos se debería derivar a humano?: Casos especiales (animales, cargas peligrosas, flores etc)
fuente de la respuesta: Normatividad
¿Cómo se calcula el flete aéreo?
respuesta base: TOTAL DE KILOS BRUTOS/VOLUMEN * TARIFA COTIZADA
datos mínimos para responder:
en qué casos se debería derivar a humano?: NUNCA
fuente de la respuesta: Cotización
¿Qué incluye exactamente la tarifa cotizada?
respuesta base:
datos mínimos para responder:
en qué casos se debería derivar a humano?: SIEMPRE
fuente de la respuesta:
¿Qué pasa si el peso o volumen declarado no coincide con el verificado?
respuesta base:
datos mínimos para responder:
en qué casos se debería derivar a humano?: SIEMPRE
fuente de la respuesta:
¿Mi mercancía es considerada peligrosa?
respuesta base: SI APARECE EN MSDS PUNTO 14
datos mínimos para responder:
en qué casos se debería derivar a humano?:
fuente de la respuesta: MSDS
¿Cuál es el cut-off para entregar la carga?
respuesta base: El cut off será el día ……
datos mínimos para responder: DO y consulta db
en qué casos se debería derivar a humano?: En caso de que en la tabla salga null o vacio
fuente de la respuesta: DB
¿Quién asume los costos en destino?
respuesta base: DEPENDE DEL INCOTERM NEGOCIADO
datos mínimos para responder: DO, INCOTERM
en qué casos se debería derivar a humano?:
fuente de la respuesta: OMC
¿El seguro está incluido en el flete?
respuesta base: NO, EL SEGURO SE TOMA APARTE CON BASE EN EL VALOR TOTAL DE LA MERCANCIA
datos mínimos para responder:
en qué casos se debería derivar a humano?:
fuente de la respuesta:
¿Cómo puedo hacer seguimiento (tracking) a mi embarque?
respuesta base: CONSULTANDO A TRAVES DEL DO, ORIGEN o DESTINO EN LA Pantalla PRINCIPAL DE LA APLICACION
datos mínimos para responder:
en qué casos se debería derivar a humano?:SI HAY VARIOS CAMPOS VACIOS
fuente de la respuesta:
¿Qué pasa si el vuelo se cancela o la carga se queda?
respuesta base:preguntar si es caso hipotetico o preocupación real por situación actual
datos mínimos para responder:
en qué casos se debería derivar a humano?:solo si es preocupación real
fuente de la respuesta:input
¿Cuánto tiempo puede permanecer la carga en el aeropuerto sin generar bodegaje?
respuesta base:
datos mínimos para responder:
en qué casos se debería derivar a humano?:SIEMPRE
fuente de la respuesta:

