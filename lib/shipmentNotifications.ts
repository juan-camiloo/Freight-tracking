// Modulo: shipmentNotifications
// Encapsula la llamada a la Edge Function que dispara push por eventos de carga.
import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

// Tipos de eventos de carga que disparan notificacion.
export type ShipmentEventType = 'assigned' | 'updated' | 'deleted';

// Payload para notificar un evento de carga.
type NotifyShipmentEventParams = {
  eventType: ShipmentEventType;
  shipmentId: string;
  targetUserId?: string;
  targetUserIds?: string[];
  doNumber?: string | null;
  status?: string | null;
};

// Invoca la Edge Function que envia notificaciones push.
export async function notifyShipmentEvent(params: NotifyShipmentEventParams) {
  // Recupera access token actual para autenticar la invocacion server-side.
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    // Sin sesion no intentamos notificar.
    return;
  }

  // La Edge Function se encarga de resolver destinatarios y canal push.
  await fetch(`${supabaseUrl}/functions/v1/notify-shipment-event`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: params.eventType,
      shipment_id: params.shipmentId,
      target_user_id: params.targetUserId ?? null,
      target_user_ids: params.targetUserIds ?? null,
      do_number: params.doNumber ?? null,
      status: params.status ?? null,
    }),
  });
}
