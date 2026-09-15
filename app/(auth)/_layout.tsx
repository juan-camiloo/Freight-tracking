// Layout protegido del grupo (auth).
// Bloquea render de rutas privadas hasta validar sesion
// y mantiene registro de token push sincronizado con el estado auth.
// Provee el App Shell unificado con Top Bar persistente, Sidebar jerárquico y Dock móvil.

import { Slot, router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AUTH_COLORS, AuthScreenBackground } from '../../components/auth/AuthChrome';
import { AuthDesktopSidebar, AuthMobileDock, MobileMoreDrawer } from '../../components/auth/AuthNavigation';
import { AppTopBar } from '../../components/navigation/AppTopBar';
import { registerCurrentDevicePushToken } from '../../lib/pushNotifications';
import { supabase } from '../../lib/URLs';

import { useResponsive } from '../../hooks/useResponsive';

export default function AuthLayout() {
  const { isDesktop } = useResponsive();
  const pathname = usePathname();

  // Controla si la validacion de sesion inicial termino.
  const [checkingSession, setCheckingSession] = useState(true);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [profile, setProfile] = useState<{ email: string | null; nickname: string | null; is_internal: boolean } | null>(null);

  const isInternal = Boolean(profile?.is_internal);

  useEffect(() => {
    let mounted = true;
    const verifyUserStatus = async (userId: string): Promise<boolean> => {
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('email, nickname, is_internal, status, company_id')
          .eq('id', userId)
          .single();

        if (!profileData) return false;

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
          return false;
        }

        if (mounted) {
          setProfile(profileData);
        }
        return true;
      } catch {
        return true;
      }
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;

      if (!session) {
        router.replace('/login');
        return;
      } 
      if (session?.user?.id) {
        void registerCurrentDevicePushToken(session.user.id);
        const isActive = await verifyUserStatus(session.user.id);
        if (!isActive) return;
      }

      if (mounted) setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        return;
      }
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user?.id) {
        void registerCurrentDevicePushToken(session.user.id);
        await verifyUserStatus(session.user.id);
      }
      if (event === 'SIGNED_OUT' && !session) {
        router.replace('/login');
      }
    });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user?.id) {
            void verifyUserStatus(session.user.id);
          }
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      appStateSub.remove();
    };
  }, []);

  // Pantalla de espera mientras se resuelve la sesion inicial.
  if (checkingSession) {
    return (
      <View style={styles.center}>
        <AuthScreenBackground />
        <ActivityIndicator color={AUTH_COLORS.orange} />
      </View>
    );
  }

  // App Shell unificado con Top Bar global persistente
  return (
    <View style={styles.frame}>
      <AppTopBar onOpenMobileMenu={() => setShowMobileDrawer(true)} />
      
      {isDesktop ? (
        <View style={styles.desktopContainer}>
          {isInternal ? (
            <AuthDesktopSidebar
              isCollapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
            />
          ) : null}
          <View style={styles.desktopContentSlot}>
            <Slot />
          </View>
        </View>
      ) : (
        <View style={styles.mobileContainer}>
          <View style={styles.mobileContentSlot}>
            <Slot />
          </View>
          {isInternal ? (
            <>
              <AuthMobileDock onOpenMore={() => setShowMobileDrawer(true)} />
              <MobileMoreDrawer
                visible={showMobileDrawer}
                isInternal={isInternal}
                profile={profile}
                onClose={() => setShowMobileDrawer(false)}
              />
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: AUTH_COLORS.backgroundBottom,
  },
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
    width: '100%',
    backgroundColor: AUTH_COLORS.backgroundBottom,
  },
  desktopContentSlot: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  mobileContainer: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  mobileContentSlot: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.backgroundBottom,
    overflow: 'hidden',
  },
});
