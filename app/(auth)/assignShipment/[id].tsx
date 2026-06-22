// Archivo: app/(auth)/assignShipment/[id].tsx
// Mantiene la ruta historica de asignacion con un cliente preseleccionado.

import { useLocalSearchParams } from 'expo-router';
import { ShipmentAssignmentWorkspace } from '../../../components/auth/ShipmentAssignmentWorkspace';

export default function AssignShipmentForProfile() {
  const { id } = useLocalSearchParams();
  const clientId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : null;

  return <ShipmentAssignmentWorkspace initialClientId={clientId} />;
}
