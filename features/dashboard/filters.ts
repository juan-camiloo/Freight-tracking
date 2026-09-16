import type { TFunction } from 'i18next';

import {
  getShipmentTypeLabelKey,
  inferShipmentType,
  type MilestoneFilter,
  type ShipmentFilters,
  type ShipmentListItem,
  type ShipmentTypeValue,
  type SortDirection,
  type SortField,
  type StatusGroupFilter,
} from '@/lib/shipmentType';

export const DEFAULT_FILTERS: ShipmentFilters = {
  shipmentType: 'all',
  statusGroup: 'all',
  milestone: 'all',
  sortField: 'created',
  sortDirection: 'desc',
  createdFrom: '',
  createdTo: '',
  statusFrom: '',
  statusTo: '',
  etdFrom: '',
  etdTo: '',
  ataFrom: '',
  ataTo: '',
  cutoffFrom: '',
  cutoffTo: '',
  statusText: '',
  origin: '',
  destination: '',
  party: '',
  carrier: '',
  incoterm: '',
  cargoType: '',
  bookingStatus: '',
  inspectionStatus: '',
  freeDaysMin: '',
  freeDaysMax: '',
};
  

export function applyShipmentFilters(shipments: ShipmentListItem[], filters: ShipmentFilters) {
  return shipments
    .filter((shipment) => shipmentMatchesFilters(shipment, filters))
    .sort((a, b) => compareShipments(a, b, filters.sortField, filters.sortDirection));
}

export function shipmentMatchesFilters(shipment: ShipmentListItem, filters: ShipmentFilters) {
  if (filters.shipmentType !== 'all' && inferShipmentType(shipment) !== filters.shipmentType) {
    return false;
  }

  if (!matchesStatusGroup(shipment.current_status, filters.statusGroup)) return false;
  if (!matchesMilestone(shipment, filters.milestone)) return false;

  if (!isWithinDateRange(shipment.created_at, filters.createdFrom, filters.createdTo)) return false;
  if (!isWithinDateRange(shipment.latest_status_at, filters.statusFrom, filters.statusTo)) return false;
  if (!isWithinDateRange(shipment.etd, filters.etdFrom, filters.etdTo)) return false;
  if (!isWithinDateRange(shipment.ata, filters.ataFrom, filters.ataTo)) return false;
  if (!isWithinDateRange(shipment.documentary_cutoff, filters.cutoffFrom, filters.cutoffTo)) return false;

  if (!containsText(shipment.current_status, filters.statusText)) return false;
  if (!containsText(shipment.origin, filters.origin)) return false;
  if (!containsText(shipment.destination, filters.destination)) return false;
  if (!containsAnyText([shipment.exporter, shipment.consignee], filters.party)) return false;
  if (!containsAnyText([shipment.carrier, shipment.flight_vessel, shipment.air_waybill, shipment.container_number], filters.carrier)) {
    return false;
  }
  if (!containsText(shipment.incoterm, filters.incoterm)) return false;
  if (!containsText(shipment.cargo_type, filters.cargoType)) return false;
  if (!containsText(shipment.booking_status, filters.bookingStatus)) return false;
  if (!containsText(shipment.inspection_status, filters.inspectionStatus)) return false;

  const freeDays = shipment.free_days ?? null;
  const freeDaysMin = parseOptionalNumber(filters.freeDaysMin);
  const freeDaysMax = parseOptionalNumber(filters.freeDaysMax);
  if (freeDaysMin !== null && (freeDays === null || freeDays < freeDaysMin)) return false;
  if (freeDaysMax !== null && (freeDays === null || freeDays > freeDaysMax)) return false;

  return true;
}

export function compareShipments(
  a: ShipmentListItem,
  b: ShipmentListItem,
  sortField: SortField,
  sortDirection: SortDirection,
) {
  const ascending = sortDirection === 'asc';

  switch (sortField) {
    case 'created':
      return compareDates(a.created_at, b.created_at, ascending) || compareDoNumbers(a, b, ascending);
    case 'do':
      return compareDoNumbers(a, b, ascending) || compareDates(a.created_at, b.created_at, false);
    case 'status':
      return compareDates(a.latest_status_at, b.latest_status_at, ascending) || compareDates(a.created_at, b.created_at, false);
    case 'eta':
      return compareDates(a.eta, b.eta, ascending) || compareDates(a.created_at, b.created_at, false);
    case 'etd':
      return compareDates(a.etd, b.etd, ascending) || compareDates(a.created_at, b.created_at, false);
    case 'free_days':
      return compareNumbers(a.free_days, b.free_days, ascending) || compareDates(a.created_at, b.created_at, false);
    default:
      return compareDates(a.created_at, b.created_at, false);
  }
}

