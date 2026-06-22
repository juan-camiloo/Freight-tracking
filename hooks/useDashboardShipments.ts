import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import * as types from '../lib/shipmentType';
import { supabase } from '../lib/URLs';


export function useDashboardShipments() {
    const [searchQuery, setSearchQuery] = useState('');
    const [shipments, setShipments] = useState<types.ShipmentListItem[]>([]);
    const [searchResults, setSearchResults] = useState<types.ShipmentListItem[]>([]);
    const [searching, setSearching] = useState(false);
    const [loading, setLoading] = useState(true);
    const [nickname, setNickname] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [isInternal, setIsInternal] = useState(false);

    const baseVisibleShipments = searchQuery.trim() ? searchResults : shipments;
    const isAbortError = (error: unknown) =>
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted'));
    async function attachLatestStatusDates(shipments: types.ShipmentListItem[]) {
      const shipmentIds = Array.from(new Set(shipments.map((shipment) => shipment.id).filter(Boolean)));
      if (!shipmentIds.length) return shipments;
    
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
        
        return shipments.map((shipment) => ({
          ...shipment,
          latest_status_at: latestStatusByShipment.get(shipment.id) ?? null,
        }));
      } catch (error) {
        if (!isAbortError(error)) {
          console.error('Error cargando fechas de novedades:', error);
        }
        return shipments;
      }
    }

    async function resolveUserNames(shipments: types.ShipmentListItem[]) {
      const userIds = Array.from(new Set([
        ...shipments.map(s => s.created_by),
        ...shipments.map(s => s.updated_by),
      ].filter((id): id is string => Boolean(id))));

      if (!userIds.length) return shipments;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, nickname, email')
        .in('id', userIds);

      if (error || !data) return shipments;

      const nameMap = new Map<string, string>(
        data.map(p => [p.id, p.nickname ?? p.email ?? p.id])
      );

      return shipments.map(s => ({
        ...s,
        created_by: s.created_by ? (nameMap.get(s.created_by) ?? s.created_by) : null,
        updated_by: s.updated_by ? (nameMap.get(s.updated_by) ?? s.updated_by) : null,
      }));
    }
    
    useEffect(() => {
        void loadUserAndShipments();
    }, []);

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

        const loadUserAndShipments = async () => {
            try {
              const {
                data: { user },
                error: authError,
              } = await supabase.auth.getUser();
        
              if (authError || !user) {
                router.replace('/login');
                return;
              }
        
              setUserId(user.id);
        
              const { data: profile } = await supabase
                .from('profiles')
                .select('is_internal, nickname, email')
                .eq('id', user.id)
                .single();
        
              setIsInternal(profile?.is_internal || false);
              if (profile?.nickname){ 
                setNickname (profile.nickname)
              } else {
                setNickname (profile?.email)
              }
              
              const { data, error } = await supabase
                .from('shipments')
                .select(`
                  id, do_number, origin, destination, shipment_type,
                  current_status, current_location, incoterm, etd, eta,
                  atd, ata, documentary_cutoff, booking_status, inspection_status,
                  cargo_type, free_days, carrier, flight_vessel, air_waybill,
                  container_number, exporter, consignee, created_at, created_by, 
                  updated_by
                `)
                .eq('status', 'active')
                .order('created_at', { ascending: false });
              if (error) throw error;
              const withDates = await attachLatestStatusDates((data as types.ShipmentListItem[]) || []);
              const withNames = await resolveUserNames(withDates);
              setShipments(withNames);            
            } catch (error) {
              if (isAbortError(error)) return;
              console.error('Error cargando cargas:', error);
            } finally {
              setLoading(false);
            }
          };
        
          const searchShipment = async (cleanQuery: string) => {
            try {
              setSearching(true);
              const searchClauses = [
                `do_number.ilike.%${cleanQuery}%`,
                `origin.ilike.%${cleanQuery}%`,
                `destination.ilike.%${cleanQuery}%`,
              ];
        
              const { data, error } = await supabase
                .from('shipments')
                .select(`
                  id, do_number, origin, destination, shipment_type,
                  current_status, current_location, incoterm, etd, eta,
                  atd, ata, documentary_cutoff, booking_status, inspection_status,
                  cargo_type, free_days, carrier, flight_vessel, air_waybill,
                  container_number, exporter, consignee, created_at
                `)
                .eq('status', 'active')
                .or(searchClauses.join(','))
                .order('created_at', { ascending: false })
                .limit(20);
        
              if (error) throw error;
              setSearchResults(await attachLatestStatusDates((data as types.ShipmentListItem[]) || []));
            } catch (error) {
              if (isAbortError(error)) return;
              console.error('Error buscando cargas:', error);
            } finally {
              setSearching(false);
            }
          };
      return {
        searchQuery,
        setSearchQuery,
        shipments,
        searchResults,
        baseVisibleShipments,
        loading,
        searching,
        userId,
        isInternal,
        nickname,
        searchShipment,
    };
    }