import { ShipmentListItem } from '@/lib/shipmentType';
import { useEffect, useMemo, useState } from 'react';

export function useSelectedShipments(visibleShipments: ShipmentListItem[]) {
    const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
    const selectShipment = (shipmentId: string) => {
        setSelectedShipmentId(shipmentId);
    };
    useEffect(() => {
        if (!visibleShipments.length) {
          setSelectedShipmentId(null);
          return;
        }
    
        const selectedStillVisible = visibleShipments.some((item) => item.id === selectedShipmentId);
            if (!selectedShipmentId || !selectedStillVisible) {
                setSelectedShipmentId(visibleShipments[0].id);
            }
    }, [selectedShipmentId, visibleShipments]);

    const selectedShipment = useMemo(
        () => visibleShipments.find((item) => item.id === selectedShipmentId) ?? visibleShipments[0] ?? null,
        [selectedShipmentId, visibleShipments],
    );
    return{
        selectedShipmentId,
        selectedShipment,
        selectShipment  
    };
} 