import i18n from '@/i18n';
import * as types from '@/lib/shipmentType';
import { formatDateDisplay } from '@/utils/dateFormatting';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { ShipmentTransportIcon } from '../../components/auth/ShipmentTransportIcon';
import { COLORS } from '../../components/ui/COLORS';

type RouteProgressProps = {
  toneColor: string;
  shipment?: types.ShipmentListItem | null;
};

// --- Proporciones de sección de la barra de progreso ---
const SECTIONS = {
  pre: { min: 0.0, max: 0.25 },
  transit: { min: 0.25, max: 0.75 },
  post: { min: 0.75, max: 1.0 },
} as const;

// Mapeo directo de estados fijos a porcentajes de progreso específicos
const FIXED_STATUS_PROGRESS_MAP: Record<string, number> = {
  // Exportación
  expo_start_operation: 0.08,
  expo_booking_confirmation: 0.15,
  expo_vehicle: 0.22,
  expo_documentation: 0.25,
  expo_departure: 0.35,
  expo_arrival_confirmation: 1.0,

  // Importación
  impo_start_operation: 0.08,
  impo_filling: 0.16,
  impo_documentation: 0.25,
  impo_departure: 0.35,
  impo_customs: 0.80,
  impo_arrival_confirmation: 0.90,
  impo_national_transit: 1.0,

  // Estados legacy / frases comunes
  arrived: 1.0,
  delivered: 1.0,
  entregado: 1.0,
  waiting_inspection: 0.80,
  aduana: 0.80,
  inspeccion: 0.80,
};

// Estados que indican que la carga está navegando / volando en tránsito internacional
const IN_TRANSIT_STATUSES = new Set([
  'expo_international_transit',
  'impo_international_transit',
  'on_way',
  'transit',
  'in_transit',
  'en_transito',
  'en tránsito',
]);

const STALLED_STATUSES = new Set([
  'retraso',
  'delayed',
  'stalled',
  'detenido',
]);

function getShipmentProgress(
  etd: string | null | undefined,
  eta: string | null | undefined,
  atd: string | null | undefined,
  ata: string | null | undefined,
  status: string | null | undefined,
  latestStatusAt: string | null | undefined
): { value: number; stalled: boolean } {
  if (!status) return { value: 0, stalled: false };

  const normalizedStatus = status.trim().toLowerCase();

  // 1. Caso de retraso o carga detenida
  if (STALLED_STATUSES.has(normalizedStatus) || normalizedStatus.includes('retras')) {
    const frozenAt = latestStatusAt ? new Date(latestStatusAt).getTime() : Date.now();
    const frozenProgress = interpolateTransit(etd, eta, atd, ata, frozenAt);
    return { value: frozenProgress, stalled: true };
  }

  // 2. Si el estado es de tránsito internacional continuo, interpola por fechas
  if (IN_TRANSIT_STATUSES.has(normalizedStatus) || normalizedStatus.includes('transit') || normalizedStatus.includes('tránsit')) {
    return { value: interpolateTransit(etd, eta, atd, ata, Date.now()), stalled: false };
  }

  // 3. Si existe un valor predefinido para el estado fijo
  if (normalizedStatus in FIXED_STATUS_PROGRESS_MAP) {
    return { value: FIXED_STATUS_PROGRESS_MAP[normalizedStatus], stalled: false };
  }

  // 4. Heurísticas para textos libres o legacy
  if (normalizedStatus.includes('entreg') || normalizedStatus.includes('llegad') || normalizedStatus.includes('arrived') || normalizedStatus.includes('delivered')) {
    return { value: SECTIONS.post.max, stalled: false };
  }
  if (normalizedStatus.includes('aduan') || normalizedStatus.includes('inspecc') || normalizedStatus.includes('custom')) {
    return { value: 0.80, stalled: false };
  }
  if (normalizedStatus.includes('inici') || normalizedStatus.includes('reserv') || normalizedStatus.includes('booking') || normalizedStatus.includes('documen')) {
    return { value: 0.20, stalled: false };
  }

  // Fallback si hay fechas válidas: intenta interpolar
  if ((atd || etd) && (ata || eta)) {
    return { value: interpolateTransit(etd, eta, atd, ata, Date.now()), stalled: false };
  }

  return { value: 0.1, stalled: false };
}

// Interpola dentro del rango 25-75%, usando ETD/ATD/ETA/ATA.
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
  if (!departure || !ETA) return 0.50; // Fallback punto medio de tránsito si no hay fechas
  if (ATA) return max;

  const totalDuration = ETA - departure;
  if (totalDuration <= 0) return min;

  const elapsed = asOf - departure;
  const fraction = Math.max(0, Math.min(1, elapsed / totalDuration));

  return min + fraction * (max - min);
}

export function RouteProgress({ toneColor, shipment }: RouteProgressProps) {
  const { t } = useTranslation();
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

        {/* Checkpoints en los límites de sección (25% y 75%) */}
        <View style={[styles.checkpointDot, { left: '25%' }]} />
        <View style={[styles.checkpointDot, { left: '75%' }]} />

        <View style={[styles.routeMarker, { left: markerLeft, borderColor: barColor }]}>
          <ShipmentTransportIcon shipment={shipment} color={barColor} size={16} />
        </View>
      </View>

      {/* Labels anclados a los checkpoints */}
      <View style={styles.labelsRow}>
        <View style={[styles.labelBlock, { left: '25%' }]}>
          <Text style={styles.checkpointLabel}>
            {t('shipmentProgress.departure')}
          </Text>
          <Text style={styles.checkpointDate}>
            {(shipment?.atd ?? shipment?.etd) ? formatDateDisplay(shipment?.atd ?? shipment?.etd, locale) : '—'}
          </Text>
        </View>
        <View style={[styles.labelBlock, { left: '75%' }]}>
          <Text style={styles.checkpointLabel}>
            {t('shipmentProgress.arrival')}
          </Text>
          <Text style={styles.checkpointDate}>
            {(shipment?.ata ?? shipment?.eta) ? formatDateDisplay(shipment?.ata ?? shipment?.eta, locale) : '—'}
          </Text>
        </View>
      </View>

      {stalled ? (
        <Text style={styles.stalledLabel}>
          {t('shipmentProgress.stalled')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  routeProgressWrap: { position: 'relative', height: 30, justifyContent: 'center' },
  routeTrack: { height: 5, borderRadius: 999, backgroundColor: 'rgba(245, 241, 234, 0.24)' },
  routeTrackFilled: { position: 'absolute', left: 0, height: 5, borderRadius: 999 },
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