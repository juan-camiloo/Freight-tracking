import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { inferShipmentType, type ShipmentTypeHints, type ShipmentTypeValue } from '../../lib/shipmentType';

type TransportIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const TRANSPORT_ICON_BY_TYPE: Record<ShipmentTypeValue, TransportIconName> = {
  air: 'airplane',
  maritime: 'ferry',
  land: 'truck-outline',
};

type ShipmentTransportHints = ShipmentTypeHints | null;

export const getShipmentTransportIconName = (shipment?: ShipmentTransportHints, shipmentType?: string | null) => {
  const normalizedType = inferShipmentType({ ...(shipment ?? {}), shipmentType });
  return normalizedType ? TRANSPORT_ICON_BY_TYPE[normalizedType] : null;
};

type ShipmentTransportIconProps = {
  shipment?: ShipmentTransportHints;
  shipmentType?: string | null;
  color: string;
  size?: number;
};

export function ShipmentTransportIcon({ shipment, shipmentType, color, size = 18 }: ShipmentTransportIconProps) {
  const iconName = getShipmentTransportIconName(shipment, shipmentType);
  if (!iconName) return null;

  return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
}

type ShipmentTransportBadgeProps = ShipmentTransportIconProps & {
  containerStyle?: StyleProp<ViewStyle>;
};

export function ShipmentTransportBadge({
  shipment,
  shipmentType,
  color,
  size = 18,
  containerStyle,
}: ShipmentTransportBadgeProps) {
  const iconName = getShipmentTransportIconName(shipment, shipmentType);
  if (!iconName) return null;

  return (
    <View style={containerStyle}>
      <MaterialCommunityIcons name={iconName} size={size} color={color} />
    </View>
  );
}
