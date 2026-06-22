// features/dashboard/components/ShipmentSwitchCard.tsx
import { ShipmentTransportBadge } from '@/components/auth/ShipmentTransportIcon';
import { COLORS } from '@/components/ui/COLORS';
import type { ShipmentListItem } from '@/lib/shipmentType';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  shipment: ShipmentListItem;
  selected: boolean;
  desktop?: boolean;
  onPress: () => void;
};

export function ShipmentSwitchCard({ shipment, selected, desktop = false, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        desktop && styles.cardDesktop,
        selected && styles.cardActive,
      ]}
      onPress={onPress}
    >
      <View style={styles.top}>
        <Text
          style={[
            styles.title,
            desktop && styles.titleDesktop,
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
          size={18}
          containerStyle={[
            styles.badge,
            selected && styles.badgeActive,
          ]}
        />
      </View>

      <Text
        style={[
          styles.route,
          desktop && styles.routeDesktop,
          selected && styles.routeActive,
        ]}
        numberOfLines={2}
      >
        {shipment.origin} → {shipment.destination}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 176,
    padding: 14,
    borderRadius: 18,
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
    marginBottom: 10,
  },
  title: {
    flex: 1,
    color: COLORS.surface,
    fontSize: 15,
    fontWeight: '800',
  },
  titleDesktop: {
    color: COLORS.surface,
  },
  titleActive: {
    color: COLORS.primaryText,
  },
  route: {
    color: 'rgba(245, 241, 234, 0.7)',
    fontSize: 12,
    lineHeight: 18,
  },
  routeDesktop: {
    color: 'rgba(245, 241, 234, 0.7)',
  },
  routeActive: {
    color: COLORS.secondaryText,
  },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
});