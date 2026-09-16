// Layout protegido del grupo (auth).
// Bloquea render de rutas privadas hasta validar sesion
// y mantiene registro de token push sincronizado con el estado auth.
// Provee el App Shell unificado con Top Bar persistente, Sidebar jerárquico y Dock móvil.

import { Slot } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AUTH_COLORS, AuthScreenBackground } from '../../components/auth/AuthChrome';
import { AuthDesktopSidebar, AuthMobileDock, MobileMoreDrawer } from '../../components/auth/AuthNavigation';
import { AppTopBar } from '../../components/navigation/AppTopBar';
import { useResponsive } from '../../hooks/useResponsive';
import { AuthUserProvider, useAuthUser } from '../../contexts/AuthUserContext';

function AuthLayoutContent() {
  const { isDesktop } = useResponsive();
  const { isInternal, profile, loading } = useAuthUser();
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Pantalla de espera mientras se resuelve la sesión y verificación inicial
  if (loading) {
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
              onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
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

export default function AuthLayout() {
  return (
    <AuthUserProvider>
      <AuthLayoutContent />
    </AuthUserProvider>
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
