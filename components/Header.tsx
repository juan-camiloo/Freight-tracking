// Archivo: components/Header.tsx
// Cabecera contextual de página y barra de herramientas (Nivel 3 de navegación).
// Muestra migas de pan (breadcrumbs), título jerárquico, botón de retorno inteligente
// y acciones exclusivas de la vista activa (sin duplicar la navegación global).

import type { ShipmentListItem } from '@/lib/shipmentType';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AuthSearchBar } from './auth/AuthSearchBar';
import LogoCorner from './LogoCorner';
import { COLORS } from './ui/COLORS';
import { FONT_SIZE, FONT_WEIGHT } from './ui/TYPOGRAPHY';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type BreadcrumbTrail = {
  items: BreadcrumbItem[];
  isFocusMode?: boolean;
};

export type DashboardHeaderProps = {
  isDesktop: boolean;
  title?: string;
  badge?: string;
  searchQuery?: string;
  searching?: boolean;
  isInternal?: boolean;
  selectedShipment?: ShipmentListItem;
  selectedShipmentId?: string;
  canRequestWebNotifications?: boolean;
  showSearch?: boolean;
  showActions?: boolean;
  showNotifications?: boolean;
  showGoBack?: boolean;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  onGoBack?: () => void;
  onSubmitSearch?: (value: string) => void;
  onEnableNotifications?: () => void;
  onToggleLanguage?: () => void;
  onLogout?: () => void;
  children?: React.ReactNode;
};

