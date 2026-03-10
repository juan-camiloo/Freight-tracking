//Archivo: \lib\pushNotifications.ts
/*Maneja la lógica de notificaciones push, obtiene push token, pide permisos
identifica si es dispositivo móvil o web para usar Expo Push o FCM respectivamente,
y guarda device_info y last_seen_at*/
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

//Declaración de constantes 
const isDevice = Device.isDevice;
const model = Device.modelName;
const version = Device.osVersion;
const OS = Platform.OS;

// Este tipo mantiene la firma de la tabla `notifications` y evita enviar payloads ambiguos.
type PushPlatform = 'expo' | 'web_fcm';

// Configuramos comportamiento visual basico cuando llega una notificacion en primer plano.
// En mobile esto controla alerta/sonido/badge; en web no tiene efecto.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  }),
});

function getExpoProjectId(): string | undefined {
  // Expo Push requiere `projectId` en builds EAS; usamos varias fuentes para cubrir dev/prod.
  const easProjectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    process.env.EXPO_PUBLIC_EXPO_PROJECT_ID;

  return easProjectId || undefined;
}

async function upsertPushToken(params: {
  userId: string;
  platform: PushPlatform;
  token: string;
  deviceInfo: Record<string, unknown>;
}) {
  // Guardamos o actualizamos por (platform, token) para no duplicar endpoints.
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



async function registerExpoToken(userId: string) {

  const projectId = getExpoProjectId();
  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;
  const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });

  // Push nativo solo funciona en dispositivo fisico (emuladores suelen no tener token valido).
  if (!isDevice) return;

  // Verificamos o pedimos permiso para notificaciones.


  // Pedimos permiso si aun no fue concedido.
  if (finalStatus !== 'granted') {
    const request = await Notifications.requestPermissionsAsync();
    finalStatus = request.status;
  }

  if (finalStatus !== 'granted') return;
  
  if (!projectId) {
    // Sin projectId no hay token Expo en builds modernos.
    console.warn('No hay EXPO projectId para registrar push token.');
    return;
  }

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

async function registerWebFcmToken(userId: string) {
  // En web usamos FCM para push real tipo "WhatsApp Web" (incluye background con service worker).
  const permission = await Notification.requestPermission();
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
    // Evitamos romper la app si faltan variables de entorno.
    console.warn('Faltan variables EXPO_PUBLIC_FIREBASE_* para web push.');
    return;
  }

  // Import dinamico para no cargar Firebase en native.
  const [{ getApp, getApps, initializeApp }, { getMessaging, getToken, isSupported }] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ]);

  const supported = await isSupported();
  if (!supported) return;

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const messaging = getMessaging(app);

  // Pasamos config por query params para no hardcodear secretos en el service worker.
  const swParams = new URLSearchParams({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain ?? '',
    projectId: firebaseConfig.projectId,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
  });
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${swParams.toString()}`);

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
  // Punto unico para registro: delega segun plataforma.
  if (!userId) return;

  try {
    if (OS === 'web') {
      await registerWebFcmToken(userId);
      return;
    }

    await registerExpoToken(userId);
  } catch (error) {
    console.error('No se pudo registrar token push:', error);
  }
}
