import { useTranslation } from 'react-i18next';
export type ShipmentTypeValue = 'air' | 'maritime' | 'land';

export type ShipmentTypeHints = {
  shipment_type?: string | null;
  shipmentType?: string | null;
  origin?: string | null;
  destination?: string | null;
  air_waybill?: string | null;
  airWaybill?: string | null;
  container_number?: string | null;
  containerNumber?: string | null;
  current_status?: string | null;
  currentStatus?: string | null;
};

type ShipmentTypeOption = {
  labelKey: string;
  value: ShipmentTypeValue;
};

export type ShipmentOperationType = 'expo' | 'impo';

type ShipmentStatusOption = {
  labelKey: string;
  value: string;
};

const SHIPMENT_TYPE_ALIASES: Record<string, ShipmentTypeValue> = {
  air: 'air',
  aereo: 'air',
  aerial: 'air',
  maritime: 'maritime',
  maritimo: 'maritime',
  ocean: 'maritime',
  sea: 'maritime',
  shipping: 'maritime',
  ground: 'land',
  land: 'land',
  road: 'land',
  terrestre: 'land',
  truck: 'land',
};

export type ShipmentListItem = {
  id: string;
  do_number: string;
  origin: string;
  destination: string;
  shipment_type?: string | null;
  current_status?: string | null;
  current_location?: string | null;
  incoterm?: string | null;
  etd?: string | null;
  eta?: string | null;
  atd?: string | null;
  ata?: string | null;
  documentary_cutoff?: string | null;
  booking_status?: string | null;
  inspection_status?: string | null;
  cargo_type?: string | null;
  free_days?: number | null;
  carrier?: string | null;
  flight_vessel?: string | null;
  air_waybill?: string | null;
  container_number?: string | null;
  exporter?: string | null;
  consignee?: string | null;
  created_at?: string | null;
  latest_status_at?: string | null;
  created_by?: string | null;
  updated_by?: any;
};

export type DocumentRecord = {
  id: string;
  shipment_id: string;
  file_name: string;
  file_size: number;
  file_path?: string | null;
  storage_path?: string | null;
};

export type StatusGroupFilter = 'all' | 'pending' | 'inTransit' | 'customs' | 'delivered' | 'withoutStatus'| any;
export type MilestoneFilter = 'all' | 'withoutEta' | 'withAtd' | 'withAta' | 'overdueEta';
export type SortField = 'created' | 'do' | 'status' | 'eta' | 'etd' | 'free_days';
export type SortDirection = 'asc' | 'desc';

export type ShipmentFilters = {
  shipmentType: 'all' | ShipmentTypeValue;
  statusGroup: StatusGroupFilter;
  milestone: MilestoneFilter;
  sortField: SortField;
  sortDirection: SortDirection;
  createdFrom: string;
  createdTo: string;
  statusFrom: string;
  statusTo: string;
  etdFrom: string;
  etdTo: string;
  ataFrom: string;
  ataTo: string;
  cutoffFrom: string;
  cutoffTo: string;
  statusText: string;
  origin: string;
  destination: string;
  location: string;
  party: string;
  carrier: string;
  incoterm: string;
  cargoType: string;
  bookingStatus: string;
  inspectionStatus: string;
  freeDaysMin: string;
  freeDaysMax: string;
};
export type ShipmentFiltersPanelProps = {
  filters: ShipmentFilters;
  filtersOpen: boolean;
  activeFilterCount: number;
  totalCount: number;
  visibleCount: number;
  isDesktop: boolean;
  t: ReturnType<typeof useTranslation>['t'];
  onToggleOpen: () => void;
  onChangeFilter: (key: keyof ShipmentFilters, value: string) => void;
  onResetFilters: () => void;
};
export const SHIPMENT_TYPE_OPTIONS: ShipmentTypeOption[] = [
  { labelKey: 'shipmentForm.options.shipmentType.air', value: 'air' },
  { labelKey: 'shipmentForm.options.shipmentType.maritime', value: 'maritime' },
  { labelKey: 'shipmentForm.options.shipmentType.land', value: 'land' },
];

export const INCOTERMS = [
  { label: 'EXW', value: 'EXW' },
  { label: 'FCA', value: 'FCA' },
  { label: 'FAS', value: 'FAS' },
  { label: 'FOB', value: 'FOB' },
  { label: 'CFR', value: 'CFR' },
  { label: 'CIF', value: 'CIF' },
  { label: 'CPT', value: 'CPT' },
  { label: 'CIP', value: 'CIP' },
  { label: 'DAP', value: 'DAP' },
  { label: 'DPU', value: 'DPU' },
  { label: 'DDP', value: 'DDP' },
];

