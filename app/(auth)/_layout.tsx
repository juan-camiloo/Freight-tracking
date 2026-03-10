// Layout protegido del grupo (auth).
// Bloquea render de rutas privadas hasta validar sesion
// y mantiene registro de token push sincronizado con el estado auth.
import { Slot, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { registerCurrentDevicePushToken } from '../../lib/pushNotifications';
import { supabase } from '../../lib/supabase';

export default function AuthLayout() {
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;

      if (!session) {
        router.replace('/login');
      } else {
        // Si ya hay sesion, registramos el token del dispositivo para recibir push.
        void registerCurrentDevicePushToken(session.user.id);
      }

      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Mantenemos token sincronizado en inicio de sesion y refresh de JWT.
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user?.id) {
        void registerCurrentDevicePushToken(session.user.id);
      }

      if (event === 'SIGNED_OUT' && !session) {
        router.replace('/login');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Evitamos renderizar rutas privadas hasta validar sesion.
  if (checkingSession) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