export function matchesStatusGroup(status: string | null | undefined, filter: StatusGroupFilter) {
  if (filter === 'all') return true;
  const normalizedStatus = normalizeSearchText(status);
  if (filter === 'withoutStatus') return !normalizedStatus;
  if (filter === 'pending') {
    return [
      'pending', 'pendiente', 'waiting', 'program', 'reserva', 'book',
      'start_operation', 'booking_confirmation', 'vehicle', 'documentation', 'filling'
    ].some((term) => normalizedStatus.includes(term));
  }
  if (filter === 'inTransit') {
    return [
      'transit', 'transito', 'on way', 'on_way', 'salida', 'puerto', 'depart', 'ruta',
      'international_transit', 'national_transit', 'departure'
    ].some((term) => normalizedStatus.includes(term));
  }
  if (filter === 'customs') {
    return ['aduana', 'custom', 'inspeccion', 'inspection', 'customs'].some((term) =>
      normalizedStatus.includes(term)
    );
  }
  if (filter === 'delivered') {
    return [
      'entreg', 'deliver', 'cliente', 'arrived', 'arribo', 'arrival_confirmation'
    ].some((term) => normalizedStatus.includes(term));
  }
  return true;
}

export function matchesMilestone(shipment: ShipmentListItem, filter: MilestoneFilter) {
  if (filter === 'all') return true;
  if (filter === 'withoutEta') return !shipment.eta;
  if (filter === 'withAtd') return Boolean(shipment.atd);
  if (filter === 'withAta') return Boolean(shipment.ata);
  if (filter === 'overdueEta') {
    const etaTime = getDateTime(shipment.eta);
    return etaTime !== null && etaTime < Date.now() && !shipment.ata;
  }
  return true;
}

export function getActiveFilterCount(filters: ShipmentFilters) {
  return Object.entries(filters).reduce((count, [key, value]) => {
    if (key === 'sortField' || key === 'sortDirection') return count;
    const defaultValue = DEFAULT_FILTERS[key as keyof ShipmentFilters];
    return value !== defaultValue ? count + 1 : count;
  }, 0);
}

export function getActiveFilterSummary(filters: ShipmentFilters, t: TFunction) {
  const summary: string[] = [];
  const pushDateRange = (label: string, from: string, to: string) => {
    if (from.trim() && to.trim()) {
      summary.push(`${label}: ${from.trim()} - ${to.trim()}`);
    } else if (from.trim()) {
      summary.push(`${label}: ${t('dashboard.filters.from')} ${from.trim()}`);
    } else if (to.trim()) {
      summary.push(`${label}: ${t('dashboard.filters.to')} ${to.trim()}`);
    }
  };
  const pushTextFilter = (label: string, value: string) => {
    const trimmedValue = value.trim();
    if (trimmedValue) summary.push(`${label}: ${trimmedValue}`);
  };

  if (filters.shipmentType !== 'all') summary.push(getShipmentTypeFilterLabel(filters.shipmentType, t));
  if (filters.statusGroup !== 'all') summary.push(getStatusGroupFilterLabel(filters.statusGroup, t));
  if (filters.milestone !== 'all') summary.push(getMilestoneFilterLabel(filters.milestone, t));

  pushDateRange(t('dashboard.filters.created'), filters.createdFrom, filters.createdTo);
  pushDateRange(t('dashboard.filters.status'), filters.statusFrom, filters.statusTo);
  pushDateRange('ETD', filters.etdFrom, filters.etdTo);
  pushDateRange('ATA', filters.ataFrom, filters.ataTo);
  pushDateRange('Cutoff', filters.cutoffFrom, filters.cutoffTo);

  pushTextFilter(t('dashboard.filters.statusExact'), filters.statusText);
  pushTextFilter(t('dashboard.filters.origin'), filters.origin);
  pushTextFilter(t('dashboard.filters.destination'), filters.destination);
  pushTextFilter(t('dashboard.filters.party'), filters.party);
  pushTextFilter(t('dashboard.filters.carrier'), filters.carrier);
  pushTextFilter(t('dashboard.filters.incoterm'), filters.incoterm);
  pushTextFilter(t('dashboard.filters.cargoType'), filters.cargoType);
  pushTextFilter(t('dashboard.filters.booking'), filters.bookingStatus);
  pushTextFilter(t('dashboard.filters.inspection'), filters.inspectionStatus);

  if (filters.freeDaysMin.trim() || filters.freeDaysMax.trim()) {
    const min = filters.freeDaysMin.trim();
    const max = filters.freeDaysMax.trim();
    const freeDaysLabel = t('dashboard.filters.freeDays');
    if (min && max) {
      summary.push(`${freeDaysLabel}: ${min} - ${max}`);
    } else if (min) {
      summary.push(`${freeDaysLabel}: ${t('dashboard.filters.min')} ${min}`);
    } else {
      summary.push(`${freeDaysLabel}: ${t('dashboard.filters.max')} ${max}`);
    }
  }

  return summary;
}

