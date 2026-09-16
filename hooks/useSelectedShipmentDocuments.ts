import { DocumentRecord } from '@/lib/shipmentType';
import { supabase } from '@/lib/URLs';
import { resolveUserDisplayNames, getUserDisplayNameSync } from '@/lib/userCache';
import { isAbortError } from '@/utils/errorHandling';
import { useEffect, useState } from 'react';

export type DashboardUpdate = {
  id: string;
  created_at: string;
  status?: string | null;
  location?: string | null;
  observation?: string | null;
  author_name?: string | null;
};

export const useSelectedShipmentDocuments = ({
  selectedShipmentId,
  userId,
  isInternal,
  companyId,
}: {
  selectedShipmentId: string | null;
  userId: string | null;
  isInternal: boolean;
  companyId?: string | null;
}) => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [updates, setUpdates] = useState<DashboardUpdate[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!selectedShipmentId || !userId) {
      setDocuments([]);
      setUpdates([]);
      return;
    }

    let cancelled = false;

    const loadExtras = async () => {
      try {
        setDetailLoading(true);

        let canViewExtras = isInternal;
        if (!isInternal && userId) {
          // 1. Direct user assignment (profile_shipment)
          const { data: relationData } = await supabase
            .from('profile_shipment')
            .select('client_id')
            .eq('shipment_id', selectedShipmentId)
            .eq('client_id', userId)
            .maybeSingle();

          if (relationData) {
            canViewExtras = true;
          } else if (companyId) {
            // 2. Company assignment (company_shipment) sin consultar profiles de nuevo
            const { data: companyRelation } = await supabase
              .from('company_shipment')
              .select('company_id')
              .eq('shipment_id', selectedShipmentId)
              .eq('company_id', companyId)
              .maybeSingle();

            canViewExtras = Boolean(companyRelation);
          }
        }

        if (!canViewExtras) {
          if (!cancelled) {
            setDocuments([]);
            setUpdates([]);
          }
          return;
        }

        const [documentsRes, updatesRes] = await Promise.all([
          supabase
            .from('documents')
            .select('id, shipment_id, file_name, file_size, file_path, storage_path')
            .eq('shipment_id', selectedShipmentId)
            .eq('is_deleted', false),
          supabase
            .from('shipment_updates')
            .select('id, created_at, status, location, observation, updated_by')
            .eq('shipment_id', selectedShipmentId)
            .order('created_at', { ascending: false })
            .limit(10),
        ]);

        if (documentsRes.error) throw documentsRes.error;

        if (!cancelled) {
          setDocuments((documentsRes.data as DocumentRecord[]) || []);
        }

        const rawUpdates = (updatesRes.data ?? []).filter(
          (u: any) => typeof u.observation === 'string' && u.observation.trim().length > 0,
        );

        if (rawUpdates.length > 0) {
          const authorIds = Array.from(
            new Set(rawUpdates.map((u: any) => u.updated_by).filter(Boolean)),
          );

          if (authorIds.length > 0) {
            await resolveUserDisplayNames(authorIds);
          }

          if (!cancelled) {
            setUpdates(
              rawUpdates.map((u: any) => ({
                id: u.id,
                created_at: u.created_at,
                status: u.status,
                location: u.location,
                observation: u.observation.trim(),
                author_name: u.updated_by ? getUserDisplayNameSync(u.updated_by) : null,
              })),
            );
          }
        } else if (!cancelled) {
          setUpdates([]);
        }
      } catch (error) {
        if (isAbortError(error)) return;
        if (!cancelled) {
          setDocuments([]);
          setUpdates([]);
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    };

    void loadExtras();
    return () => {
      cancelled = true;
    };
  }, [isInternal, selectedShipmentId, userId]);

  return {
    documents,
    updates,
    detailLoading,
  };
};