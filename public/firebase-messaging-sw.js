/* eslint-disable no-undef */
// Service Worker para push web con Firebase Cloud Messaging (FCM).
// Responsabilidades:
// 1) Inicializar Firebase en contexto worker.
// 2) Mostrar notificaciones cuando el navegador esta en background.
// 3) Abrir una ruta al hacer click sobre la notificacion.
// La configuracion llega por query params para no hardcodear valores.

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;

const firebaseConfig = {
  apiKey: params.get('apiKey') || '',
  authDomain: params.get('authDomain') || '',
  projectId: params.get('projectId') || '',
  messagingSenderId: params.get('messagingSenderId') || '',
  appId: params.get('appId') || '',
};

if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    // Si el mensaje no trae titulo/cuerpo, usamos textos por defecto.
    const notificationTitle = payload.notification?.title || 'Nueva notificacion';
    const notificationOptions = {
      body: payload.notification?.body || 'Tienes una actualizacion.',
      data: payload.data || {},
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Intentamos usar deep link enviado desde backend; fallback a /chat.
  const targetUrl = event.notification?.data?.link || '/chat';
  event.waitUntil(clients.openWindow(targetUrl));
});
