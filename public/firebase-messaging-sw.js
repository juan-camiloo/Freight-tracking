/* eslint-disable no-undef */
// Service Worker para push web con Firebase Cloud Messaging (FCM).
// Responsabilidades:
// 1) Inicializar Firebase en contexto worker.
// 2) Mostrar notificaciones cuando el navegador esta en background.
// 3) Abrir una ruta al hacer click sobre la notificacion.
// La configuracion llega por query params para no hardcodear valores.

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

// Los query params permiten reutilizar el mismo worker en distintos entornos
// sin necesidad de rebuilds; el cliente los inyecta al registrar el SW.
const params = new URL(self.location.href).searchParams;

const firebaseConfig = {
  apiKey: params.get('apiKey') || '',
  authDomain: params.get('authDomain') || '',
  projectId: params.get('projectId') || '',
  messagingSenderId: params.get('messagingSenderId') || '',
  appId: params.get('appId') || '',
};

// Inicializar Firebase solo si los campos minimos estan presentes para
// evitar errores de runtime cuando el SW se carga sin parametros.
if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    // Este handler solo se ejecuta cuando la pestaña esta en background o cerrada.
    // Cuando la app esta en foreground, FCM entrega el mensaje directo al cliente.
    const notificationTitle = payload.notification?.title || 'Nueva notificacion';
    const notificationOptions = {
      body: payload.notification?.body || 'Tienes una actualizacion.',
      // Preservamos data del payload para poder accederla en el click handler.
      data: payload.data || {},
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // El deep link viene del campo data.link enviado por la Edge Function.
  // Fallback a /chat si no se incluyo link en el payload del backend.
  const targetUrl = event.notification?.data?.link || '/chat';
  // waitUntil mantiene el SW activo hasta que la ventana haya abierto.
  event.waitUntil(clients.openWindow(targetUrl));
});