// Pantalla de callback de autenticacion.
// Maneja distintos formatos de retorno de Supabase auth:
// - access_token + refresh_token en hash/query
// - code para exchangeCodeForSession
// - token_hash + type para verifyOtp (magic link)
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  useEffect(() => {
    const processUrl = async (url: string | null) => {
      if (!url){
        return;
      }
        if (url.includes('expo-development-client')) {
          return;
        }
      try {
        // Normalizamos params porque expo-router puede entregar string | string[].
        const parsed = Linking.parse(url);
        const queryParams= parsed.queryParams || {};
        const fragment = url.split('#')[1]||'';
        const fragmentParams = new URLSearchParams (fragment);
        const normalize = (v: unknown) =>
          Array.isArray(v) ? v[0] ?? null : (v as string | null) ?? null;

        const token_hash = normalize(queryParams.token_hash) ?? fragmentParams.get ('token_hash');
        const type = normalize(queryParams.type) ?? fragmentParams.get('type')?? 'email';
        const code =  normalize(queryParams.code) ??  fragmentParams.get('code');

        if (token_hash){
          const {error} = await supabase.auth.verifyOtp({
            token_hash: String(token_hash),
            type: type as any
          });
          if (error) throw error
        }else if (code){
          const {error}= await supabase.auth.exchangeCodeForSession(String(code));
          if (error) throw error;
        } else {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        // Si la sesion ya existe, evitamos reprocesar la URL.
        const {
          data: { session: existingSession }
        } = await supabase.auth.getSession();
        

        router.replace(existingSession ? '/' : '/login');

      } catch (error) {
        console.error('Auth callback error:', error);
        router.replace('/login');
      }
    };

    let cancelled = false;

  const init = async () => {
    const rawUrl = await Linking.getInitialURL();
    if (!cancelled) await processUrl(rawUrl);
  };

  const timer = setTimeout(init, 800);
    const subscription = Linking.addEventListener('url', ({ url }) =>{
      processUrl (url)
    })
    return ()=> {
      cancelled= true;
      clearTimeout(timer);
      subscription.remove()
    }
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
