import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/URLs';
import { registerCurrentDevicePushToken } from '../lib/pushNotifications';
import { primeUserCache } from '../lib/userCache';

export interface UserProfile {
  id: string;
  email: string | null;
  nickname: string | null;
  is_internal: boolean;
  company_id: string | null;
  status: string | null;
}

interface AuthUserContextType {
  user: User | null;
  userId: string | null;
  profile: UserProfile | null;
  isInternal: boolean;
  companyId: string | null;
  nickname: string | null;
  email: string | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthUserContext = createContext<AuthUserContextType>({
  user: null,
  userId: null,
  profile: null,
  isInternal: false,
  companyId: null,
  nickname: null,
  email: null,
  loading: true,
  refreshProfile: async () => {},
});

export const useAuthUser = () => useContext(AuthUserContext);

export const AuthUserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const verifyUserStatus = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('id, email, nickname, is_internal, status, company_id')
        .eq('id', userId)
        .single();

      if (error || !profileData) return null;

      let isInactive = profileData.status === 'inactive';
      let inactiveReason = 'account';

      if (!isInactive && profileData.company_id) {
        const { data: comp } = await supabase
          .from('companies')
          .select('status')
          .eq('id', profileData.company_id)
          .single();
        if (comp?.status === 'inactive') {
          isInactive = true;
          inactiveReason = 'company';
        }
      }

      if (isInactive) {
        await supabase.auth.signOut();
        router.replace({
          pathname: '/login',
          params: { reason: inactiveReason === 'company' ? 'company_inactive' : 'account_inactive' },
        } as any);
        return null;
      }

      const displayName = profileData.nickname?.trim() || profileData.email?.split('@')[0]?.trim() || '';
      if (displayName) {
        primeUserCache(userId, displayName);
      }

      return profileData as UserProfile;
    } catch {
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    const prof = await verifyUserStatus(user.id);
    if (prof) setProfile(prof);
  }, [user?.id, verifyUserStatus]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (!session || !session.user) {
          router.replace('/login');
          return;
        }

        setUser(session.user);
        void registerCurrentDevicePushToken(session.user.id);

        const prof = await verifyUserStatus(session.user.id);
        if (!prof) return;

        if (mounted) {
          setProfile(prof);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error inicializando auth:', err);
        if (mounted) setLoading(false);
      }
    };

    void initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return;

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user?.id) {
        setUser(session.user);
        void registerCurrentDevicePushToken(session.user.id);
        const prof = await verifyUserStatus(session.user.id);
        if (mounted && prof) setProfile(prof);
      }

      if (event === 'SIGNED_OUT' && !session) {
        setUser(null);
        setProfile(null);
        router.replace('/login');
      }
    });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user?.id) {
            void verifyUserStatus(session.user.id).then((prof) => {
              if (mounted && prof) setProfile(prof);
            });
          }
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      appStateSub.remove();
    };
  }, [verifyUserStatus]);

  const value: AuthUserContextType = {
    user,
    userId: user?.id ?? null,
    profile,
    isInternal: Boolean(profile?.is_internal),
    companyId: profile?.company_id ?? null,
    nickname: profile?.nickname ?? profile?.email ?? null,
    email: profile?.email ?? user?.email ?? null,
    loading,
    refreshProfile,
  };

  return <AuthUserContext.Provider value={value}>{children}</AuthUserContext.Provider>;
};
