import { ShipmentTransportBadge } from '@/components/auth/ShipmentTransportIcon';
import { COLORS } from '@/components/ui/COLORS';
import { FONT_SIZE, FONT_WEIGHT } from '@/components/ui/TYPOGRAPHY';
import { getShipmentStatusLabel, type ShipmentListItem } from '@/lib/shipmentType';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  shipment: ShipmentListItem;
  selected: boolean;
  desktop?: boolean;
  onPress: () => void;
};

export function ShipmentSwitchCard({ shipment, selected, desktop = false, onPress }: Props) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      style={[
        styles.card,
        desktop && styles.cardDesktop,
        selected && styles.cardActive,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.top}>
        <Text
          style={[
            styles.title,
            selected && styles.titleActive,
          ]}
          numberOfLines={1}
        >
          {shipment.do_number}
        </Text>

        <ShipmentTransportBadge
          shipment={shipment}
          shipmentType={shipment.shipment_type}
          color={selected ? COLORS.primaryText : COLORS.surface}
          size={16}
          containerStyle={[
            styles.badge,
            selected && styles.badgeActive,
          ]}
        />
      </View>

      <Text
        style={[
          styles.route,
          selected && styles.routeActive,
        ]}
        numberOfLines={1}
      >
        {shipment.origin} → {shipment.destination}
      </Text>

      {/* Status pill visible en la card */}
      {shipment.current_status ? (
        <View style={[styles.statusPill, selected && styles.statusPillActive]}>
          <Text style={[styles.statusPillText, selected && styles.statusPillTextActive]} numberOfLines={1}>
            {getShipmentStatusLabel(shipment.current_status, t)}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 176,
    padding: 14,
    borderRadius: 18,
    gap: 8,
    backgroundColor: 'rgba(245, 241, 234, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 241, 234, 0.09)',
  },
  cardDesktop: {
    width: '100%',
  },
  cardActive: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.orangeBorder,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    color: COLORS.surface,
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: 20,
  },
  titleActive: {
    color: COLORS.primaryText,
  },
  route: {
    color: 'rgba(245, 241, 234, 0.7)',
    fontSize: FONT_SIZE.xs,
    lineHeight: 16,
  },
  routeActive: {
    color: COLORS.secondaryText,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 241, 234, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 241, 234, 0.14)',
  },
  badgeActive: {
    backgroundColor: COLORS.orangeSoft,
    borderColor: COLORS.orangeBorder,
  },
  statusPill: {
    alignSelf: 'flex-start',
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 241, 234, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 241, 234, 0.16)',
    maxWidth: '100%',
  },
  statusPillActive: {
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.line,
  },
  statusPillText: {
    color: 'rgba(245, 241, 234, 0.75)',
    fontSize: FONT_SIZE.xs - 1,
    fontWeight: FONT_WEIGHT.medium,
    lineHeight: 14,
  },
  statusPillTextActive: {
    color: COLORS.secondaryText,
  },
});