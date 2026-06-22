// Layout raiz de la aplicacion.
// Inicializa i18n antes de montar cualquier pantalla para garantizar
// que todas las traducciones esten disponibles desde el primer render.
import { NotificationPermissionProvider } from '@/components/NotificationPermissionProvider';
import { useWebNotifications } from '@/hooks/useWebNotifications';
import { Slot } from 'expo-router';
import { NotificationProvider } from '../components/ui/NativeNotification';
import '../i18n';
export default function RootLayout() {
  
  return (
    <NotificationProvider>
      <AppShell />
    </NotificationProvider>
  );
  function AppShell() {
  const { handleEnableWebNotifications } = useWebNotifications();

  return (
    <NotificationPermissionProvider onEnableNotifications={handleEnableWebNotifications}>
      <Slot />
    </NotificationPermissionProvider>
  );
}
}
