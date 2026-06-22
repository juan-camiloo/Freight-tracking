// Archivo: app/(auth)/assignShipment.tsx
// Entrada directa para asignar cargas a clientes sin navegar primero a un perfil.

import { useLocalSearchParams } from 'expo-router';
import { ShipmentAssignmentWorkspace } from '../../components/auth/ShipmentAssignmentWorkspace';

export default function AssignShipment() {
  const { clientId, shipmentId } = useLocalSearchParams();
  const initialClientId = typeof clientId === 'string' ? clientId : Array.isArray(clientId) ? clientId[0] : null;
  const initialShipmentId =
    typeof shipmentId === 'string' ? shipmentId : Array.isArray(shipmentId) ? shipmentId[0] : null;

  return (
    <ShipmentAssignmentWorkspace
      initialClientId={initialClientId}
      initialShipmentId={initialShipmentId}
    />
  );
}