export function getShipmentTypeFilterLabel(value: ShipmentTypeValue, t: TFunction) {
  const labelKey = getShipmentTypeLabelKey(value);
  return labelKey ? t(labelKey) : value;
}

export function getStatusGroupFilterLabel(value: Exclude<StatusGroupFilter, 'all'>, t: TFunction) {
  const labels: Record<Exclude<StatusGroupFilter, 'all'>, string> = {
    pending: t('dashboard.filters.pending'),
    inTransit: t('dashboard.filters.inTransit'),
    customs: t('dashboard.filters.customs'),
    delivered: t('dashboard.filters.delivered'),
    withoutStatus: t('dashboard.filters.withoutStatus'),
  };
  return labels[value];
}

export function getMilestoneFilterLabel(value: Exclude<MilestoneFilter, 'all'>, t: TFunction) {
  const labels: Record<Exclude<MilestoneFilter, 'all'>, string> = {
    withoutEta: t('dashboard.filters.withoutEta'),
    withAtd: t('dashboard.filters.withAtd' ),
    withAta: t('dashboard.filters.withAta' ),
    overdueEta: t('dashboard.filters.overdueEta' ),
  };
  return labels[value];
}

export function normalizeSearchText(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function containsText(value: string | null | undefined, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return normalizeSearchText(value).includes(normalizedQuery);
}

export function containsAnyText(values: (string | null | undefined)[], query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return values.some((value) => normalizeSearchText(value).includes(normalizedQuery));
}

export function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function getDateTime(value: string | null | undefined) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

export function getBoundaryDateTime(value: string, endOfDay = false) {
  if (!value.trim()) return null;
  const normalizedValue = value.trim();
  const time = Date.parse(
    /^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)
      ? `${normalizedValue}T${endOfDay ? '23:59:59' : '00:00:00'}`
      : normalizedValue,
  );
  return Number.isNaN(time) ? null : time;
}

export function isWithinDateRange(value: string | null | undefined, from: string, to: string) {
  const fromTime = getBoundaryDateTime(from);
  const toTime = getBoundaryDateTime(to, true);
  if (fromTime === null && toTime === null) return true;

  const valueTime = getDateTime(value);
  if (valueTime === null) return false;
  if (fromTime !== null && valueTime < fromTime) return false;
  if (toTime !== null && valueTime > toTime) return false;
  return true;
}

export function compareDates(a: string | null | undefined, b: string | null | undefined, ascending: boolean) {
  const aTime = getDateTime(a);
  const bTime = getDateTime(b);
  if (aTime === null && bTime === null) return 0;
  if (aTime === null) return 1;
  if (bTime === null) return -1;
  return ascending ? aTime - bTime : bTime - aTime;
}

export function compareNumbers(a: number | null | undefined, b: number | null | undefined, ascending: boolean) {
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return ascending ? a - b : b - a;
}

export function compareDoNumbers(a: ShipmentListItem, b: ShipmentListItem, ascending: boolean) {
  const aNumber = getDoNumber(a.do_number);
  const bNumber = getDoNumber(b.do_number);
  if (aNumber === bNumber) return a.do_number.localeCompare(b.do_number);
  return ascending ? aNumber - bNumber : bNumber - aNumber;
}

export function getDoNumber(value: string | null | undefined) {
  const numericValue = (value ?? '').replace(/\D/g, '');
  return numericValue ? Number(numericValue) : 0;
}
