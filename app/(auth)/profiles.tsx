// Archivo: app/(auth)/profiles.tsx
// Descripcion: Pantalla de perfiles para usuarios internos. Permite cargar, buscar y ver la empresa de cada usuario.

import Header from '@/components/Header';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AUTH_COLORS,
  AUTH_SHADOW,
  AuthScreenBackground,
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
  company_id?: string | null;
  company_name?: string | null;
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

  // Estado para edición rápida de alias (nickname)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [quickNickname, setQuickNickname] = useState('');
  const [savingQuickNickname, setSavingQuickNickname] = useState(false);

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

      const [profilesRes, companiesRes] = await Promise.all([
        fetch(listProfilesFunctionUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
          },
        }),
        supabase.from('companies').select('id, name'),
      ]);

      if (!profilesRes.ok) {
        const errorMessage = await resolveErrorMessage(profilesRes, t('profiles.loadError'));
        throw new Error(errorMessage);
      }

      const rawProfiles = await profilesRes.json();
      const companyMap = new Map<string, string>(
        (companiesRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name]),
      );

      const enhancedProfiles: Profile[] = (rawProfiles || [])
        .filter((p: any) => p.status !== 'inactive')
        .map((p: any) => ({
          ...p,
          company_name: p.company_id ? companyMap.get(p.company_id) ?? null : null,
        }));

      setProfiles(enhancedProfiles);
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
      const companyName = item.company_name?.toLowerCase() ?? '';
      return nickname.includes(clean) || email.includes(clean) || companyName.includes(clean);
    });

    setSearchResults(next);
  };

  const handleSaveQuickNickname = async () => {
    if (!editingProfile) return;
    const clean = quickNickname.trim();
    if (!clean) {
      notification.error(t('profiles.nicknameEmpty', { defaultValue: 'El alias no puede estar vacío' }));
      return;
    }

    setSavingQuickNickname(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ nickname: clean })
        .eq('id', editingProfile.id);

      if (error) throw error;

      setProfiles((prev) =>
        prev.map((p) => (p.id === editingProfile.id ? { ...p, nickname: clean } : p)),
      );
      setSearchResults((prev) =>
        prev.map((p) => (p.id === editingProfile.id ? { ...p, nickname: clean } : p)),
      );
      setEditingProfile(null);
      notification.success(t('profiles.nicknameUpdated', { defaultValue: 'Alias actualizado correctamente' }));
    } catch {
      notification.error(t('profiles.nicknameError', { defaultValue: 'No se pudo actualizar el alias' }));
    } finally {
      setSavingQuickNickname(false);
    }
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
    <View style={styles.container}>
      <AuthScreenBackground />
      <Header
        title={t('profiles.headerTitle')}
        isDesktop={isDesktop}
        showSearch={false}
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
          const nickname =
            (item.nickname && item.nickname.trim()) ||
            (item.email && item.email.trim()) ||
            t('profiles.unnamedProfile');
          const companyDisplay = item.company_name || (item.is_internal ? t('profiles.internalTeam', { defaultValue: 'Equipo interno' }) : t('companies.noCompanyAssigned'));

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
                <View style={styles.userIconBadge}>
                  <Ionicons name="person-outline" size={18} color={AUTH_COLORS.blue} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardProfile}>{nickname}</Text>
                  {item.company_name ? (
                    <View style={styles.companyPill}>
                      <Ionicons name="business-outline" size={12} color={AUTH_COLORS.orange} />
                      <Text style={styles.companyPillText} numberOfLines={1}>
                        {item.company_name}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.noCompanyPill}>
                      <Ionicons name="business-outline" size={12} color={AUTH_COLORS.secondaryText} />
                      <Text style={styles.noCompanyPillText}>
                        {companyDisplay}
                      </Text>
                    </View>
                  )}
                  {item.email ? <Text style={styles.cardSub}>{item.email}</Text> : null}
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.quickEditButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      setEditingProfile(item);
                      setQuickNickname(item.nickname || '');
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="pencil-outline" size={15} color={AUTH_COLORS.orange} />
                  </TouchableOpacity>
                  <Ionicons name="chevron-forward" size={18} color={AUTH_COLORS.secondaryText} />
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

      <Modal
        visible={Boolean(editingProfile)}
        animationType="fade"
        transparent
        onRequestClose={() => setEditingProfile(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDesktop && styles.modalCardDesktop]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('profiles.editNicknameTitle', { defaultValue: 'Editar alias de usuario' })}</Text>
              <TouchableOpacity onPress={() => setEditingProfile(null)}>
                <Ionicons name="close" size={22} color={AUTH_COLORS.primaryText} />
              </TouchableOpacity>
            </View>

            {editingProfile?.email ? (
              <Text style={styles.modalSubtitle}>{editingProfile.email}</Text>
            ) : null}

            <TextInput
              style={styles.modalInput}
              value={quickNickname}
              onChangeText={setQuickNickname}
              placeholder={t('profiles.nicknamePlaceholder', { defaultValue: 'Ingresa el nuevo alias...' })}
              placeholderTextColor={AUTH_COLORS.secondaryText}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveQuickNickname}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditingProfile(null)}
                disabled={savingQuickNickname}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, savingQuickNickname && styles.saveBtnDisabled]}
                onPress={handleSaveQuickNickname}
                disabled={savingQuickNickname}
              >
                {savingQuickNickname ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-outline" size={15} color="#ffffff" />
                    <Text style={styles.modalSaveText}>{t('common.save')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TouchableOpacity
        style={[styles.addUserFab, !isDesktop && styles.addUserFabMobile]}
        onPress={() => router.push('/addUser')}
        activeOpacity={0.85}
      >
        <Ionicons name="person-add-outline" size={20} color="#ffffff" />
        <Text style={styles.addUserFabText}>{t('dashboard.addUser')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: AUTH_COLORS.backgroundBottom,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    gap: 14,
    paddingBottom: 28,
  },
  listContentDesktop: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 64,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
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
  addUserFab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: AUTH_COLORS.orange,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 99,
  },
  addUserFabMobile: {
    bottom: AUTH_MOBILE_DOCK_PADDING + 16,
    right: 16,
  },
  addUserFabText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
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
  userIconBadge: {
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
    gap: 3,
  },
  cardProfile: {
    fontSize: 17,
    fontWeight: '800',
    color: AUTH_COLORS.primaryText,
  },
  cardSub: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
  },

  companyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  companyPillText: {
    color: AUTH_COLORS.orangeText,
    fontSize: 11,
    fontWeight: '700',
  },
  noCompanyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  noCompanyPillText: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 11,
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
    fontSize: 11,
    fontWeight: '700',
  },
  rolePillTextInternal: {
    color: AUTH_COLORS.green,
  },
  rolePillTextExternal: {
    color: AUTH_COLORS.blue,
  },
  emptyState: {
    marginTop: 18,
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 14,
    textAlign: 'center',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickEditButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  modalCardDesktop: {
    maxWidth: 460,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
    fontWeight: '500',
    marginTop: -8,
  },
  modalInput: {
    height: 46,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
    paddingHorizontal: 14,
    color: AUTH_COLORS.primaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  modalCancelText: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.orange,
  },
  modalSaveText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
});
