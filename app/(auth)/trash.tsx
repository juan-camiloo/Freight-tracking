// app/(auth)/trash.tsx
// Pantalla de Papelera: sistema multi-entidad que permite listar y restaurar
// Cargas, Empresas, Perfiles y Documentos inactivados / eliminados.

import { ShipmentTransportBadge } from '@/components/auth/ShipmentTransportIcon';
import Header from '@/components/Header';
import { useNativeNotification } from '@/components/ui/NativeNotification';
import { FONT_SIZE, FONT_WEIGHT } from '@/components/ui/TYPOGRAPHY';
import { useResponsive } from '@/hooks/useResponsive';
import { getShipmentStatusLabel } from '@/lib/shipmentType';
import { supabase } from '@/lib/URLs';
import { formatDateDisplay } from '@/utils/dateFormatting';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AUTH_COLORS } from '../../components/auth/AuthChrome';
import { AUTH_MOBILE_DOCK_PADDING } from '../../components/auth/AuthNavigation';

type TrashTab = 'shipments' | 'companies' | 'profiles';

type InactiveShipment = {
  id: string;
  do_number: string;
  origin: string;
  destination: string;
  shipment_type?: string | null;
  current_status?: string | null;
  carrier?: string | null;
  created_at?: string | null;
};

type InactiveCompany = {
  id: string;
  name: string;
  created_at?: string | null;
};

type InactiveProfile = {
  id: string;
  nickname: string | null;
  email: string | null;
  is_internal: boolean;
  created_at?: string | null;
};

