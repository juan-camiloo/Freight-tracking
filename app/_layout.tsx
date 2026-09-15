// Layout raiz de la aplicacion.
// Inicializa i18n antes de montar cualquier pantalla para garantizar
// que todas las traducciones esten disponibles desde el primer render.
import { NotificationPermissionProvider } from '@/components/NotificationPermissionProvider';
import { useWebNotifications } from '@/hooks/useWebNotifications';
import { Slot } from 'expo-router';
import { Platform } from 'react-native';
import { NotificationProvider } from '../components/ui/NativeNotification';
import '../i18n';

// Suprimir barras de desplazamiento nativas en web manteniendo la funcionalidad de scroll
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'hide-default-scrollbars';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      *::-webkit-scrollbar {
        width: 0px !important;
        height: 0px !important;
        display: none !important;
      }
      * {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
    `;
    document.head.appendChild(style);
  }
}

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
