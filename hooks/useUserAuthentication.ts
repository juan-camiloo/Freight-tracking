import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/URLs';

export default function useUserAuthentication(redirectToLogin = true) {
  const [user, setUser] = useState<any | null>(null);
  const [isInternal, setIsInternal] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getUser();
        const u = data?.user ?? null;
        if (!mounted) return;
        if (!u) {
          if (redirectToLogin) router.replace('/login');
          setUser(null);
          setIsInternal(false);
        } else {
          setUser(u);
          // attempt to fetch profile or flags if available elsewhere
          // fallback: assume not internal
          setIsInternal(false);
        }
      } catch (e: any) {
        setError(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [redirectToLogin]);

  return { user, isInternal, loading, error } as const;
}