export default function Header({
  isDesktop,
  title,
  badge,
  searchQuery = '',
  searching = false,
  isInternal = false,
  selectedShipment,
  selectedShipmentId,
  showSearch = true,
  showActions = true,
  searchPlaceholder,
  onSearchChange,
  onGoBack,
  onSubmitSearch,
  onToggleLanguage,
  onLogout,
  children,
}: DashboardHeaderProps) {
  const { t } = useTranslation();
  const pathname = usePathname();

  const isLoginScreen = pathname === '/login' || pathname === 'login';
  const resolvedTitle = title || (isInternal ? t('dashboard.headerInternal') : t('dashboard.headerExternal'));
  const breadcrumbs = getBreadcrumbs(pathname, resolvedTitle, t);

  return (
    <View style={[styles.header, isDesktop && styles.headerDesktop]}>
      
      {/* 1. Miga de pan / Breadcrumb Trail (solo en vistas secundarias y con raíz en Inicio) */}
      {!isLoginScreen && breadcrumbs && breadcrumbs.items.length > 0 && (
        <View style={styles.breadcrumbBar}>
          {breadcrumbs.items.map((item, idx) => {
            const isLast = idx === breadcrumbs.items.length - 1;
            return (
              <View key={idx} style={styles.breadcrumbSegment}>
                {idx > 0 && <Text style={styles.breadcrumbDivider}>/</Text>}
                {item.href && !isLast ? (
                  <TouchableOpacity
                    onPress={() => router.push(item.href as any)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  >
                    <Text style={styles.breadcrumbLink}>{item.label}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text
                    style={isLast ? styles.breadcrumbCurrent : styles.breadcrumbSection}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* 2. Barra Principal de la Página: Título, Retorno y Acciones Contextuales */}
      <View style={[styles.brandBar, isDesktop && styles.brandBarDesktop]}>
        <View style={styles.brandWrap}>
          {/* Botón de retorno inteligente O Logo si es pantalla de Login */}
          {onGoBack ? (
            <TouchableOpacity style={styles.backButton} onPress={onGoBack} activeOpacity={0.75}>
              <Ionicons name="arrow-back-outline" size={17} color={COLORS.surface} />
              <Text style={styles.backButtonText}>{t('common.back')}</Text>
            </TouchableOpacity>
          ) : isLoginScreen ? (
            <LogoCorner inline size={76} height={32} />
          ) : null}

          <View style={styles.titleWrap}>
            <Text numberOfLines={1} style={[styles.brandTitle, !isDesktop && styles.brandTitleMobile]}>
              {resolvedTitle}
            </Text>
            {badge && (
              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>{badge}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Acciones contextuales personalizadas o de login */}
        {children ? (
          <View style={styles.customActionsArea}>{children}</View>
        ) : isLoginScreen && showActions && onToggleLanguage ? (
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconAction} onPress={onToggleLanguage} activeOpacity={0.75}>
              <Ionicons name="globe-outline" size={15} color={COLORS.surface} />
              <Text style={styles.iconActionText}>ES/EN</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* 3. Fila de controles locales / Barra de búsqueda de la lista del Dashboard */}
      {showSearch ? (
        <View style={[styles.topControls, isDesktop && styles.topControlsDesktop]}>
          <View style={[styles.searchArea, isDesktop && styles.searchAreaDesktop]}>
            <AuthSearchBar
              tone="dark"
              value={searchQuery}
              onChangeText={onSearchChange || (() => {})}
              placeholder={searchPlaceholder || t('dashboard.searchPlaceholder')}
              helperText={isDesktop ? t('dashboard.searchHint') : undefined}
              onSubmitEditing={() => {
                const clean = searchQuery.trim();
                if (clean && onSubmitSearch) void onSubmitSearch(clean);
              }}
              searching={searching}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function getBreadcrumbs(
  pathname: string,
  title: string,
  t: ReturnType<typeof useTranslation>['t'],
): BreadcrumbTrail | null {
  // En la raíz / Home no se muestra miga redundante (Inicio es la raíz de la app)
  if (pathname === '/' || pathname === '') {
    return null;
  }

  const homeLabel = t('navigation.home');
  const shipmentsLabel = t('dashboard.shipments');
  const companiesLabel = t('companies.header');
  const profilesLabel = t('profiles.headerTitle');
  const supportLabel = t('navigation.support');

  if (pathname.startsWith('/shipment/')) {
    return {
      items: [
        { label: homeLabel, href: '/' },
        { label: shipmentsLabel, href: '/' },
        { label: title },
      ],
    };
  }

  if (pathname === '/createShipment') {
    return {
      items: [
        { label: homeLabel, href: '/' },
        { label: shipmentsLabel, href: '/' },
        { label: t('navigation.newShipment') },
      ],
      isFocusMode: true,
    };
  }

  if (pathname.startsWith('/editShipment')) {
    return {
      items: [
        { label: homeLabel, href: '/' },
        { label: shipmentsLabel, href: '/' },
        { label: title || t('common.edit') },
      ],
      isFocusMode: true,
    };
  }

  if (pathname.startsWith('/assignShipment')) {
    return {
      items: [
        { label: homeLabel, href: '/' },
        { label: shipmentsLabel, href: '/' },
        { label: t('assignShipment.assign') },
      ],
    };
  }

  if (pathname === '/companies') {
    return {
      items: [
        { label: homeLabel, href: '/' },
        { label: companiesLabel },
      ],
    };
  }

  if (pathname === '/companies/create') {
    return {
      items: [
        { label: homeLabel, href: '/' },
        { label: companiesLabel, href: '/companies' },
        { label: t('companies.createCompany') },
      ],
    };
  }

  if (pathname.startsWith('/companies')) {
    return {
      items: [
        { label: homeLabel, href: '/' },
        { label: companiesLabel, href: '/companies' },
        { label: title || t('common.detail') },
      ],
    };
  }

  if (pathname === '/profiles') {
    return {
      items: [
        { label: homeLabel, href: '/' },
        { label: profilesLabel },
      ],
    };
  }

  if (pathname === '/addUser') {
    return {
      items: [
        { label: homeLabel, href: '/' },
        { label: profilesLabel, href: '/profiles' },
        { label: t('addUser.headerTitle') },
      ],
    };
  }

  if (pathname.startsWith('/profile/')) {
    return {
      items: [
        { label: homeLabel, href: '/' },
        { label: profilesLabel, href: '/profiles' },
        { label: title || t('profileDetail.headerTitle') },
      ],
    };
  }

  if (pathname === '/supportInbox') {
    return {
      items: [
        { label: homeLabel, href: '/' },
        { label: supportLabel },
      ],
    };
  }

  if (pathname.startsWith('/supportInbox/') || pathname.startsWith('/ticket/')) {
    return {
      items: [
        { label: homeLabel, href: '/' },
        { label: supportLabel, href: '/supportInbox' },
          { label: title || t('navigation.ticket') },
        ],
    };
  }

  if (pathname === '/createTicket') {
    return {
      items: [
        { label: homeLabel, href: '/' },
        { label: supportLabel, href: '/supportInbox' },
        { label: t('dashboard.fabCreateTicket') },
      ],
    };
  }

  if (pathname === '/myProfile') {
    return {
      items: [
        { label: homeLabel, href: '/' },
        { label: t('myProfile.headerTitle') },
      ],
    };
  }

  if (pathname === '/trash') {
    return {
      items: [
        { label: homeLabel, href: '/' },
        { label: t('navigation.trash') },
      ],
    };
  }

  return null;
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
    backgroundColor: '#253046',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 241, 234, 0.06)',
  },
  headerDesktop: {
    paddingTop: 18,
    paddingHorizontal: 26,
    paddingBottom: 18,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  breadcrumbBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  breadcrumbSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breadcrumbLink: {
    color: 'rgba(245, 241, 234, 0.55)',
    fontSize: 11,
    fontWeight: FONT_WEIGHT.medium,
  },
  breadcrumbSection: {
    color: 'rgba(245, 241, 234, 0.45)',
    fontSize: 11,
    fontWeight: FONT_WEIGHT.medium,
  },
  breadcrumbCategory: {
    color: 'rgba(245, 241, 234, 0.45)',
    fontSize: 11,
    fontWeight: FONT_WEIGHT.medium,
  },
  breadcrumbDivider: {
    color: 'rgba(245, 241, 234, 0.25)',
    fontSize: 11,
  },
  breadcrumbCurrent: {
    color: COLORS.orange,
    fontSize: 11,
    fontWeight: FONT_WEIGHT.bold,
    maxWidth: 260,
  },
  focusModeBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    backgroundColor: 'rgba(199, 138, 75, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(199, 138, 75, 0.35)',
  },
  focusModeText: {
    color: COLORS.orange,
    fontSize: 9,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 0.5,
  },
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 36,
  },
  brandBarDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  brandTitle: {
    color: COLORS.white,
    fontSize: FONT_SIZE.lg + 2,
    fontWeight: FONT_WEIGHT.bold,
  },
  brandTitleMobile: {
    color: COLORS.white,
    fontSize: FONT_SIZE.base + 2,
    lineHeight: 22,
    fontWeight: '800',
  },
  badgePill: {
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(199, 138, 75, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(199, 138, 75, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePillText: {
    color: COLORS.orange,
    fontSize: 10,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: 12,
  },
  backButton: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 241, 234, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 241, 234, 0.12)',
  },
  backButtonText: {
    color: COLORS.surface,
    fontSize: FONT_SIZE.xs + 1,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: 16,
  },
  customActionsArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 241, 234, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 241, 234, 0.12)',
  },
  iconActionText: {
    color: COLORS.surface,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
  topControls: { gap: 10 },
  topControlsDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  searchArea: {
    width: '100%',
  },
  searchAreaDesktop: {
    flex: 1,
    width: '100%',
  },
  actionsColumn: {
    width: '100%',
    gap: 8,
  },
  actionsColumnDesktop: {
    flex: 0.35,
    gap: 10,
  },
  secondaryHeaderButtonText: {
    color: COLORS.surface,
    fontSize: FONT_SIZE.xs + 1,
    fontWeight: FONT_WEIGHT.bold,
    textAlign: 'center',
  },
  secondaryHeaderButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(245, 241, 234, 0.09)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 241, 234, 0.12)',
  },
  secondaryActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryHeaderButtonText: {
    color: COLORS.primaryText,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
  },
  primaryHeaderButton: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: COLORS.orangeSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.orangeBorder,
    alignSelf: 'stretch',
  },
});
