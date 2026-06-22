// Archivo: app/(auth)/profiles.tsx
// Descripcion: Pantalla de perfiles para usuarios internos. Permite cargar, buscar y abrir el detalle de cada perfil.

import Header from '@/components/Header';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import {
  AUTH_COLORS,
  AUTH_SHADOW,
  AuthScreenBackground
} from '../../components/auth/AuthChrome';
import { AUTH_MOBILE_DOCK_PADDING } from '../../components/auth/AuthNavigation';
import { AuthSearchBar } from '../../components/auth/AuthSearchBar';
import { useNativeNotification } from '../../components/ui/NativeNotification';
import { useResponsive } from '../../hooks/useResponsive';
import { listProfilesFunctionUrl, supabase, supabaseAnonKey } from '../../lib/URLs';
type Profile = {
  id: string;
  email: string | null;
  is_internal: boolean;
  nickname?: string | null;
};

const isAbortError = (error: unknown) =>
  error instanceof Error &&
  (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted'));

export default function Profiles() {
  const { t } = useTranslation();
  const notification = useNativeNotification();
  const { height, isDesktop } = useResponsive();

  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  const resolveErrorMessage = async (response: Response, fallbackMessage: string) => {
    try {
      const text = await response.text();
      if (text) {
        try {
          const payload = JSON.parse(text);
          if (typeof payload?.error_key === 'string') {
            return t(payload.error_key, payload.error_params ?? {});
          }
          if (typeof payload?.reason_key === 'string') {
            return t(payload.reason_key, payload.reason_params ?? {});
          }
          if (typeof payload?.error === 'string') return payload.error;
          if (typeof payload?.reason === 'string') return payload.reason;
        } catch {
          return text;
        }
      }
    } catch {
      // ignore response parsing errors
    }
    return fallbackMessage;
  };

  useEffect(() => {
    void loadUserAndProfiles();
  }, []);

  useEffect(() => {
    const clean = searchQuery.trim();
    if (!clean) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeout = setTimeout(() => {
      filterProfiles(clean);
      setSearching(false);
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchQuery, profiles]);

  const loadUserAndProfiles = async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/login');
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        notification.error(t('profiles.noSession'));
        return;
      }

      const response = await fetch(listProfilesFunctionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorMessage = await resolveErrorMessage(response, t('profiles.loadError'));
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setProfiles(data || []);
    } catch (error) {
      if (isAbortError(error)) return;
      notification.error(error instanceof Error ? error.message : t('profiles.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  const filterProfiles = (cleanQuery: string) => {
    const clean = cleanQuery.trim().toLowerCase();

    const next = profiles.filter((item) => {
      const nickname = item.nickname?.toLowerCase() ?? '';
      const email = item.email?.toLowerCase() ?? '';
      return nickname.includes(clean) || email.includes(clean);
    });

    setSearchResults(next);
  };

  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  };

  if (loading) {
    return (
      <View style={[styles.center, styles.container]}>
        <AuthScreenBackground />
        <ActivityIndicator size="large" color={AUTH_COLORS.orange} />
      </View>
    );
  }

  const listData = searchQuery.trim().length > 0 ? searchResults : profiles;

  return (
    <View style={[styles.container, { minHeight: height }]}>
      <AuthScreenBackground />
      <Header
        title={t('profiles.headerTitle')}
        isDesktop={isDesktop}
        showSearch = {false}
        onGoBack={backFunction}
      />

      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          isDesktop ? styles.listContentDesktop : styles.listContentMobile,
          !isDesktop && styles.contentWithDock,
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <View style={[styles.actionCard, styles.shadowCard]}>
              <View style={styles.actionCardCopy}>
                <Text style={styles.actionCardTitle}>{t('dashboard.quickActions')}</Text>
                <Text style={styles.actionCardText}>{t('profiles.actionsSubtitle')}</Text>
              </View>
              <View style={styles.actionCardActions}>
                <TouchableOpacity
                  style={styles.actionCardButton}
                  onPress={() => router.push('/assignShipment' as any)}
                >
                  <Ionicons name="link-outline" size={18} color={AUTH_COLORS.primaryText} />
                  <Text style={styles.actionCardButtonText}>{t('dashboard.assignShipment')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionCardButton}
                  onPress={() => router.push('/addUser')}
                >
                  <Ionicons name="person-add-outline" size={18} color={AUTH_COLORS.primaryText} />
                  <Text style={styles.actionCardButtonText}>{t('dashboard.addUser')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.searchCard, styles.shadowCard]}>
              <AuthSearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('profiles.searchPlaceholder')}
                onSubmitEditing={() => {
                  const clean = searchQuery.trim();
                  if (!clean) {
                    setSearchResults([]);
                    setSearching(false);
                    return;
                  }
                  filterProfiles(clean);
                }}
                searching={searching}
              />
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const label =
            (item.nickname && item.nickname.trim()) ||
            (item.email && item.email.trim()) ||
            t('profiles.unnamedProfile');

          return (
            <TouchableOpacity
              style={[styles.card, styles.shadowCard]}
              onPress={() =>
                router.push({
                  pathname: '/profile/[id]',
                  params: { id: item.id },
                })
              }
            >
              <View style={styles.cardTop}>
                <View style={styles.avatarBadge}>
                  <Ionicons name="person-outline" size={18} color={AUTH_COLORS.blue} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardProfile}>{label}</Text>
                  {item.email ? <Text style={styles.cardSub}>{item.email}</Text> : null}
                </View>
                <View style={[styles.rolePill, item.is_internal ? styles.rolePillInternal : styles.rolePillExternal]}>
                  <Text style={[styles.rolePillText, item.is_internal ? styles.rolePillTextInternal : styles.rolePillTextExternal]}>
                    {item.is_internal ? t('profiles.internalRole') : t('profiles.externalRole')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={[styles.emptyState, styles.shadowCard]}>
            <Ionicons name="people-outline" size={34} color={AUTH_COLORS.secondaryText} />
            <Text style={styles.emptyTitle}>
              {searchQuery.trim().length > 0 ? t('profiles.notFound') : t('profiles.empty')}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AUTH_COLORS.backgroundBottom,
    overflow: 'hidden',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 14,
    paddingBottom: 28,
  },
  listContentDesktop: {
    paddingHorizontal: 28,
    paddingTop: 24,
  },
  listContentMobile: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  contentWithDock: {
    paddingBottom: AUTH_MOBILE_DOCK_PADDING,
  },
  headerStack: {
    gap: 14,
    marginBottom: 2,
  },
  actionCard: {
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    padding: 16,
    gap: 12,
  },
  actionCardCopy: {
    gap: 4,
  },
  actionCardTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 17,
    fontWeight: '800',
  },
  actionCardText: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
    lineHeight: 19,
  },
  actionCardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCardButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionCardButtonText: {
    color: AUTH_COLORS.primaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  searchCard: {
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    padding: 14,
  },
  shadowCard: AUTH_SHADOW,
  card: {
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    padding: 16,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: AUTH_COLORS.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardProfile: {
    fontSize: 18,
    fontWeight: '800',
    color: AUTH_COLORS.primaryText,
  },
  cardSub: {
    marginTop: 4,
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
  },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  rolePillInternal: {
    backgroundColor: AUTH_COLORS.greenSoft,
  },
  rolePillExternal: {
    backgroundColor: AUTH_COLORS.blueSoft,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rolePillTextInternal: {
    color: AUTH_COLORS.green,
  },
  rolePillTextExternal: {
    color: AUTH_COLORS.blue,
  },
  emptyState: {
    marginTop: 10,
    paddingVertical: 34,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: AUTH_COLORS.surface,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  emptyTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
});