export default function TrashScreen() {
  const { t, i18n } = useTranslation();
  const notification = useNativeNotification();
  const { isDesktop } = useResponsive();

  const [activeTab, setActiveTab] = useState<TrashTab>('shipments');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [inactiveShipments, setInactiveShipments] = useState<InactiveShipment[]>([]);
  const [inactiveCompanies, setInactiveCompanies] = useState<InactiveCompany[]>([]);
  const [inactiveProfiles, setInactiveProfiles] = useState<InactiveProfile[]>([]);

  const locale = i18n.language === 'es' ? 'es-CO' : 'en-US';

  const backFunction = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const loadTrashData = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_internal')
        .eq('id', user.id)
        .single();

      if (!profile?.is_internal) {
        notification.error(t('trash.internalOnly'));
        router.replace('/');
        return;
      }

      const [shipmentsRes, companiesRes, profilesRes] = await Promise.all([
        supabase
          .from('shipments')
          .select('id, do_number, origin, destination, shipment_type, current_status, carrier, created_at')
          .eq('status', 'inactive')
          .order('created_at', { ascending: false }),
        supabase
          .from('companies')
          .select('id, name, created_at')
          .eq('status', 'inactive')
          .order('name', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, nickname, email, is_internal, created_at')
          .eq('status', 'inactive')
          .order('created_at', { ascending: false }),
      ]);

      setInactiveShipments((shipmentsRes.data as InactiveShipment[]) || []);
      setInactiveCompanies((companiesRes.data as InactiveCompany[]) || []);
      setInactiveProfiles((profilesRes.data as InactiveProfile[]) || []);
    } catch {
      notification.error(t('trash.loadError'));
    } finally {
      setLoading(false);
    }
  }, [notification, t]);

  useEffect(() => {
    void loadTrashData();
  }, [loadTrashData]);

  // Restaurar carga
  const handleRestoreShipment = async (item: InactiveShipment) => {
    const confirmed = await notification.confirm({
      title: t('trash.restoreTitle'),
      message: t('trash.restoreConfirm', { doNumber: item.do_number }),
      confirmLabel: t('trash.restoreButton'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) return;

    setRestoringId(item.id);
    try {
      const { error } = await supabase.from('shipments').update({ status: 'active' }).eq('id', item.id);
      if (error) throw error;
      notification.success(t('trash.restoreSuccess'));
      setInactiveShipments((prev) => prev.filter((s) => s.id !== item.id));
    } catch {
      notification.error(t('trash.restoreError'));
    } finally {
      setRestoringId(null);
    }
  };

  // Restaurar empresa
  const handleRestoreCompany = async (item: InactiveCompany) => {
    const confirmed = await notification.confirm({
      title: t('trash.restoreTitle'),
      message: t('trash.restoreConfirm', { doNumber: item.name }),
      confirmLabel: t('trash.restoreButton'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) return;

    setRestoringId(item.id);
    try {
      const { error } = await supabase.from('companies').update({ status: 'active' }).eq('id', item.id);
      if (error) throw error;
      notification.success(t('trash.restoreSuccess'));
      setInactiveCompanies((prev) => prev.filter((c) => c.id !== item.id));
    } catch {
      notification.error(t('trash.restoreError'));
    } finally {
      setRestoringId(null);
    }
  };

  // Restaurar perfil
  const handleRestoreProfile = async (item: InactiveProfile) => {
    const name = item.nickname || item.email || item.id;
    const confirmed = await notification.confirm({
      title: t('trash.restoreTitle'),
      message: t('trash.restoreConfirm', { doNumber: name }),
      confirmLabel: t('trash.restoreButton'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) return;

    setRestoringId(item.id);
    try {
      const { error } = await supabase.from('profiles').update({ status: 'active' }).eq('id', item.id);
      if (error) throw error;
      notification.success(t('trash.restoreSuccess'));
      setInactiveProfiles((prev) => prev.filter((p) => p.id !== item.id));
    } catch {
      notification.error(t('trash.restoreError'));
    } finally {
      setRestoringId(null);
    }
  };

  // Filtrado de búsquedas según pestaña activa
  const q = searchQuery.trim().toLowerCase();

  const filteredShipments = useMemo(() => {
    if (!q) return inactiveShipments;
    return inactiveShipments.filter(
      (s) =>
        s.do_number?.toLowerCase().includes(q) ||
        s.origin?.toLowerCase().includes(q) ||
        s.destination?.toLowerCase().includes(q) ||
        s.carrier?.toLowerCase().includes(q),
    );
  }, [inactiveShipments, q]);

  const filteredCompanies = useMemo(() => {
    if (!q) return inactiveCompanies;
    return inactiveCompanies.filter((c) => c.name.toLowerCase().includes(q));
  }, [inactiveCompanies, q]);

  const filteredProfiles = useMemo(() => {
    if (!q) return inactiveProfiles;
    return inactiveProfiles.filter(
      (p) =>
        p.nickname?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q),
    );
  }, [inactiveProfiles, q]);

  return (
    <View style={styles.container}>
      <View style={styles.backgroundBase} />
      <View style={styles.backgroundGlowOne} />
      <View style={styles.backgroundGlowTwo} />

      <Header
        isDesktop={isDesktop}
        title={t('trash.header')}
        showSearch={false}
        onGoBack={backFunction}
      />

      <View
        style={[
          styles.content,
          isDesktop ? styles.contentDesktop : styles.contentMobile,
          !isDesktop && styles.contentWithDock,
        ]}
      >
        {/* Barra de pestañas por entidad */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'shipments' && styles.tabBtnActive]}
            onPress={() => { setActiveTab('shipments'); setSearchQuery(''); }}
          >
            <Ionicons
              name="cube-outline"
              size={16}
              color={activeTab === 'shipments' ? AUTH_COLORS.orange : AUTH_COLORS.secondaryText}
            />
            <Text style={[styles.tabBtnText, activeTab === 'shipments' && styles.tabBtnTextActive]}>
              {t('trash.tabShipments')}
            </Text>
            {inactiveShipments.length > 0 ? (
              <View style={[styles.tabBadge, activeTab === 'shipments' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'shipments' && styles.tabBadgeTextActive]}>
                  {inactiveShipments.length}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'companies' && styles.tabBtnActive]}
            onPress={() => { setActiveTab('companies'); setSearchQuery(''); }}
          >
            <Ionicons
              name="business-outline"
              size={16}
              color={activeTab === 'companies' ? AUTH_COLORS.orange : AUTH_COLORS.secondaryText}
            />
            <Text style={[styles.tabBtnText, activeTab === 'companies' && styles.tabBtnTextActive]}>
              {t('trash.tabCompanies')}
            </Text>
            {inactiveCompanies.length > 0 ? (
              <View style={[styles.tabBadge, activeTab === 'companies' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'companies' && styles.tabBadgeTextActive]}>
                  {inactiveCompanies.length}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'profiles' && styles.tabBtnActive]}
            onPress={() => { setActiveTab('profiles'); setSearchQuery(''); }}
          >
            <Ionicons
              name="people-outline"
              size={16}
              color={activeTab === 'profiles' ? AUTH_COLORS.orange : AUTH_COLORS.secondaryText}
            />
            <Text style={[styles.tabBtnText, activeTab === 'profiles' && styles.tabBtnTextActive]}>
              {t('trash.tabProfiles')}
            </Text>
            {inactiveProfiles.length > 0 ? (
              <View style={[styles.tabBadge, activeTab === 'profiles' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'profiles' && styles.tabBadgeTextActive]}>
                  {inactiveProfiles.length}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* Barra de búsqueda interna */}
        <View style={styles.searchBarWrap}>
          <Ionicons name="search-outline" size={18} color={AUTH_COLORS.secondaryText} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('trash.searchPlaceholder')}
            placeholderTextColor={AUTH_COLORS.secondaryText}
          />
          {searchQuery.trim() ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={AUTH_COLORS.secondaryText} />
            </TouchableOpacity>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={AUTH_COLORS.orange} />
          </View>
        ) : activeTab === 'shipments' ? (
          <FlatList
            data={filteredShipments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={44} color={AUTH_COLORS.line} />
                <Text style={styles.emptyTitle}>
                  {searchQuery.trim() ? t('trash.noResults') : t('trash.emptyTitle')}
                </Text>
                <Text style={styles.emptySubtitle}>{t('trash.emptySubtitle')}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.card, styles.shadowCard]}>
                <View style={styles.cardMain}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitleText}>{item.do_number}</Text>
                    <ShipmentTransportBadge
                      shipment={item as any}
                      shipmentType={item.shipment_type}
                      color={AUTH_COLORS.primaryText}
                      size={18}
                      containerStyle={styles.iconBadge}
                    />
                  </View>

                  <Text style={styles.cardSubText}>
                    {item.origin} → {item.destination}
                  </Text>

                  <View style={styles.cardMetaRow}>
                    {item.current_status ? (
                      <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>{getShipmentStatusLabel(item.current_status, t)}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.dateText}>
                      {t('trash.createdAt')} {formatDateDisplay(item.created_at, locale)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.restoreButton}
                  onPress={() => handleRestoreShipment(item)}
                  disabled={restoringId === item.id}
                >
                  {restoringId === item.id ? (
                    <ActivityIndicator size="small" color={AUTH_COLORS.primaryText} />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={17} color={AUTH_COLORS.primaryText} />
                      <Text style={styles.restoreButtonText}>{t('trash.restoreAction')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          />
        ) : activeTab === 'companies' ? (
          <FlatList
            data={filteredCompanies}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="business-outline" size={44} color={AUTH_COLORS.line} />
                <Text style={styles.emptyTitle}>
                  {searchQuery.trim() ? t('trash.noResults') : t('trash.emptyTitle')}
                </Text>
                <Text style={styles.emptySubtitle}>{t('trash.emptySubtitle')}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.card, styles.shadowCard]}>
                <View style={styles.cardMain}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.companyIconWrap}>
                      <Ionicons name="business-outline" size={18} color={AUTH_COLORS.orange} />
                    </View>
                    <Text style={styles.cardTitleText}>{item.name}</Text>
                  </View>

                  <View style={styles.cardMetaRow}>
                    <Text style={styles.dateText}>
                      {t('trash.createdAt')} {formatDateDisplay(item.created_at, locale)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.restoreButton}
                  onPress={() => handleRestoreCompany(item)}
                  disabled={restoringId === item.id}
                >
                  {restoringId === item.id ? (
                    <ActivityIndicator size="small" color={AUTH_COLORS.primaryText} />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={17} color={AUTH_COLORS.primaryText} />
                      <Text style={styles.restoreButtonText}>{t('trash.restoreAction')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          />
        ) : (
          <FlatList
            data={filteredProfiles}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={44} color={AUTH_COLORS.line} />
                <Text style={styles.emptyTitle}>
                  {searchQuery.trim() ? t('trash.noResults') : t('trash.emptyTitle')}
                </Text>
                <Text style={styles.emptySubtitle}>{t('trash.emptySubtitle')}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.card, styles.shadowCard]}>
                <View style={styles.cardMain}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.userIconWrap}>
                      <Ionicons name="person-outline" size={18} color={AUTH_COLORS.blue} />
                    </View>
                    <Text style={styles.cardTitleText}>{item.nickname || item.email || item.id}</Text>
                  </View>

                  {item.email ? <Text style={styles.cardSubText}>{item.email}</Text> : null}

                  <View style={styles.cardMetaRow}>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>
                        {item.is_internal ? t('profiles.internalRole') : t('profiles.externalRole')}
                      </Text>
                    </View>
                    <Text style={styles.dateText}>
                      {t('trash.createdAt')} {formatDateDisplay(item.created_at, locale)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.restoreButton}
                  onPress={() => handleRestoreProfile(item)}
                  disabled={restoringId === item.id}
                >
                  {restoringId === item.id ? (
                    <ActivityIndicator size="small" color={AUTH_COLORS.primaryText} />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={17} color={AUTH_COLORS.primaryText} />
                      <Text style={styles.restoreButtonText}>{t('trash.restoreAction')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, backgroundColor: AUTH_COLORS.backgroundBottom },
  backgroundBase: { ...StyleSheet.absoluteFillObject, backgroundColor: AUTH_COLORS.backgroundBottom },
  backgroundGlowOne: { position: 'absolute', top: -120, left: -50, width: 260, height: 260, borderRadius: 999, backgroundColor: 'rgba(199, 138, 75, 0.18)' },
  backgroundGlowTwo: { position: 'absolute', top: 40, right: -70, width: 280, height: 280, borderRadius: 999, backgroundColor: 'rgba(79, 104, 142, 0.18)' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, gap: 14 },
  contentDesktop: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 64, maxWidth: 1200, alignSelf: 'center', width: '100%' },
  contentMobile: { paddingHorizontal: 14, paddingTop: 14 },
  contentWithDock: { paddingBottom: AUTH_MOBILE_DOCK_PADDING },

  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  tabBtn: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  tabBtnActive: {
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderColor: AUTH_COLORS.orangeBorder,
  },
  tabBtnText: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  tabBtnTextActive: {
    color: AUTH_COLORS.orange,
  },
  tabBadge: {
    height: 20,
    minWidth: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: AUTH_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeActive: {
    backgroundColor: AUTH_COLORS.orange,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: AUTH_COLORS.secondaryText,
    lineHeight: 12,
  },
  tabBadgeTextActive: {
    color: '#ffffff',
  },

  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  searchInput: {
    flex: 1,
    color: AUTH_COLORS.primaryText,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },

  listContainer: { gap: 12, paddingBottom: 28 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 20,
    backgroundColor: AUTH_COLORS.surface,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    gap: 12,
  },
  cardMain: { flex: 1, minWidth: 0, gap: 6 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitleText: { color: AUTH_COLORS.primaryText, fontSize: FONT_SIZE.base + 1, fontWeight: FONT_WEIGHT.bold },
  cardSubText: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.xs + 1, fontWeight: FONT_WEIGHT.medium },
  iconBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: AUTH_COLORS.orangeSoft, borderWidth: 1, borderColor: AUTH_COLORS.orangeBorder, alignItems: 'center', justifyContent: 'center' },
  companyIconWrap: { width: 30, height: 30, borderRadius: 10, backgroundColor: AUTH_COLORS.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  userIconWrap: { width: 30, height: 30, borderRadius: 10, backgroundColor: AUTH_COLORS.blueSoft, alignItems: 'center', justifyContent: 'center' },
  docIconWrap: { width: 30, height: 30, borderRadius: 10, backgroundColor: AUTH_COLORS.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  statusPill: { height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: AUTH_COLORS.surfaceAlt, borderWidth: 1, borderColor: AUTH_COLORS.line, alignItems: 'center', justifyContent: 'center' },
  statusPillText: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.xs - 1, fontWeight: FONT_WEIGHT.bold, lineHeight: 14 },
  dateText: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.xs - 1 },

  restoreButton: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
  },
  restoreButtonText: {
    color: AUTH_COLORS.primaryText,
    fontSize: FONT_SIZE.xs + 1,
    fontWeight: FONT_WEIGHT.bold,
  },

  emptyState: { marginTop: 48, padding: 32, borderRadius: 24, backgroundColor: AUTH_COLORS.surfaceSoft, alignItems: 'center', gap: 12 },
  emptyTitle: { color: AUTH_COLORS.primaryText, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  emptySubtitle: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },

  shadowCard: { shadowColor: AUTH_COLORS.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 4 },
});
