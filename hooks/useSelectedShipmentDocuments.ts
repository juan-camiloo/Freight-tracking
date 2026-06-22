import { DocumentRecord } from '@/lib/shipmentType';
import { supabase } from '@/lib/URLs';
import { isAbortError } from '@/utils/errorHandling';
import { useEffect, useState } from 'react';

export const useSelectedShipmentDocuments = ({
    selectedShipmentId,
    userId, 
    isInternal,
}:{
    selectedShipmentId: string | null;
    userId: string | null;
    isInternal: boolean;
    }
) => {
    const [documents, setDocuments] = useState<DocumentRecord[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);
    
    useEffect(() => {
        if (!selectedShipmentId || !userId) {
            setDocuments([]);
            return;
        }

        let cancelled = false;

        const loadExtras = async () => {
            try {
                setDetailLoading(true);

                let canViewExtras = isInternal;
                if (!isInternal && userId) {
                    const { data: relationData } = await supabase
                        .from('profile_shipment')
                        .select('client_id')
                        .eq('shipment_id', selectedShipmentId)
                        .eq('client_id', userId)
                        .maybeSingle();

                    canViewExtras = Boolean(relationData);
                }

                if (!canViewExtras) {
                    if (!cancelled) {
                        setDocuments([]);
                    }                
                    return;
                }

                const { data: documentsData, error: documentsError } = await supabase
                    .from('documents')
                    .select('id, shipment_id, file_name, file_size, file_path, storage_path')
                    .eq('shipment_id', selectedShipmentId);

                if (documentsError) throw documentsError;

                if (!cancelled) {
                    setDocuments((documentsData as DocumentRecord[]) || []);
                }
            } catch (error) {
                if (isAbortError(error)) return;
            if (!cancelled) {
                setDocuments([]);
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
        detailLoading,
    }
}