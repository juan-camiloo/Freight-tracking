// Modulo: pushNotifications
// Objetivo:
// - Registrar el dispositivo/navegador actual para recibir push.
// - Soportar dos canales: Expo Push (mobile) y FCM (web).
// - Guardar/actualizar token en tabla `notifications` de Supabase.

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Datos del dispositivo actuales.
const isDevice = Device.isDevice;
const model = Device.modelName;
const version = Device.osVersion;
const OS = Platform.OS;

// Firma alineada con la columna `platform` en tabla notifications.
type PushPlatform = 'expo' | 'web_fcm';

// Comportamiento visual cuando llega notificacion en primer plano.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Configura el canal de notificaciones en Android (necesario para "burbuja"/heads-up).
async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
    enableVibrate: true,
    enableLights: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
  });
}

// Obtiene el projectId requerido por Expo Push.
function getExpoProjectId(): string | undefined {
  // Expo Push requiere projectId (EAS); probamos multiples fuentes.
  const easProjectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    process.env.EXPO_PUBLIC_EXPO_PROJECT_ID;

  return easProjectId || undefined;
}

// Inserta o actualiza el token de push en la tabla notifications.
async function upsertPushToken(params: {
  userId: string;
  platform: PushPlatform;
  token: string;
  deviceInfo: Record<string, unknown>;
}) {
  // onConflict evita duplicados por token/plataforma.
  const { error } = await supabase
    .from('notifications')
    .upsert(
      {
        user_id: params.userId,
        platform: params.platform,
        token: params.token,
        device_info: params.deviceInfo,
        last_seen_at: new Date().toISOString(),
        active: true,
      },
      { onConflict: 'platform,token' },
    );

  if (error) {
    throw error;
  }
}

// Registro de token Expo Push (mobile).
async function registerExpoToken(userId: string) {
  // Flujo mobile: permisos -> token Expo -> persistencia en DB.
  // Push nativo requiere dispositivo fisico.
  if (!isDevice) return;

  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;

  if (finalStatus !== 'granted') {
    const request = await Notifications.requestPermissionsAsync();
    finalStatus = request.status;
  }

  if (finalStatus !== 'granted') return;

  const projectId = getExpoProjectId();
  if (!projectId) {
    console.warn('No hay EXPO projectId para registrar push token.');
    return;
  }

  const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });

  await upsertPushToken({
    userId,
    platform: 'expo',
    token: tokenResult.data,
    deviceInfo: {
      app_version: Constants.expoConfig?.version ?? null,
      platform_os: OS,
      os_version: version ?? null,
      device_model: model ?? null,
      is_physical_device: isDevice,
      project_id: projectId,
      notifications_permission: finalStatus,
    },
  });
}

// Registro de token FCM (web).
async function registerWebFcmToken(userId: string) {
  // Flujo web: permiso browser -> service worker -> token FCM -> persistencia en DB.
  const permission = await Notification.requestPermission();
  // Config necesaria para inicializar Firebase en web.
  const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };
  const vapidKey = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;

  if (permission !== 'granted') return;

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.messagingSenderId || !firebaseConfig.appId || !vapidKey) {
    console.warn('Faltan variables EXPO_PUBLIC_FIREBASE_* para web push.');
    return;
  }

  // Import dinamico para evitar dependencias de Firebase en runtime native.
  const [{ getApp, getApps, initializeApp }, { getMessaging, getToken, isSupported }] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ]);

  const supported = await isSupported();
  if (!supported) return;

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const messaging = getMessaging(app);

  // Pasamos config por query params al SW para evitar hardcodeo.
  const swParams = new URLSearchParams({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain ?? '',
    projectId: firebaseConfig.projectId,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
  });
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${swParams.toString()}`);

  // Solicita el token FCM al navegador.
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (!token) return;

  await upsertPushToken({
    userId,
    platform: 'web_fcm',
    token,
    deviceInfo: {
      app_version: Constants.expoConfig?.version ?? null,
      platform_os: 'web',
      browser_user_agent: navigator.userAgent,
      notifications_permission: permission,
      service_worker_scope: registration.scope,
    },
  });
}

export async function registerCurrentDevicePushToken(userId: string) {
  // Punto unico invocado por la app tras login/refresh de sesion.
  if (!userId) return;

  try {
    if (OS === 'web') {
      await registerWebFcmToken(userId);
      return;
    }

    await ensureAndroidNotificationChannel();
    await registerExpoToken(userId);
  } catch (error) {
    console.error('No se pudo registrar token push:', error);
  }
}
