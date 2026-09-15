// Archivo: components/auth/AuthNavigation.tsx
// Componentes de navegación persistente del App Shell:
// - AuthDesktopSidebar (Navegación lateral de 3 bloques con soporte de colapso a riel)
// - AuthMobileDock (Dock móvil inferior de accesos rápidos limpios)
// - MobileMoreDrawer (Menú deslizable para opciones secundarias, gestión y Mi Perfil)

import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import i18n from 'i18next';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '../../lib/URLs';
import { supportModal } from '../../lib/supportModal';
import { COLORS } from '../ui/COLORS';
import { FONT_SIZE, FONT_WEIGHT } from '../ui/TYPOGRAPHY';

export const AUTH_MOBILE_DOCK_PADDING = 88;

const DOCK_SHADOW = {
  shadowColor: COLORS.shadow,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 1,
  shadowRadius: 22,
  elevation: 8,
} as const;

export type NavItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href?: string;
  matches: string[];
  badge?: string | number;
  onPress?: () => void;
};

export type NavGroup = {
  key: string;
  title: string;
  badge?: string;
  items: NavItem[];
};

export const toggleLanguage = () => {
  const newLang = i18n.language === 'en' ? 'es' : 'en';
  i18n.changeLanguage(newLang);
};

export function AuthMobileDock({ onOpenMore }: { onOpenMore?: () => void }) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<{ email: string | null; nickname: string | null; is_internal: boolean } | null>(null);
  const [showInternalMoreDrawer, setShowInternalMoreDrawer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('email, nickname, is_internal')
        .eq('id', user.id)
        .single();
      if (!cancelled && data) {
        setProfile(data);
      }
    };
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const isInternal = Boolean(profile?.is_internal);

  // Pestañas esenciales para el dock móvil
  const primaryTabs: NavItem[] = useMemo(() => {
    const homeItem: NavItem = {
      key: 'home',
      label: t('navigation.home'),
      icon: 'cube-outline',
      href: '/',
      matches: ['/'],
    };

    if (isInternal) {
      return [
        homeItem,
        {
          key: 'create',
          label: t('navigation.newShipment'),
          icon: 'add-circle-outline',
          href: '/createShipment',
          matches: ['/createShipment'],
        },
        {
          key: 'assign',
          label: t('assignShipment.assign'),
          icon: 'link-outline',
          href: '/assignShipment',
          matches: ['/assignShipment'],
        },
        {
          key: 'support',
          label: t('navigation.support'),
          icon: 'help-circle-outline',
          href: '/supportInbox',
          matches: ['/supportInbox'],
        },
        {
          key: 'profile',
          label: t('myProfile.headerTitle'),
          icon: 'person-outline',
          href: '/myProfile',
          matches: ['/myProfile'],
        },
      ];
    }

    return [
      homeItem,
      {
        key: 'ticket',
        label: t('navigation.ticket'),
        icon: 'help-circle-outline',
        href: '/createTicket',
        matches: ['/createTicket'],
      },
      {
        key: 'support',
        label: t('navigation.support'),
        icon: 'mail-outline',
        href: '/supportInbox',
        matches: ['/supportInbox'],
      },
      {
        key: 'profile',
        label: t('myProfile.headerTitle'),
        icon: 'person-outline',
        href: '/myProfile',
        matches: ['/myProfile'],
      },
    ];
  }, [isInternal, t]);

  if (width >= 980) return null;

  return (
    <>
      <View style={styles.mobileDockWrap} pointerEvents="box-none">
        <View style={[styles.mobileDock, DOCK_SHADOW]}>
          {primaryTabs.map((item) => {
            const active = matchesPath(pathname, item.matches);

            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.dockButton, active && styles.dockButtonActive]}
                onPress={item.onPress || (() => router.push(item.href as any))}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={active ? COLORS.orange : COLORS.secondaryText}
                />
                <Text style={[styles.dockButtonLabel, active && styles.dockButtonLabelActive]} numberOfLines={1}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Drawer modal */}
      <MobileMoreDrawer
        visible={showInternalMoreDrawer}
        isInternal={isInternal}
        profile={profile}
        onClose={() => setShowInternalMoreDrawer(false)}
      />
    </>
  );
}

