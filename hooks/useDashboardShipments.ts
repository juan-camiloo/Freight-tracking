import { useCallback, useEffect, useState } from 'react';
import { useAuthUser } from '../contexts/AuthUserContext';
import * as types from '../lib/shipmentType';
import { supabase } from '../lib/URLs';
import { getUserDisplayNameSync, resolveUserDisplayNames } from '../lib/userCache';

export function useDashboardShipments() {
  const { userId, isInternal, profile, nickname: authNickname, loading: authLoading } = useAuthUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [shipments, setShipments] = useState<types.ShipmentListItem[]>([]);
  const [searchResults, setSearchResults] = useState<types.ShipmentListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  const baseVisibleShipments = searchQuery.trim() ? searchResults : shipments;
  const isAbortError = (error: unknown) =>
    error instanceof Error &&
    (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted'));

  async function attachLatestStatusDates(shipmentsList: types.ShipmentListItem[]) {
    const shipmentIds = Array.from(new Set(shipmentsList.map((shipment) => shipment.id).filter(Boolean)));
    if (!shipmentIds.length) return shipmentsList;

    try {
      const { data, error } = await supabase
        .from('shipment_updates')
        .select('shipment_id, created_at')
        .in('shipment_id', shipmentIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const latestStatusByShipment = new Map<string, string>();
      (data ?? []).forEach((update: { shipment_id?: string | null; created_at?: string | null }) => {
        if (update.shipment_id && update.created_at && !latestStatusByShipment.has(update.shipment_id)) {
          latestStatusByShipment.set(update.shipment_id, update.created_at);
        }
      });

      return shipmentsList.map((shipment) => ({
        ...shipment,
        latest_status_at: latestStatusByShipment.get(shipment.id) ?? null,
      }));
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Error cargando fechas de novedades:', error);
      }
      return shipmentsList;
    }
  }

  async function enrichShipmentsWithDatesAndUsers(
    items: types.ShipmentListItem[]
  ): Promise<types.ShipmentListItem[]> {
    if (!items.length) return [];

    const userIds = [
      ...items.map((s) => s.created_by),
      ...items.map((s) => s.updated_by),
    ];

    const [withDates] = await Promise.all([
      attachLatestStatusDates(items),
      resolveUserDisplayNames(userIds),
    ]);

    return withDates.map((s) => ({
      ...s,
      created_by: s.created_by ? getUserDisplayNameSync(s.created_by) : null,
      updated_by: s.updated_by ? getUserDisplayNameSync(s.updated_by) : null,
    }));
  }

  const loadShipments = useCallback(async () => {
    if (authLoading || !userId) return;

    try {
      setLoading(true);
      let loadedShipments: types.ShipmentListItem[] = [];

      if (isInternal) {
        const { data, error } = await supabase
          .from('shipments')
          .select(`
            id, do_number, origin, destination, shipment_type,
            current_status, current_location, incoterm, etd, eta,
            atd, ata, documentary_cutoff, booking_status, inspection_status,
            cargo_type, free_days, carrier, flight_vessel, air_waybill,
            container_number, exporter, consignee, created_at, created_by, 
            updated_by, updated_at
          `)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (error) throw error;
        loadedShipments = (data as types.ShipmentListItem[]) || [];
      } else {
        const companyId = profile?.company_id;
        const queries = [
          supabase.from('profile_shipment').select('shipment_id').eq('client_id', userId),
        ];
        if (companyId) {
          queries.push(
            supabase.from('company_shipment').select('shipment_id').eq('company_id', companyId)
          );
        }

        const [directRes, companyRes] = await Promise.all(queries);
        const directIds = (directRes?.data ?? []).map((r: any) => r.shipment_id).filter(Boolean);
        const companyIds = (companyRes?.data ?? []).map((r: any) => r.shipment_id).filter(Boolean);
        const allAllowedIds = Array.from(new Set([...directIds, ...companyIds]));

        if (allAllowedIds.length > 0) {
          const { data, error } = await supabase
            .from('shipments')
            .select(`
              id, do_number, origin, destination, shipment_type,
              current_status, current_location, incoterm, etd, eta,
              atd, ata, documentary_cutoff, booking_status, inspection_status,
              cargo_type, free_days, carrier, flight_vessel, air_waybill,
              container_number, exporter, consignee, created_at, created_by, 
              updated_by, updated_at
            `)
            .in('id', allAllowedIds)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

          if (error) throw error;
          loadedShipments = (data as types.ShipmentListItem[]) || [];
        }
      }

      const enriched = await enrichShipmentsWithDatesAndUsers(loadedShipments);
      setShipments(enriched);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Error cargando cargas:', error);
    } finally {
      setLoading(false);
    }
  }, [authLoading, userId, isInternal, profile?.company_id]);

  useEffect(() => {
    void loadShipments();
  }, [loadShipments]);

  const searchShipment = async (cleanQuery: string) => {
    try {
      setSearching(true);
      const searchClauses = [
        `do_number.ilike.%${cleanQuery}%`,
        `origin.ilike.%${cleanQuery}%`,
        `destination.ilike.%${cleanQuery}%`,
      ];

      let queryBuilder = supabase
        .from('shipments')
        .select(`
          id, do_number, origin, destination, shipment_type,
          current_status, current_location, incoterm, etd, eta,
          atd, ata, documentary_cutoff, booking_status, inspection_status,
          cargo_type, free_days, carrier, flight_vessel, air_waybill,
          container_number, exporter, consignee, created_at, created_by,
          updated_by, updated_at
        `)
        .eq('status', 'active')
        .or(searchClauses.join(','))
        .order('created_at', { ascending: false })
        .limit(20);

      if (!isInternal && userId) {
        const visibleIds = shipments.map((s) => s.id);
        if (visibleIds.length > 0) {
          queryBuilder = queryBuilder.in('id', visibleIds);
        } else {
          setSearchResults([]);
          return;
        }
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;
      const enriched = await enrichShipmentsWithDatesAndUsers((data as types.ShipmentListItem[]) || []);
      setSearchResults(enriched);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Error buscando cargas:', error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      void searchShipment(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    shipments,
    searchResults,
    baseVisibleShipments,
    loading: authLoading || loading,
    searching,
    userId,
    isInternal,
    nickname: authNickname,
    searchShipment,
    refreshShipments: loadShipments,
  };
}