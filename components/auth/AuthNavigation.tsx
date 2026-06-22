import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import i18n from 'i18next';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import { supabase } from '../../lib/URLs';
import { AUTH_COLORS, AUTH_SHADOW } from './AuthChrome';

export const AUTH_MOBILE_DOCK_PADDING = 118;

type NavItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href?: string;
  matches: string[];
  onPress?: () => void;
};
export const toggleLanguage = () => {
  const newLang = i18n.language === 'en' ? 'es' : 'en';
  i18n.changeLanguage(newLang);
};

export function AuthMobileDock() {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const items = useResolvedNavItems('mobile');

  if (width >= 980 || !items.length) return null;

  return (
    <View style={styles.mobileDockWrap} pointerEvents="box-none">
      <View style={[styles.mobileDock, AUTH_SHADOW]}>
        {items.map((item) => {
          const active = matchesPath(pathname, item.matches);
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.dockButton}
              onPress={item.onPress || (() => router.push(item.href as any))}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={active ? AUTH_COLORS.orange : AUTH_COLORS.secondaryText}
              />
              <Text style={[styles.dockButtonLabel, active && styles.dockButtonLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function useResolvedNavItems(variant: 'header' | 'mobile') {
  const { t } = useTranslation();
  const [isInternal, setIsInternal] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) setIsInternal(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_internal')
        .eq('id', user.id)
        .single();

      if (!cancelled) {
        setIsInternal(Boolean(profile?.is_internal));
      }
    };

    void loadRole();

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    if (isInternal === null) return [] as NavItem[];
    return buildNavItems(isInternal, t);
  }, [isInternal, t, variant]);
}

function buildNavItems(
  isInternal: boolean,
  t: ReturnType<typeof useTranslation>['t'],
) {
  const homeItem: NavItem = {
    key: 'home',
    label: t('navigation.home'),
    icon: 'navigate-outline',
    href: '/',
    matches: ['/', '/shipment/', '/editShipment/'],
  };


  if (isInternal) {
    const createItem: NavItem = {
      key: 'create',
      label: t('navigation.newShipment'),
      icon: 'add-circle-outline',
      href: '/createShipment',
      matches: ['/createShipment'],
    };
    const assignItem: NavItem = {
      key: 'assign',
      label: t('assignShipment.assign'),
      icon: 'link-outline',
      href: '/assignShipment',
      matches: ['/assignShipment'],
    };
    const translateItem2: NavItem = {
      key: 'translate',
      label: 'ES/EN',
      icon: 'language-outline',
      matches: [],
      onPress: toggleLanguage,
    };
    const logoutItem2: NavItem = {
      key: 'logout',
      label: t('common.logout'),
      icon: 'log-out-outline',
      matches: [],
      onPress: async () => {
      await supabase.auth.signOut();
      router.push('/login');
    },
  };
    return [homeItem, createItem, assignItem, logoutItem2, translateItem2]  }

  const ticketItem: NavItem = {
    key: 'ticket',
    label: t('navigation.ticket'),
    icon: 'help-circle-outline',
    href: '/createTicket',
    matches: ['/createTicket'],
  };
  const translateItem: NavItem = {
    key: 'translate',
    label: 'ES/EN',
    icon: 'language-outline',
    matches: [],
    onPress: toggleLanguage,
  };
  const logoutItem: NavItem = {
    key: 'logout',
    label: t('common.logout'),
    icon: 'log-out-outline',
    matches: [],
    onPress: async () => {
      await supabase.auth.signOut();
      router.push('/login');
    },
  };
  return [homeItem, ticketItem, translateItem, logoutItem];
}

function matchesPath(pathname: string, matches: string[]) {
  return matches.some((match) => {
    if (match === '/') return pathname === '/';
    return pathname.startsWith(match);
  });
}

const styles = StyleSheet.create({
  sectionNavContent: {
    gap: 10,
    paddingTop: 2,
    paddingBottom: 2,
    paddingRight: 2,
  },
  sectionChip: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245, 241, 234, 0.12)',
    backgroundColor: 'rgba(245, 241, 234, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionChipActive: {
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderColor: AUTH_COLORS.orangeBorder,
  },
  sectionChipText: {
    color: AUTH_COLORS.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionChipTextActive: {
    color: AUTH_COLORS.primaryText,
  },
  mobileDockWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  mobileDock: {
    marginHorizontal: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(245, 241, 234, 0.96)',
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  dockButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  dockButtonLabel: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  dockButtonLabelActive: {
    color: AUTH_COLORS.orange,
  },
});
