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

    const isUuid = (val: string | null | undefined): boolean => {
      if (!val) return false;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
    };

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

      const nameMap = new Map<string, string>();
      if (!error && data) {
        for (const p of data) {
          const resolved = p.nickname?.trim() || p.email?.split('@')[0]?.trim();
          if (resolved && !isUuid(resolved)) {
            nameMap.set(p.id, resolved);
          }
        }
      }

      const formatAuthor = (raw: string | null | undefined): string | null => {
        if (!raw) return null;
        const resolved = nameMap.get(raw);
        if (resolved) return resolved;
        if (isUuid(raw)) return 'Equipo Ingelox';
        return raw;
      };

      return shipments.map(s => ({
        ...s,
        created_by: formatAuthor(s.created_by),
        updated_by: formatAuthor(s.updated_by),
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
                .select('is_internal, nickname, email, company_id, status')
                .eq('id', user.id)
                .single();
        
              if (profile?.status === 'inactive') {
                await supabase.auth.signOut();
                router.replace({ pathname: '/login', params: { reason: 'account_inactive' } } as any);
                return;
              }

              let companyIsActive = true;
              if (profile?.company_id) {
                const { data: comp } = await supabase
                  .from('companies')
                  .select('status')
                  .eq('id', profile.company_id)
                  .single();
                if (comp?.status === 'inactive') {
                  companyIsActive = false;
                  await supabase.auth.signOut();
                  router.replace({ pathname: '/login', params: { reason: 'company_inactive' } } as any);
                  return;
                }
              }

              const userIsInternal = Boolean(profile?.is_internal);
              setIsInternal(userIsInternal);
              if (profile?.nickname){ 
                setNickname(profile.nickname);
              } else {
                setNickname(profile?.email ?? null);
              }

              let loadedShipments: types.ShipmentListItem[] = [];

              if (userIsInternal) {
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
                // Usuarios externos: cargar cargas asignadas directamente y cargas de la empresa activa
                const { data: directAssign } = await supabase
                  .from('profile_shipment')
                  .select('shipment_id')
                  .eq('client_id', user.id);

                let companyShipmentIds: string[] = [];
                if (profile?.company_id && companyIsActive) {
                  const { data: companyAssign } = await supabase
                    .from('company_shipment')
                    .select('shipment_id')
                    .eq('company_id', profile.company_id);
                  companyShipmentIds = (companyAssign ?? []).map((r: any) => r.shipment_id).filter(Boolean);
                }

                const directIds = (directAssign ?? []).map((r: any) => r.shipment_id).filter(Boolean);
                const allAllowedIds = Array.from(new Set([...directIds, ...companyShipmentIds]));

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

              const withDates = await attachLatestStatusDates(loadedShipments);
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
                // Restringir búsqueda a las cargas visibles del usuario externo
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
              const withDates = await attachLatestStatusDates((data as types.ShipmentListItem[]) || []);
              const withNames = await resolveUserNames(withDates);
              setSearchResults(withNames);
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