export type MobileMoreDrawerProps = {
  visible: boolean;
  isInternal: boolean;
  profile: { email: string | null; nickname: string | null; is_internal: boolean } | null;
  onClose: () => void;
};

export function MobileMoreDrawer({ visible, isInternal, profile, onClose }: MobileMoreDrawerProps) {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();

  const userDisplayName = profile?.nickname || profile?.email?.split('@')[0] || 'Usuario';
  const roleLabel = isInternal ? t('sidebar.internalRole') : t('sidebar.clientRole');
  const groups = useMemo(() => buildNavGroups(isInternal, t), [isInternal, t]);

  const handleNavigate = (path?: string) => {
    onClose();
    if (path) router.push(path as any);
  };

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'en' ? 'es' : 'en';
    void i18n.changeLanguage(nextLang);
  };

  const handleLogout = async () => {
    onClose();
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.drawerBackdrop}>
        <Pressable style={styles.drawerDismissArea} onPress={onClose} />
        <View style={[styles.drawerSheet, DOCK_SHADOW]}>
          {/* Indicador de arrastre */}
          <View style={styles.drawerHandleWrap}>
            <View style={styles.drawerHandle} />
          </View>

          {/* Cabecera del usuario: clickeable a Mi Perfil */}
          <TouchableOpacity
            style={styles.drawerHeader}
            onPress={() => handleNavigate('/myProfile')}
            activeOpacity={0.75}
          >
            <View style={styles.drawerUserInfo}>
              <View style={styles.drawerUserCopy}>
                <View style={styles.drawerNameRow}>
                  <Text style={styles.drawerUserName} numberOfLines={1}>
                    {userDisplayName}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.orange} />
                </View>
                <View style={styles.drawerRolePill}>
                  <Text style={styles.drawerRoleText}>{roleLabel}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.drawerCloseButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={COLORS.secondaryText} />
            </TouchableOpacity>
          </TouchableOpacity>

          <ScrollView style={styles.drawerScroll} contentContainerStyle={styles.drawerContent} showsVerticalScrollIndicator={false}>
            {groups.map((group) => (
              <View key={group.key} style={styles.drawerSection}>
                <Text style={styles.drawerSectionTitle}>{group.title}</Text>
                {group.items.map((item) => {
                  const active = matchesPath(pathname, item.matches);
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.drawerItem, active && styles.drawerItemActive]}
                      onPress={() => (item.onPress ? (onClose(), item.onPress()) : handleNavigate(item.href))}
                    >
                      <View style={styles.drawerItemLead}>
                        <View style={styles.drawerItemIconBox}>
                          <Ionicons
                            name={item.icon}
                            size={18}
                            color={active ? COLORS.orange : COLORS.blue}
                          />
                        </View>
                        <Text style={styles.drawerItemText}>{item.label}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={COLORS.secondaryText} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {/* Sección Sistema / Preferencias */}
            <View style={styles.drawerSection}>
              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => {
                  onClose();
                  supportModal.open();
                }}
              >
                <View style={styles.drawerItemLead}>
                  <View style={styles.drawerItemIconBox}>
                    <Ionicons name="headset-outline" size={18} color={COLORS.orange} />
                  </View>
                  <Text style={styles.drawerItemText}>{t('supportModal.title') || 'Soporte y Tickets'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.secondaryText} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={toggleLanguage}
              >
                <View style={styles.drawerItemLead}>
                  <View style={styles.drawerItemIconBox}>
                    <Ionicons name="globe-outline" size={18} color={COLORS.blue} />
                  </View>
                  <Text style={styles.drawerItemText}>{t('navigation.language')}</Text>
                </View>
                <View style={styles.drawerLangBadge}>
                  <Text style={styles.drawerLangText}>{i18n.language === 'en' ? 'English' : 'Español'}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.drawerItem, styles.drawerItemLogout]}
                onPress={handleLogout}
              >
                <View style={styles.drawerItemLead}>
                  <View style={[styles.drawerItemIconBox, styles.drawerLogoutIconBox]}>
                    <Ionicons name="log-out-outline" size={18} color="#FF6B6B" />
                  </View>
                  <Text style={[styles.drawerItemText, { color: '#FF6B6B' }]}>{t('common.logout')}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export type AuthDesktopSidebarProps = {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
};

export function AuthDesktopSidebar({ isCollapsed = false, onToggleCollapse }: AuthDesktopSidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<{ email: string | null; nickname: string | null; is_internal: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('email, nickname, is_internal')
        .eq('id', user.id)
        .single();
      if (!cancelled && data) {
        setProfile(data);
      }
    };
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const isInternal = Boolean(profile?.is_internal);
  const groups = useMemo(() => buildNavGroups(isInternal, t), [isInternal, t]);
  const userDisplayName = profile?.nickname || profile?.email?.split('@')[0] || 'Usuario';
  const roleLabel = isInternal ? t('sidebar.internalRole') : t('sidebar.clientRole');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <View style={[styles.sidebarContainer, isCollapsed && styles.sidebarContainerCollapsed]}>
      {/* Botón opcional de contracción a riel (Focus Mode) */}
      {onToggleCollapse && (
        <View style={[styles.collapseButtonWrap, isCollapsed && styles.collapseButtonWrapCollapsed]}>
          <TouchableOpacity
            style={[styles.collapseButton, isCollapsed && styles.collapseButtonCollapsed]}
            onPress={onToggleCollapse}
            activeOpacity={0.7}
            accessibilityLabel={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <Ionicons
              name={isCollapsed ? 'chevron-forward-outline' : 'chevron-back-outline'}
              size={18}
              color={COLORS.secondaryText}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Grupos de Navegación */}
      <ScrollView
        style={styles.sidebarScroll}
        contentContainerStyle={[styles.sidebarNavContent, isCollapsed && styles.sidebarNavContentCollapsed]}
        showsVerticalScrollIndicator={false}
      >
        {groups.map((group) => (
          <View key={group.key} style={styles.navGroup}>
            {!isCollapsed && (
              <View style={styles.navGroupHeader}>
                <Text style={styles.navGroupTitle}>{group.title}</Text>
                {group.badge && (
                  <View style={styles.groupBadge}>
                    <Text style={styles.groupBadgeText}>{group.badge}</Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.navGroupItems}>
              {group.items.map((item) => {
                const active = matchesPath(pathname, item.matches);
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.navItemButton,
                      active && styles.navItemButtonActive,
                      isCollapsed && styles.navItemButtonCollapsed,
                    ]}
                    onPress={item.onPress || (() => router.push(item.href as any))}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={active ? COLORS.orange : 'rgba(245, 241, 234, 0.65)'}
                    />
                    {!isCollapsed && (
                      <Text
                        style={[styles.navItemLabel, active && styles.navItemLabelActive]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    )}
                    {!isCollapsed && item.badge !== undefined && (
                      <View style={[styles.itemBadge, active && styles.itemBadgeActive]}>
                        <Text style={[styles.itemBadgeText, active && styles.itemBadgeTextActive]}>
                          {item.badge}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Pie de Sidebar: Perfil de Usuario limpio (sin foto) y Logout */}
      <View style={[styles.sidebarFooter, isCollapsed && styles.sidebarFooterCollapsed]}>
        {!isCollapsed ? (
          <TouchableOpacity
            style={styles.userProfileCard}
            onPress={() => router.push('/myProfile')}
            activeOpacity={0.75}
          >
            <View style={styles.userInfoCopy}>
              <View style={styles.userNameRow}>
                <Text style={styles.userNameText} numberOfLines={1}>
                  {userDisplayName}
                </Text>
                <Ionicons name="chevron-forward" size={13} color="rgba(245, 241, 234, 0.4)" />
              </View>
              <View style={styles.roleTagMini}>
                <Text style={styles.userRoleText} numberOfLines={1}>
                  {roleLabel}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.sidebarActionBtn, isCollapsed && styles.sidebarActionBtnCollapsed]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={16} color="rgba(255, 107, 107, 0.8)" />
          {!isCollapsed && (
            <Text style={[styles.sidebarActionText, { color: 'rgba(255, 107, 107, 0.9)' }]}>
              {t('common.logout')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function buildNavGroups(
  isInternal: boolean,
  t: ReturnType<typeof useTranslation>['t'],
): NavGroup[] {
  const homeGroup: NavGroup = {
    key: 'main',
    title: t('sidebar.homeGroup'),
    items: [
      {
        key: 'home',
        label: t('navigation.home'),
        icon: 'cube-outline',
        href: '/',
        matches: ['/'],
      },
    ],
  };

  if (isInternal) {
    return [
      homeGroup,
      {
        key: 'operations',
        title: t('sidebar.operations'),
        items: [
          {
            key: 'create',
            label: t('navigation.newShipment'),
            icon: 'add-circle-outline',
            href: '/createShipment',
            matches: ['/createShipment'],
          },
          {
            key: 'assign',
            label: t('assignShipment.assign'),
            icon: 'link-outline',
            href: '/assignShipment',
            matches: ['/assignShipment'],
          },
        ],
      },
      {
        key: 'management',
        title: t('sidebar.management'),
        items: [
          {
            key: 'companies',
            label: t('companies.header'),
            icon: 'business-outline',
            href: '/companies',
            matches: ['/companies'],
          },
          {
            key: 'profiles',
            label: t('profiles.headerTitle'),
            icon: 'people-outline',
            href: '/profiles',
            matches: ['/profiles', '/addUser', '/profile'],
          },
        ],
      },
      {
        key: 'system',
        title: t('sidebar.system'),
        items: [
          {
            key: 'support',
            label: t('supportInbox.headerTitle'),
            icon: 'mail-outline',
            href: '/supportInbox',
            matches: ['/supportInbox'],
          },
          {
            key: 'trash',
            label: t('navigation.trash'),
            icon: 'trash-outline',
            href: '/trash',
            matches: ['/trash'],
          },
        ],
      },
    ];
  }

  return [
    homeGroup,
    {
      key: 'system',
      title: t('sidebar.system'),
      items: [
        {
          key: 'ticket',
          label: t('navigation.ticket'),
          icon: 'help-circle-outline',
          href: '/createTicket',
          matches: ['/createTicket'],
        },
        {
          key: 'support',
          label: t('supportInbox.headerTitle'),
          icon: 'mail-outline',
          href: '/supportInbox',
          matches: ['/supportInbox'],
        },
      ],
    },
  ];
}

export function matchesPath(currentPath: string, matches: string[]) {
  if (!matches.length) return false;
  return matches.some((pattern) => {
    if (pattern === '/') return currentPath === '/';
    return currentPath === pattern || currentPath.startsWith(pattern + '/');
  });
}

const styles = StyleSheet.create({
  // Dock Móvil
  mobileDockWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 900,
  },
  mobileDock: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#1F2737',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(245, 241, 234, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  dockButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 14,
  },
  dockButtonActive: {
    backgroundColor: 'rgba(199, 138, 75, 0.15)',
  },
  dockButtonLabel: {
    color: COLORS.secondaryText,
    fontSize: 10,
    fontWeight: FONT_WEIGHT.medium,
  },
  dockButtonLabelActive: {
    color: COLORS.orange,
    fontWeight: FONT_WEIGHT.bold,
  },

  // Drawer / Bottom Sheet Modal
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  drawerDismissArea: {
    flex: 1,
  },
  drawerSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(245, 241, 234, 0.08)',
    paddingBottom: 32,
    maxHeight: '82%',
  },
  drawerHandleWrap: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  drawerHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.line,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  drawerUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  drawerUserCopy: {
    flex: 1,
    gap: 4,
  },
  drawerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  drawerUserName: {
    color: COLORS.primaryText,
    fontSize: FONT_SIZE.base + 1,
    fontWeight: FONT_WEIGHT.bold,
  },
  drawerRolePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  drawerRoleText: {
    color: COLORS.orange,
    fontSize: 10,
    fontWeight: FONT_WEIGHT.bold,
    textTransform: 'uppercase',
  },
  drawerCloseButton: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceAlt,
  },
  drawerScroll: {
    paddingHorizontal: 16,
  },
  drawerContent: {
    paddingVertical: 16,
    gap: 16,
  },
  drawerSection: {
    gap: 8,
  },
  drawerSectionTitle: {
    color: COLORS.secondaryText,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 8,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  drawerItemActive: {
    borderColor: COLORS.orangeBorder,
    backgroundColor: COLORS.orangeSoft,
  },
  drawerItemLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  drawerItemIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 241, 234, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerItemText: {
    color: COLORS.primaryText,
    fontSize: FONT_SIZE.sm + 1,
    fontWeight: FONT_WEIGHT.medium,
  },
  drawerLangBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(79, 104, 142, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(79, 104, 142, 0.3)',
  },
  drawerLangText: {
    color: COLORS.blue,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
  drawerItemLogout: {
    marginTop: 4,
    borderColor: 'rgba(255, 107, 107, 0.2)',
    backgroundColor: 'rgba(255, 107, 107, 0.06)',
  },
  drawerLogoutIconBox: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
  },

  // Sidebar Desktop
  sidebarContainer: {
    width: 240,
    backgroundColor: '#1F2737',
    borderRightWidth: 1,
    borderRightColor: 'rgba(245, 241, 234, 0.08)',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarContainerCollapsed: {
    width: 68,
  },
  collapseButtonWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    alignItems: 'flex-end',
  },
  collapseButtonWrapCollapsed: {
    paddingHorizontal: 0,
    paddingTop: 10,
    paddingBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(245, 241, 234, 0.05)',
  },
  collapseButtonCollapsed: {
    alignSelf: 'center',
    marginRight: 0,
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarNavContent: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 20,
  },
  sidebarNavContentCollapsed: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  navGroup: {
    gap: 6,
  },
  navGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  navGroupTitle: {
    color: 'rgba(245, 241, 234, 0.45)',
    fontSize: 10,
    fontWeight: FONT_WEIGHT.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  groupBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(199, 138, 75, 0.15)',
  },
  groupBadgeText: {
    fontSize: 8,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.orange,
  },
  navGroupItems: {
    gap: 4,
  },
  navItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  navItemButtonCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 0,
  },
  navItemButtonActive: {
    backgroundColor: 'rgba(199, 138, 75, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(199, 138, 75, 0.35)',
  },
  navItemLabel: {
    color: 'rgba(245, 241, 234, 0.75)',
    fontSize: FONT_SIZE.xs + 1,
    fontWeight: FONT_WEIGHT.medium,
    flex: 1,
  },
  navItemLabelActive: {
    color: COLORS.orange,
    fontWeight: FONT_WEIGHT.bold,
  },
  itemBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 241, 234, 0.08)',
  },
  itemBadgeActive: {
    backgroundColor: COLORS.orange,
  },
  itemBadgeText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHT.bold,
    color: 'rgba(245, 241, 234, 0.6)',
  },
  itemBadgeTextActive: {
    color: '#12161A',
  },
  sidebarFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 241, 234, 0.06)',
    gap: 10,
    backgroundColor: '#1A2232',
  },
  sidebarFooterCollapsed: {
    padding: 8,
    alignItems: 'center',
  },
  userProfileCard: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 241, 234, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(245, 241, 234, 0.06)',
  },
  userInfoCopy: {
    gap: 4,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userNameText: {
    color: '#F5F1EA',
    fontSize: FONT_SIZE.xs + 1,
    fontWeight: FONT_WEIGHT.bold,
  },
  roleTagMini: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(199, 138, 75, 0.15)',
  },
  userRoleText: {
    color: COLORS.orange,
    fontSize: 9,
    fontWeight: FONT_WEIGHT.bold,
    textTransform: 'uppercase',
  },
  sidebarActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.15)',
  },
  sidebarActionBtnCollapsed: {
    paddingHorizontal: 6,
  },
  sidebarActionText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
});
