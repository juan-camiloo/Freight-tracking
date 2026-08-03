import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import NotificationPermissionBubble from './NotificationPermissionBubble';

const STORAGE_KEY = 'notif_permission_prompt_answered';

type NotificationPermissionContextValue = {
  // Llama esto desde donde sea que detectes que el permiso nativo/web
  // todavía no está concedido, para "armar" el pop-up.
  requestPrompt: () => void;
};

const NotificationPermissionContext = createContext<NotificationPermissionContextValue | null>(null);

type NotificationPermissionProviderProps = {
  children: ReactNode;
  // Tu lógica real de activar notificaciones (permission request, token, etc.)
  onEnableNotifications: () => void | Promise<void>;
};

export function NotificationPermissionProvider({
  children,
  onEnableNotifications,
}: NotificationPermissionProviderProps) {
  const [visible, setVisible] = useState(false);
  const [checkedStorage, setCheckedStorage] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      // Si el usuario ya respondió antes (sí o no), no lo volvemos a molestar.
      setCheckedStorage(true);
      if (value !== 'yes' && value !== 'no') {
        // no ha respondido, se puede mostrar cuando se llame requestPrompt()
      }
    });
  }, []);

  const requestPrompt = useCallback(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value !== 'yes' && value !== 'no') {
        setVisible(true);
      }
    });
  }, []);

  const handleAccept = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'yes');
    setVisible(false);
    await onEnableNotifications();
  }, [onEnableNotifications]);

  const handleDecline = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'no');
    setVisible(false);
  }, []);

  const value = useMemo(() => ({ requestPrompt }), [requestPrompt]);

  if (!checkedStorage) return <>{children}</>;

  return (
    <NotificationPermissionContext.Provider value={value}>
      {children}
      <NotificationPermissionBubble
        visible={visible}
        onAccept={handleAccept}
        onDecline={handleDecline}
      />
    </NotificationPermissionContext.Provider>
  );
}

export function useNotificationPermissionPrompt() {
  const ctx = useContext(NotificationPermissionContext);
  if (!ctx) {
    throw new Error(
      'useNotificationPermissionPrompt debe usarse dentro de <NotificationPermissionProvider>'
    );
  }
  return ctx;
}