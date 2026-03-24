// Layout protegido del grupo (auth).
// Bloquea render de rutas privadas hasta validar sesion
// y mantiene registro de token push sincronizado con el estado auth.
import { Slot, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { registerCurrentDevicePushToken } from '../../lib/pushNotifications';
import { supabase } from '../../lib/supabase';

export default function AuthLayout() {
  // Controla si la validacion de sesion inicial termino.
  // Mientras sea true se bloquea el render de las rutas hijas.
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Flag para evitar actualizaciones de estado en componentes desmontados
    // si la promesa de getSession resuelve despues de una navegacion.
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
        console.log('[AuthLayout] getSession result:', session ? 'HAS SESSION' : 'NO SESSION');

      if (!mounted) return;

      if (!session) {
        // Sin sesion activa, redirigir al login antes de mostrar cualquier ruta privada.
        router.replace('/login');
        return;
      } 
      if (session?.user?.id) {
        // Con sesion valida, registrar el token push del dispositivo para recibir
        // notificaciones. Se hace aqui para cubrir el caso de reabrir la app.
        void registerCurrentDevicePushToken(session.user.id);
      }
      console.log('[AuthLayout] setCheckingSession(false)'); // agregar

      setCheckingSession(false);
    });

    // Suscripcion al ciclo de vida de la sesion para mantener el token
    // sincronizado ante cambios de estado sin recargar la app.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('[AuthLayout] onAuthStateChange event:', event, 'session:', session ? 'HAS SESSION' : 'NO SESSION');

      // Re-registrar token en login nuevo o cuando Supabase refresca el JWT
      // para evitar que el token quede asociado a un user_id incorrecto.
      
      if(event === 'INITIAL_SESSION' ){
        return;
      }
      if(event === 'SIGNED_IN' && session?.user?.id){
        void registerCurrentDevicePushToken(session.user.id)
      }
      if (event === 'TOKEN_REFRESHED' && session?.user?.id){
        void registerCurrentDevicePushToken(session.user.id)
      } 
      // Al cerrar sesion, redirigir siempre al login independientemente
      // de la ruta actual dentro del grupo protegido.
      if (event === 'SIGNED_OUT' && !session) {
        router.replace('/login');
      }
    });

    return () => {
      mounted = false;
      // Cancelar la suscripcion al desmontar para evitar memory leaks.
      subscription.unsubscribe();
    };
  }, []);

  // Pantalla de espera mientras se resuelve la sesion inicial.
  // Evita un flash de contenido protegido antes de la redireccion al login.
  if (checkingSession) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  // Slot renderiza la ruta activa dentro del grupo (auth).
  return <Slot />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});