export const STATUS_OPTIONS_BY_OPERATION: Record<ShipmentOperationType, ShipmentStatusOption[]> = {
  expo: [
    { labelKey: 'shipmentForm.options.status.expo.startOperation', value: 'expo_start_operation' },
    { labelKey: 'shipmentForm.options.status.expo.bookingConfirmation', value: 'expo_booking_confirmation' },
    { labelKey: 'shipmentForm.options.status.expo.vehicle', value: 'expo_vehicle' },
    { labelKey: 'shipmentForm.options.status.expo.documentation', value: 'expo_documentation' },
    { labelKey: 'shipmentForm.options.status.expo.departure', value: 'expo_departure' },
    { labelKey: 'shipmentForm.options.status.expo.internationalTransit', value: 'expo_international_transit' },
    { labelKey: 'shipmentForm.options.status.expo.arrivalConfirmation', value: 'expo_arrival_confirmation' },
  ],
  impo: [
    { labelKey: 'shipmentForm.options.status.impo.startOperation', value: 'impo_start_operation' },
    { labelKey: 'shipmentForm.options.status.impo.filling', value: 'impo_filling' },
    { labelKey: 'shipmentForm.options.status.impo.documentation', value: 'impo_documentation' },
    { labelKey: 'shipmentForm.options.status.impo.departure', value: 'impo_departure' },
    { labelKey: 'shipmentForm.options.status.impo.internationalTransit', value: 'impo_international_transit' },
    { labelKey: 'shipmentForm.options.status.impo.customs', value: 'impo_customs' },
    { labelKey: 'shipmentForm.options.status.impo.arrivalConfirmation', value: 'impo_arrival_confirmation' },
    { labelKey: 'shipmentForm.options.status.impo.nationalTransit', value: 'impo_national_transit' },
  ],
};

export const STATUSES = STATUS_OPTIONS_BY_OPERATION.expo;

export const SHIPMENT_STATUS_LABEL_KEYS: Record<string, string> = {
  // Exportación
  expo_start_operation: 'shipmentForm.options.status.expo.startOperation',
  expo_booking_confirmation: 'shipmentForm.options.status.expo.bookingConfirmation',
  expo_vehicle: 'shipmentForm.options.status.expo.vehicle',
  expo_documentation: 'shipmentForm.options.status.expo.documentation',
  expo_departure: 'shipmentForm.options.status.expo.departure',
  expo_international_transit: 'shipmentForm.options.status.expo.internationalTransit',
  expo_arrival_confirmation: 'shipmentForm.options.status.expo.arrivalConfirmation',
  // Importación
  impo_start_operation: 'shipmentForm.options.status.impo.startOperation',
  impo_filling: 'shipmentForm.options.status.impo.filling',
  impo_documentation: 'shipmentForm.options.status.impo.documentation',
  impo_departure: 'shipmentForm.options.status.impo.departure',
  impo_international_transit: 'shipmentForm.options.status.impo.internationalTransit',
  impo_customs: 'shipmentForm.options.status.impo.customs',
  impo_arrival_confirmation: 'shipmentForm.options.status.impo.arrivalConfirmation',
  impo_national_transit: 'shipmentForm.options.status.impo.nationalTransit',
  // Compatibilidad con estados legacy si existieran en registros anteriores
  on_way: 'shipmentForm.options.status.onWay',
  waiting_inspection: 'shipmentForm.options.status.waitingInspection',
  arrived: 'shipmentForm.options.status.arrived',
};

export function getShipmentStatusLabel(
  status: string | null | undefined,
  t: (key: string, options?: any) => string
): string {
  if (!status) return t('dashboard.pendingLabel');
  const key = SHIPMENT_STATUS_LABEL_KEYS[status];
  return key ? t(key) : status;
}

export const inferShipmentOperationType = (doNumber?: string | null): ShipmentOperationType | null => {
  const normalizedDo = doNumber?.trim().toUpperCase();
  if (normalizedDo?.startsWith('X')) return 'expo';
  if (normalizedDo?.startsWith('M')) return 'impo';
  return null;
};

export const getShipmentStatusOptions = (doNumber?: string | null): ShipmentStatusOption[] => {
  const operationType = inferShipmentOperationType(doNumber);
  return operationType ? STATUS_OPTIONS_BY_OPERATION[operationType] : STATUSES;
};

export const getShipmentOperationLabelKey = (doNumber?: string | null) => {
  const operationType = inferShipmentOperationType(doNumber);
  return operationType ? `shipmentForm.options.operationType.${operationType}` : null;
};

