import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  const currentUrl = Linking.useURL();
  const params = useLocalSearchParams<{
    token_hash?: string | string[];
    type?: string | string[];
  }>();

  useEffect(() => {
    const run = async () => {
      try {
        const tokenHashParam = Array.isArray(params.token_hash) ? params.token_hash[0] : params.token_hash;
        const typeParam = Array.isArray(params.type) ? params.type[0] : params.type;

        // Si la sesion ya existe (detectSessionInUrl puede crearla), entra directo.
        const {
          data: { session: existingSession },
        } = await supabase.auth.getSession();
        if (existingSession) {
          return router.replace('/(auth)');
        }

        let url = (await Linking.getInitialURL()) ?? currentUrl;
        if (!url && !tokenHashParam && !typeParam) {
          // Expo Go puede entregar el deep link con retraso tras volver desde el navegador.
          await new Promise((resolve) => setTimeout(resolve, 1200));
          url = (await Linking.getInitialURL()) ?? currentUrl;
        }

        const [base, hash = ''] = (url ?? '').split('#');
        const parsed = base ? Linking.parse(base) : { queryParams: {} };
        const qp = (parsed.queryParams ?? {}) as Record<string, string | string[]>;
        const hp = new URLSearchParams(hash);

        const access_token = hp.get('access_token');
        const refresh_token = hp.get('refresh_token');

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (!error) {
            const {
              data: { session: afterSetSession },
            } = await supabase.auth.getSession();
            return router.replace(afterSetSession ? '/(auth)' : '/login');
          }
        }

        const token_hash = tokenHashParam ?? (qp.token_hash ? String(qp.token_hash) : null);
        const type = typeParam ?? (qp.type ? String(qp.type) : null);

        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as any });
          if (!error) {
            const {
              data: { session: afterVerifySession },
            } = await supabase.auth.getSession();
            return router.replace(afterVerifySession ? '/(auth)' : '/login');
          }
        }

        const {
          data: { session: finalSession },
        } = await supabase.auth.getSession();
        router.replace(finalSession ? '/(auth)' : '/login');
      } catch (error) {
        console.error('Auth callback error:', error);
        router.replace('/login');
      }
    };

    run();
  }, [currentUrl, params.token_hash, params.type]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
