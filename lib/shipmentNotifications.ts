import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

export type ShipmentEventType = 'assigned' | 'updated' | 'deleted';

type NotifyShipmentEventParams = {
  eventType: ShipmentEventType;
  shipmentId: string;
  targetUserId?: string;
  doNumber?: string | null;
  status?: string | null;
};

export async function notifyShipmentEvent(params: NotifyShipmentEventParams) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return;
  }

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
      do_number: params.doNumber ?? null,
      status: params.status ?? null,
    }),
  });
}
