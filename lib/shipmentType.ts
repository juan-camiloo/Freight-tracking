export type ShipmentTypeValue = 'air' | 'maritime' | 'land';

type ShipmentTypeOption = {
  labelKey: string;
  value: ShipmentTypeValue;
};

const SHIPMENT_TYPE_ALIASES: Record<string, ShipmentTypeValue> = {
  air: 'air',
  maritime: 'maritime',
  sea: 'maritime',
  land: 'land',
};

export const SHIPMENT_TYPE_OPTIONS: ShipmentTypeOption[] = [
  { labelKey: 'shipmentForm.options.shipmentType.air', value: 'air' },
  { labelKey: 'shipmentForm.options.shipmentType.maritime', value: 'maritime' },
  { labelKey: 'shipmentForm.options.shipmentType.land', value: 'land' },
];

export const normalizeShipmentType = (value?: string | null): ShipmentTypeValue | '' => {
  const normalizedValue = value?.trim().toLowerCase() ?? '';
  return SHIPMENT_TYPE_ALIASES[normalizedValue] ?? '';
};

export const getShipmentTypeLabelKey = (value?: string | null) => {
  const normalizedValue = normalizeShipmentType(value);
  return normalizedValue ? `shipmentForm.options.shipmentType.${normalizedValue}` : null;
};
