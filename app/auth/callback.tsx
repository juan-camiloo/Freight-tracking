// Pantalla de callback de autenticacion.
// Maneja distintos formatos de retorno de Supabase auth:
// - access_token + refresh_token en hash/query
// - code para exchangeCodeForSession
// - token_hash + type para verifyOtp (magic link)
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
    code?: string | string[];
  }>();

  useEffect(() => {
    const run = async () => {
      try {
        // Normalizamos params porque expo-router puede entregar string | string[].
        const tokenHashParam = Array.isArray(params.token_hash) ? params.token_hash[0] : params.token_hash;
        const typeParam = Array.isArray(params.type) ? params.type[0] : params.type;
        const codeParam = Array.isArray(params.code) ? params.code[0] : params.code;

        // Si la sesion ya existe, evitamos reprocesar la URL.
        const {
          data: { session: existingSession },
        } = await supabase.auth.getSession();
        if (existingSession) {
          return router.replace('/');
        }

        // Obtenemos URL inicial y contemplamos retraso de deep link en Expo Go.
        let url = (await Linking.getInitialURL()) ?? currentUrl;
        if (!url && !tokenHashParam && !typeParam) {
          // Expo Go puede entregar el deep link con retraso tras volver desde el navegador.
          await new Promise((resolve) => setTimeout(resolve, 1200));
          url = (await Linking.getInitialURL()) ?? currentUrl;
        }

        // Leemos tanto query params como fragment (#) para cubrir todos los providers.
        const [base, hash = ''] = (url ?? '').split('#');
        const parsed = base ? Linking.parse(base) : { queryParams: {} };
        const qp = (parsed.queryParams ?? {}) as Record<string, string | string[]>;
        const hp = new URLSearchParams(hash);

        const access_token = hp.get('access_token') ?? (qp.access_token ? String(qp.access_token) : null);
        const refresh_token = hp.get('refresh_token') ?? (qp.refresh_token ? String(qp.refresh_token) : null);
        const code = codeParam ?? (qp.code ? String(qp.code) : null);

        // Caso 1: tokens directos.
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (!error) {
            const {
              data: { session: afterSetSession },
            } = await supabase.auth.getSession();
            return router.replace(afterSetSession ? '/' : '/login');
          }
        }

        // Caso 2: codigo de autorizacion.
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            const {
              data: { session: afterExchangeSession },
            } = await supabase.auth.getSession();
            return router.replace(afterExchangeSession ? '/' : '/login');
          }
        }

        // Caso 3: token hash (OTP / magic link).
        const token_hash = tokenHashParam ?? (qp.token_hash ? String(qp.token_hash) : null);
        const type = typeParam ?? (qp.type ? String(qp.type) : null);

        if (token_hash && type) {
          const normalizedType = type === 'magiclink' ? 'email' : type;
          const { error } = await supabase.auth.verifyOtp({ token_hash, type: normalizedType as any });
          if (!error) {
            const {
              data: { session: afterVerifySession },
            } = await supabase.auth.getSession();
            return router.replace(afterVerifySession ? '/' : '/login');
          }
          console.error('verifyOtp failed:', error?.message);
        }

        const {
          data: { session: finalSession },
        } = await supabase.auth.getSession();
        router.replace(finalSession ? '/' : '/login');
      } catch (error) {
        console.error('Auth callback error:', error);
        router.replace('/login');
      }
    };

    run();
  }, [currentUrl, params.token_hash, params.type, params.code]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
