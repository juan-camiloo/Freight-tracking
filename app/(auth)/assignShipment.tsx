// Archivo: app/(auth)/assignShipment.tsx
// Entrada directa para asignar cargas a empresas o clientes.

import { useLocalSearchParams } from 'expo-router';
import { ShipmentAssignmentWorkspace } from '../../components/auth/ShipmentAssignmentWorkspace';

export default function AssignShipment() {
  const { clientId, shipmentId, companyId } = useLocalSearchParams();
  const initialClientId = typeof clientId === 'string' ? clientId : Array.isArray(clientId) ? clientId[0] : null;
  const initialShipmentId =
    typeof shipmentId === 'string' ? shipmentId : Array.isArray(shipmentId) ? shipmentId[0] : null;
  const initialCompanyId =
    typeof companyId === 'string' ? companyId : Array.isArray(companyId) ? companyId[0] : null;

  return (
    <ShipmentAssignmentWorkspace
      initialClientId={initialClientId}
      initialShipmentId={initialShipmentId}
      initialCompanyId={initialCompanyId}
    />
  );
}
