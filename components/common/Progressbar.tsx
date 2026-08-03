import i18n from '@/i18n';
import * as types from '@/lib/shipmentType';
import { formatDateDisplay } from '@/utils/dateFormatting';
import { StyleSheet, Text, View } from 'react-native';
import { ShipmentTransportIcon } from '../../components/auth/ShipmentTransportIcon';
import { COLORS } from '../../components/ui/COLORS';

type RouteProgressProps = {
  toneColor: string;
  shipment?: types.ShipmentListItem | null;
};

// --- Proporciones FIJAS de sección. Nunca cambian, sin importar cuántos
// estados se agreguen dentro de cada categoría. ---
const SECTIONS = {
  pre: { min: 0.0, max: 0.25 },
  transit: { min: 0.25, max: 0.75 },
  post: { min: 0.75, max: 1.0 },
} as const;

// Clasificación de estados por categoría. Agregar un estado nuevo
// solo implica sumarlo a la lista correspondiente, JAMÁS tocar SECTIONS.
const PRE_TRANSIT_STATUSES: string[] = [
  // ej. 'booking_confirmed', 'documentacion', etc. cuando existan
];
const TRANSIT_STATUS = 'on_way';
const POST_TRANSIT_STATUSES: string[] = ['waiting_inspection', 'arrived'];
const FINAL_STATUS = 'arrived';

// Estado especial: detiene la barra por completo, no es "posterior a tránsito"
const STALLED_STATUS = 'retraso';

function getShipmentProgress(
  etd: string | null | undefined,
  eta: string | null | undefined,
  atd: string | null | undefined,
  ata: string | null | undefined,
  status: string | null | undefined,
  latestStatusAt: string | null | undefined
): { value: number; stalled: boolean } {
  if (!status) return { value: 0, stalled: false };

  if (status === STALLED_STATUS) {
    // Se congela en el progreso que tenía el tramo de tránsito hasta el
    // momento en que cambió a "retraso" (no sigue avanzando con el tiempo real).
    const frozenAt = latestStatusAt ? new Date(latestStatusAt).getTime() : Date.now();
    const frozenProgress = interpolateTransit(etd, eta, atd, ata, frozenAt);
    return { value: frozenProgress, stalled: true };
  }

  if (status === FINAL_STATUS) {
    return { value: SECTIONS.post.max, stalled: false };
  }

  if (POST_TRANSIT_STATUSES.includes(status)) {
    return { value: SECTIONS.post.min, stalled: false };
  }

  if (status === TRANSIT_STATUS) {
    return { value: interpolateTransit(etd, eta, atd, ata, Date.now()), stalled: false };
  }

  if (PRE_TRANSIT_STATUSES.includes(status)) {
    return { value: SECTIONS.pre.min, stalled: false };
  }

  // Estado desconocido/no mapeado: no asumimos nada, quedamos en 0
  return { value: 0, stalled: false };
}

// Interpola SOLO dentro del rango 25-75%, usando ETD/ATD/ETA/ATA.
// `asOf` permite congelar el cálculo en un instante pasado (para "retraso").
function interpolateTransit(
  etd: string | null | undefined,
  eta: string | null | undefined,
  atd: string | null | undefined,
  ata: string | null | undefined,
  asOf: number
): number {
  const { min, max } = SECTIONS.transit;

  const ETD = etd ? new Date(etd).getTime() : null;
  const ETA = eta ? new Date(eta).getTime() : null;
  const ATD = atd ? new Date(atd).getTime() : null;
  const ATA = ata ? new Date(ata).getTime() : null;

  const departure = ATD ?? ETD;
  if (!departure || !ETA) return min;
  if (ATA) return max;

  const totalDuration = ETA - departure;
  if (totalDuration <= 0) return min;

  const elapsed = asOf - departure;
  const fraction = Math.max(0, Math.min(1, elapsed / totalDuration));

  return min + fraction * (max - min);
}

export function RouteProgress({ toneColor, shipment }: RouteProgressProps) {
  const { value: progress, stalled } = getShipmentProgress(
    shipment?.etd,
    shipment?.eta,
    shipment?.atd,
    shipment?.ata,
    shipment?.current_status,
    shipment?.latest_status_at
  );

  const markerLeft = `${Math.max(6, Math.min(94, progress * 100))}%` as `${number}%`;
  const locale = i18n.language === 'es' ? 'es-CO' : 'en-US';
  const barColor = stalled ? COLORS.orange : toneColor;

  return (
    <View style={styles.wrap}>
      <View style={styles.routeProgressWrap}>
        <View style={styles.routeTrack} />
        <View style={[styles.routeTrackFilled, { width: `${Math.max(8, progress * 100)}%`, backgroundColor: barColor }]} />

        {/* Checkpoints en los límites FIJOS de sección (25% y 75%) */}
        <View style={[styles.checkpointDot, { left: '25%' }]} />
        <View style={[styles.checkpointDot, { left: '75%' }]} />

        <View style={[styles.routeMarker, { left: markerLeft, borderColor: barColor }]}>
          <ShipmentTransportIcon shipment={shipment} color={barColor} size={16} />
        </View>
      </View>

      {/* Labels anclados exactamente al mismo % que su checkpoint */}
      <View style={styles.labelsRow}>
        <View style={[styles.labelBlock, { left: '25%' }]}>
          <Text style={styles.checkpointLabel}>Zarpe</Text>
          <Text style={styles.checkpointDate}>
            {(shipment?.atd ?? shipment?.etd) ? formatDateDisplay(shipment?.atd ?? shipment?.etd, locale) : '—'}
          </Text>
        </View>
        <View style={[styles.labelBlock, { left: '75%' }]}>
          <Text style={styles.checkpointLabel}>Llegada</Text>
          <Text style={styles.checkpointDate}>
            {(shipment?.ata ?? shipment?.eta) ? formatDateDisplay(shipment?.ata ?? shipment?.eta, locale) : '—'}
          </Text>
        </View>
      </View>

      {stalled ? (
        <Text style={styles.stalledLabel}>Carga detenida — retraso en ruta</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  routeProgressWrap: { position: 'relative', height: 30, justifyContent: 'center' },
  routeTrack: { height: 4, borderRadius: 999, backgroundColor: 'rgba(245, 241, 234, 0.24)' },
  routeTrackFilled: { position: 'absolute', left: 0, height: 4, borderRadius: 999 },
  checkpointDot: {
    position: 'absolute', top: 11, width: 8, height: 8, borderRadius: 4,
    marginLeft: -4, backgroundColor: 'rgba(245, 241, 234, 0.5)',
  },
  routeMarker: {
    position: 'absolute', top: 1, marginLeft: -14, width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.surface, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  labelsRow: { position: 'relative', height: 34 },
  labelBlock: {
    position: 'absolute',
    top: 0,
    transform: [{ translateX: '-50%' }],
    alignItems: 'center',
  },
  checkpointLabel: { fontSize: 11, color: 'rgba(245, 241, 234, 0.5)' },
  checkpointDate: { fontSize: 11, color: 'rgba(245, 241, 234, 0.8)', fontWeight: '600', marginTop: 2 },
  stalledLabel: { fontSize: 12, color: COLORS.orange, fontWeight: '700', marginTop: 4 },
});