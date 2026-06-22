import { useCallback, useDeferredValue, useMemo, useState, useTransition } from 'react';

import {
  DEFAULT_FILTERS,
  applyShipmentFilters,
  getActiveFilterCount,
} from '@/features/dashboard/filters';
import type { ShipmentFilters, ShipmentListItem } from '@/lib/shipmentType';

export function useShipmentFilters(baseVisibleShipments: ShipmentListItem[]) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<ShipmentFilters>(DEFAULT_FILTERS);
  const deferredFilters = useDeferredValue(filters);
  const [, startDashboardTransition] = useTransition();
  const visibleShipments = useMemo(
    () => applyShipmentFilters(baseVisibleShipments, deferredFilters),
    [baseVisibleShipments, deferredFilters],
  );

  const activeFilterCount = useMemo(
    () => getActiveFilterCount(filters),
    [filters],
  );

  const updateFilter = useCallback((key: keyof ShipmentFilters, value: string) => {
    startDashboardTransition(() => {
      setFilters((previousFilters) => ({
        ...previousFilters,
        [key]: value,
      }) as ShipmentFilters);
    });
  }, [startDashboardTransition]);

  const resetFilters = useCallback(() => {
    startDashboardTransition(() => {
      setFilters(DEFAULT_FILTERS);
    });
  }, [startDashboardTransition]);

  const toggleFiltersOpen = useCallback(() => {
    setFiltersOpen((open) => !open);
  }, []);

  return {
    filters,
    filtersOpen,
    setFiltersOpen,
    visibleShipments,
    activeFilterCount,
    updateFilter,
    resetFilters,
    toggleFiltersOpen,
  };
}