export const CARGO_TYPES = [
  { labelKey: 'shipmentForm.options.cargoType.general', value: 'general' },
  { labelKey: 'shipmentForm.options.cargoType.dangerous', value: 'dangerous' },
  { labelKey: 'shipmentForm.options.cargoType.perishable', value: 'perishable' },
  { labelKey: 'shipmentForm.options.cargoType.refrigerated', value: 'refrigerated' },
  { labelKey: 'shipmentForm.options.cargoType.chemicals', value: 'chemicals' },
  { labelKey: 'shipmentForm.options.cargoType.dry_bulk', value: 'dry_bulk' },
  { labelKey: 'shipmentForm.options.cargoType.liquid_bulk', value: 'liquid_bulk' },
  { labelKey: 'shipmentForm.options.cargoType.project_cargo', value: 'project_cargo' },
  { labelKey: 'shipmentForm.options.cargoType.valuable', value: 'valuable' },
  { labelKey: 'shipmentForm.options.cargoType.pharma', value: 'pharma' },
  { labelKey: 'shipmentForm.options.cargoType.roro', value: 'roro' },
  { labelKey: 'shipmentForm.options.cargoType.live_animals', value: 'live_animals' },
];

export const BOOKING_STATUSES = [
  { labelKey: 'shipmentForm.options.bookingStatus.pending', value: 'pending' },
  { labelKey: 'shipmentForm.options.bookingStatus.confirmed', value: 'confirmed' },
  { labelKey: 'shipmentForm.options.bookingStatus.rejected', value: 'rejected' },
  { labelKey: 'shipmentForm.options.bookingStatus.waiting_carrier', value: 'waiting_carrier' },
];

export const INSPECTION_STATUSES = [
  { labelKey: 'shipmentForm.options.inspectionStatus.none', value: 'none' },
  { labelKey: 'shipmentForm.options.inspectionStatus.documentary', value: 'documentary' },
  { labelKey: 'shipmentForm.options.inspectionStatus.physical', value: 'physical' },
  { labelKey: 'shipmentForm.options.inspectionStatus.released', value: 'released' },
  { labelKey: 'shipmentForm.options.inspectionStatus.automatic', value: 'automatic' },
];

export const normalizeShipmentType = (value?: string | null): ShipmentTypeValue | '' => {
  const normalizedValue = value?.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') ?? '';
  return SHIPMENT_TYPE_ALIASES[normalizedValue] ?? '';
};

const hasValue = (value?: string | null) => Boolean(value?.trim());

const looksLikeIataCode = (value?: string | null) => /^[A-Z]{3}$/.test(value?.trim().toUpperCase() ?? '');

export const inferShipmentType = (hints: ShipmentTypeHints = {}): ShipmentTypeValue | '' => {
  const explicitType = normalizeShipmentType(hints.shipment_type ?? hints.shipmentType);
  if (explicitType) return explicitType;

  const statusType = normalizeShipmentType(hints.current_status ?? hints.currentStatus);
  if (statusType) return statusType;

  if (hasValue(hints.air_waybill ?? hints.airWaybill)) return 'air';
  if (looksLikeIataCode(hints.origin) && looksLikeIataCode(hints.destination)) return 'air';
  if (hasValue(hints.container_number ?? hints.containerNumber)) return 'maritime';

  return '';
};

export const getShipmentTypeLabelKey = (value?: string | null) => {
  const normalizedValue = normalizeShipmentType(value);
  return normalizedValue ? `shipmentForm.options.shipmentType.${normalizedValue}` : null;
};

// Subtipos de carga por modalidad de transporte
export type CargoSubtype =
  | 'fcl' | 'lcl' | 'bulk' | 'roro_maritime' | 'tanker'  // marítimos
  | 'general_air' | 'express' | 'charter'                  // aéreos
  | 'ftl' | 'ltl' | 'multimodal';                         // terrestres

export const CARGO_SUBTYPES_BY_TRANSPORT: Record<'air' | 'maritime' | 'land', { labelKey: string; value: string }[]> = {
  maritime: [
    { labelKey: 'shipmentForm.options.cargoSubtype.fcl', value: 'fcl' },
    { labelKey: 'shipmentForm.options.cargoSubtype.lcl', value: 'lcl' },
    { labelKey: 'shipmentForm.options.cargoSubtype.bulk', value: 'bulk' },
    { labelKey: 'shipmentForm.options.cargoSubtype.roro_maritime', value: 'roro_maritime' },
    { labelKey: 'shipmentForm.options.cargoSubtype.tanker', value: 'tanker' },
  ],
  air: [
    { labelKey: 'shipmentForm.options.cargoSubtype.general_air', value: 'general_air' },
    { labelKey: 'shipmentForm.options.cargoSubtype.express', value: 'express' },
    { labelKey: 'shipmentForm.options.cargoSubtype.charter', value: 'charter' },
  ],
  land: [
    { labelKey: 'shipmentForm.options.cargoSubtype.ftl', value: 'ftl' },
    { labelKey: 'shipmentForm.options.cargoSubtype.ltl', value: 'ltl' },
    { labelKey: 'shipmentForm.options.cargoSubtype.multimodal', value: 'multimodal' },
  ],
};
