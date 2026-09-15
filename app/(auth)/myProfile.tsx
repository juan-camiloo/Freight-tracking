// Archivo: app/(auth)/myProfile.tsx
// Pantalla de perfil personal del usuario (MyProfile).
// Permite consultar datos personales, editar nickname, ver empresa(s) asignadas,
// y explorar miembros y cargas asociadas al tocar la tarjeta de empresa.

import Header from '@/components/Header';
import { AuthSearchBar } from '@/components/auth/AuthSearchBar';
import { ShipmentTransportBadge } from '@/components/auth/ShipmentTransportIcon';
import { COLORS } from '@/components/ui/COLORS';
import { useNativeNotification } from '@/components/ui/NativeNotification';
import { useResponsive } from '@/hooks/useResponsive';
import { getShipmentStatusLabel } from '@/lib/shipmentType';
import { supportModal } from '@/lib/supportModal';
import { supabase } from '@/lib/URLs';
import { formatDateDisplay } from '@/utils/dateFormatting';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
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

type UserProfile = {
  id: string;
  email: string;
  nickname: string | null;
  is_internal: boolean;
  company_id: string | null;
  created_at?: string;
};

type CompanyInfo = {
  id: string;
  name: string;
  created_at: string;
  member_count?: number;
  shipment_count?: number;
};

type CompanyMember = {
  id: string;
  email: string | null;
  nickname: string | null;
  is_internal: boolean;
};

type CompanyShipment = {
  id: string;
  do_number: string;
  origin: string;
  destination: string;
  shipment_type?: string | null;
  current_status?: string | null;
  eta?: string | null;
};

export default function MyProfileScreen() {
  const { t } = useTranslation();
  const notification = useNativeNotification();
  const { height, isDesktop } = useResponsive();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Edición de nickname
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [savingNickname, setSavingNickname] = useState(false);

  // Empresas asignadas
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // Modal de detalle de empresa al hacer click en el card
  const [selectedCompany, setSelectedCompany] = useState<CompanyInfo | null>(null);
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([]);
  const [companyShipments, setCompanyShipments] = useState<CompanyShipment[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [shipmentSearchQuery, setShipmentSearchQuery] = useState('');
  const [loadingCompanyDetails, setLoadingCompanyDetails] = useState(false);
  const [modalActiveTab, setModalActiveTab] = useState<'members' | 'shipments'>('members');

  const filteredCompanyMembers = useMemo(() => {
    const q = memberSearchQuery.trim().toLowerCase();
    if (!q) return companyMembers;
    return companyMembers.filter(
      (m) =>
        (m.nickname && m.nickname.toLowerCase().includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q)),
    );
  }, [companyMembers, memberSearchQuery]);

  const filteredCompanyShipments = useMemo(() => {
    const q = shipmentSearchQuery.trim().toLowerCase();
    if (!q) return companyShipments;
    return companyShipments.filter(
      (s) =>
        (s.do_number && s.do_number.toLowerCase().includes(q)) ||
        (s.origin && s.origin.toLowerCase().includes(q)) ||
        (s.destination && s.destination.toLowerCase().includes(q)) ||
        (s.current_status && s.current_status.toLowerCase().includes(q)),
    );
  }, [companyShipments, shipmentSearchQuery]);

  const loadUserData = useCallback(async () => {
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

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData);
      setNicknameDraft(profileData.nickname || '');

      // Cargar empresa(s) asignadas
      if (profileData.company_id) {
        setLoadingCompanies(true);
        const { data: companyData } = await supabase
          .from('companies')
          .select('id, name, created_at')
          .eq('id', profileData.company_id);

        if (companyData && companyData.length > 0) {
          // Obtener conteos de miembros y cargas
          const enriched = await Promise.all(
            companyData.map(async (c) => {
              const [{ count: membersCount }, { count: shipmentsCount }] = await Promise.all([
                supabase
                  .from('profiles')
                  .select('id', { count: 'exact', head: true })
                  .eq('company_id', c.id),
                supabase
                  .from('company_shipment')
                  .select('shipment_id', { count: 'exact', head: true })
                  .eq('company_id', c.id),
              ]);
              return {
                ...c,
                member_count: membersCount ?? 0,
                shipment_count: shipmentsCount ?? 0,
              };
            }),
          );
          setCompanies(enriched);
        } else {
          setCompanies([]);
        }
      } else if (profileData.is_internal) {
        // Si es usuario interno y no tiene una empresa fija ligada, cargamos las empresas registradas para consulta
        setLoadingCompanies(true);
        const { data: allCompanies } = await supabase
          .from('companies')
          .select('id, name, created_at')
          .order('name', { ascending: true })
          .limit(10);

        if (allCompanies) {
          const enriched = await Promise.all(
            allCompanies.map(async (c) => {
              const [{ count: membersCount }, { count: shipmentsCount }] = await Promise.all([
                supabase
                  .from('profiles')
                  .select('id', { count: 'exact', head: true })
                  .eq('company_id', c.id),
                supabase
                  .from('company_shipment')
                  .select('shipment_id', { count: 'exact', head: true })
                  .eq('company_id', c.id),
              ]);
              return {
                ...c,
                member_count: membersCount ?? 0,
                shipment_count: shipmentsCount ?? 0,
              };
            }),
          );
          setCompanies(enriched);
        }
      } else {
        setCompanies([]);
      }
    } catch {
      notification.error(t('profileDetail.loadError'));
    } finally {
      setLoading(false);
      setLoadingCompanies(false);
    }
  }, [notification, t]);

  useEffect(() => {
    void loadUserData();
  }, [loadUserData]);

  // Guardar cambio de Nickname
  const handleSaveNickname = async () => {
    const clean = nicknameDraft.trim();
    if (!clean) {
      notification.error(t('myProfile.nicknameEmpty'));
      return;
    }

    if (!profile) return;

    setSavingNickname(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ nickname: clean })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile((prev) => (prev ? { ...prev, nickname: clean } : null));
      setIsEditingNickname(false);
      notification.success(t('myProfile.nicknameUpdated'));
    } catch {
      notification.error(t('myProfile.nicknameError'));
    } finally {
      setSavingNickname(false);
    }
  };

  // Al hacer click en el card de empresa: cargar miembros y cargas
  const handleOpenCompanyCard = async (comp: CompanyInfo) => {
    setSelectedCompany(comp);
    setMemberSearchQuery('');
    setShipmentSearchQuery('');
    setLoadingCompanyDetails(true);
    setModalActiveTab('members');

    try {
      const [membersRes, shipmentsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, nickname, is_internal')
          .eq('company_id', comp.id)
          .order('nickname', { ascending: true }),
        supabase
          .from('company_shipment')
          .select('shipments(id, do_number, origin, destination, shipment_type, current_status, eta)')
          .eq('company_id', comp.id),
      ]);

      setCompanyMembers((membersRes.data as CompanyMember[]) ?? []);

      const rawShipments = (shipmentsRes.data ?? [])
        .map((row: any) => row.shipments)
        .filter(Boolean) as CompanyShipment[];
      setCompanyShipments(rawShipments);
    } catch {
      notification.error(t('companies.loadError'));
    } finally {
      setLoadingCompanyDetails(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const backFunction = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (loading) {
    return (
      <View style={[styles.center, styles.container]}>
        <AuthScreenBackground />
        <ActivityIndicator size="large" color={AUTH_COLORS.orange} />
      </View>
    );
  }

  const roleLabel = profile?.is_internal ? t('sidebar.internalRole') : t('sidebar.clientRole');

  return (
    <View style={styles.container}>
      <AuthScreenBackground />
      <Header
        title={t('myProfile.headerTitle')}
        isDesktop={isDesktop}
        showSearch={false}
        onGoBack={backFunction}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          isDesktop ? styles.contentDesktop : styles.contentMobile,
          !isDesktop && styles.contentWithDock,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* TARJETA 1: INFORMACIÓN PERSONAL & NICKNAME */}
        <View style={[styles.card, styles.shadowCard, isDesktop && styles.cardDesktop]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.cardTitle}>{t('profileDetail.sectionInfo')}</Text>
              <Text style={styles.cardSubtitle}>
                {t('myProfile.accountSubtitle')}
              </Text>
            </View>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>{roleLabel}</Text>
            </View>
          </View>

          <View style={styles.infoFieldsGrid}>
            {/* Campo Correo (Solo Lectura) */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t('profileDetail.email')}</Text>
              <View style={styles.readOnlyBox}>
                <Ionicons name="mail-outline" size={16} color={AUTH_COLORS.secondaryText} />
                <Text style={styles.readOnlyText}>{profile?.email || 'Sin correo'}</Text>
              </View>
            </View>

            {/* Campo Nickname (Editable) */}
            <View style={styles.fieldBlock}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>{t('addUser.nicknameLabel')}</Text>
                {!isEditingNickname ? (
                  <TouchableOpacity
                    onPress={() => setIsEditingNickname(true)}
                    style={styles.editLinkBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="pencil-outline" size={13} color={COLORS.orange} />
                    <Text style={styles.editLinkText}>{t('common.change')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {isEditingNickname ? (
                <View style={styles.editNicknameBox}>
                  <TextInput
                    style={styles.nicknameInput}
                    value={nicknameDraft}
                    onChangeText={setNicknameDraft}
                    placeholder={t('myProfile.nicknamePlaceholder')}
                    placeholderTextColor={AUTH_COLORS.secondaryText}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSaveNickname}
                  />
                  <View style={styles.editActionsRow}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => {
                        setNicknameDraft(profile?.nickname || '');
                        setIsEditingNickname(false);
                      }}
                      disabled={savingNickname}
                    >
                      <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveBtn, savingNickname && styles.saveBtnDisabled]}
                      onPress={handleSaveNickname}
                      disabled={savingNickname}
                    >
                      <Ionicons name="checkmark-outline" size={15} color={COLORS.primaryText} />
                      <Text style={styles.saveBtnText}>
                        {savingNickname ? t('common.loading') : t('common.save')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.readOnlyBox}>
                  <Ionicons name="person-outline" size={16} color={COLORS.orange} />
                  <Text style={[styles.readOnlyText, styles.nicknameDisplay]}>
                    {profile?.nickname || t('profiles.unnamedProfile')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* TARJETA 2: EMPRESA O EMPRESAS ASIGNADAS */}
        <View style={[styles.card, styles.shadowCard, isDesktop && styles.cardDesktop]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.cardTitle}>
                {profile?.is_internal
                  ? t('companies.header')
                  : t('myProfile.assignedCompany')}
              </Text>
              <Text style={styles.cardSubtitle}>
                {t('myProfile.companyCardsHint')}
              </Text>
            </View>
          </View>

          {loadingCompanies ? (
            <View style={styles.loadingArea}>
              <ActivityIndicator color={COLORS.orange} />
            </View>
          ) : companies.length === 0 ? (
            <View style={styles.emptyCardBox}>
              <Ionicons name="business-outline" size={32} color={AUTH_COLORS.secondaryText} />
              <Text style={styles.emptyCardTitle}>
                  {t('myProfile.noCompany')}
                </Text>
              <Text style={styles.emptyCardSubtitle}>
                {t('myProfile.noCompanyHint')}
              </Text>
            </View>
          ) : (
            <View style={styles.companiesGrid}>
              {companies.map((comp) => (
                <TouchableOpacity
                  key={comp.id}
                  style={styles.companyCard}
                  onPress={() => handleOpenCompanyCard(comp)}
                  activeOpacity={0.8}
                >
                  <View style={styles.companyCardHeader}>
                    <View style={styles.companyIconBox}>
                      <Ionicons name="business" size={20} color={COLORS.orange} />
                    </View>
                    <View style={styles.companyHeaderCopy}>
                      <Text style={styles.companyNameText} numberOfLines={1}>
                        {comp.name}
                      </Text>
                      <Text style={styles.companyMetaText}>
                        Registrada: {formatDateDisplay(comp.created_at)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={AUTH_COLORS.secondaryText} />
                  </View>

                  <View style={styles.companyStatsRow}>
                    <View style={styles.statPill}>
                      <Ionicons name="people-outline" size={14} color={COLORS.blue} />
                      <Text style={styles.statPillText}>
                        {comp.member_count ?? 0} {t('navigation.profiles')}
                      </Text>
                    </View>
                    <View style={styles.statPill}>
                      <Ionicons name="cube-outline" size={14} color={COLORS.orange} />
                      <Text style={styles.statPillText}>
                        {comp.shipment_count ?? 0} {t('dashboard.shipments')}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* TARJETA 3: ACCIONES DE CUENTA / CERRAR SESIÓN */}
        <View style={[styles.card, styles.shadowCard, isDesktop && styles.cardDesktop, styles.accountCard]}>
          <TouchableOpacity
            style={styles.supportProfileItem}
            onPress={() => supportModal.open()}
            activeOpacity={0.8}
          >
            <View style={styles.supportProfileLead}>
              <View style={styles.supportProfileIconWrap}>
                <Ionicons name="headset-outline" size={18} color={COLORS.orange} />
              </View>
              <View style={styles.supportProfileCopy}>
                <Text style={styles.supportProfileTitle}>
                  {t('supportModal.title') || 'Soporte y Tickets'}
                </Text>
                <Text style={styles.supportProfileSubtitle} numberOfLines={1}>
                  {t('supportModal.subtitle') || 'Consulta el estado de tus solicitudes o crea una nueva'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={AUTH_COLORS.secondaryText} />
          </TouchableOpacity>

          <View style={styles.accountDivider} />

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color={AUTH_COLORS.danger} />
            <Text style={styles.logoutButtonText}>{t('auth.logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MODAL DE DETALLE DE EMPRESA: MIEMBROS Y CARGAS */}
      <Modal
        visible={Boolean(selectedCompany)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCompany(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, isDesktop && styles.modalCardDesktop]}>
            {/* Cabecera del modal */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLead}>
                <View style={styles.modalCompanyIcon}>
                  <Ionicons name="business-outline" size={22} color={COLORS.orange} />
                </View>
                <View>
                  <Text style={styles.modalCompanyTitle}>{selectedCompany?.name}</Text>
                  <Text style={styles.modalCompanySubtitle}>
                    {t('myProfile.modalSub')}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedCompany(null)}
                style={styles.closeModalBtn}
              >
                <Ionicons name="close" size={20} color={AUTH_COLORS.secondaryText} />
              </TouchableOpacity>
            </View>

            {/* Selector de pestañas: Miembros vs Cargas */}
            <View style={styles.modalTabsRow}>
              <TouchableOpacity
                style={[styles.modalTab, modalActiveTab === 'members' && styles.modalTabActive]}
                onPress={() => setModalActiveTab('members')}
              >
                <Ionicons
                  name="people-outline"
                  size={16}
                  color={modalActiveTab === 'members' ? COLORS.orange : AUTH_COLORS.secondaryText}
                />
                <Text style={[styles.modalTabText, modalActiveTab === 'members' && styles.modalTabTextActive]}>
                  Miembros ({companyMembers.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalTab, modalActiveTab === 'shipments' && styles.modalTabActive]}
                onPress={() => setModalActiveTab('shipments')}
              >
                <Ionicons
                  name="cube-outline"
                  size={16}
                  color={modalActiveTab === 'shipments' ? COLORS.orange : AUTH_COLORS.secondaryText}
                />
                <Text style={[styles.modalTabText, modalActiveTab === 'shipments' && styles.modalTabTextActive]}>
                  Cargas Asignadas ({companyShipments.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Buscador dentro del modal según pestaña */}
            {modalActiveTab === 'members' ? (
              <AuthSearchBar
                value={memberSearchQuery}
                onChangeText={setMemberSearchQuery}
                placeholder={t('companies.searchMembersPlaceholder')}
              />
            ) : (
              <AuthSearchBar
                value={shipmentSearchQuery}
                onChangeText={setShipmentSearchQuery}
                placeholder={t('dashboard.searchPlaceholder')}
              />
            )}

            {/* Contenido del modal */}
            <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
              {loadingCompanyDetails ? (
                <View style={styles.loadingArea}>
                  <ActivityIndicator color={COLORS.orange} />
                </View>
              ) : modalActiveTab === 'members' ? (
                companyMembers.length === 0 ? (
                  <View style={styles.emptyList}>
                    <Text style={styles.emptyListText}>{t('companies.noMembers')}</Text>
                  </View>
                ) : filteredCompanyMembers.length === 0 ? (
                  <View style={styles.emptyList}>
                    <Text style={styles.emptyListText}>{t('companies.noMembersFound')}</Text>
                  </View>
                ) : (
                  <View style={styles.membersList}>
                    {filteredCompanyMembers.map((m) => (
                      <View key={m.id} style={styles.memberRowCard}>
                        <View style={styles.memberInfoCopy}>
                          <Text style={styles.memberName}>{m.nickname || m.email?.split('@')[0] || t('common.user')}</Text>
                          <Text style={styles.memberEmail}>{m.email}</Text>
                        </View>
                        <View style={styles.memberRoleBadge}>
                          <Text style={styles.memberRoleText}>
                            {m.is_internal ? t('sidebar.internalRole') : t('sidebar.clientRole')}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )
              ) : companyShipments.length === 0 ? (
                <View style={styles.emptyList}>
                  <Text style={styles.emptyListText}>{t('companies.noShipments')}</Text>
                </View>
              ) : filteredCompanyShipments.length === 0 ? (
                <View style={styles.emptyList}>
                  <Text style={styles.emptyListText}>{t('companies.noShipmentsFound')}</Text>
                </View>
              ) : (
                <View style={styles.shipmentsList}>
                  {filteredCompanyShipments.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={styles.shipmentRowCard}
                      onPress={() => {
                        setSelectedCompany(null);
                        router.push(`/shipment/${s.id}`);
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={styles.shipmentLead}>
                        <ShipmentTransportBadge
                          shipment={s as any}
                          shipmentType={s.shipment_type || 'maritime'}
                          size={18}
                          color={COLORS.orange}
                        />
                        <View style={styles.shipmentCopy}>
                          <Text style={styles.shipmentDo}>{s.do_number}</Text>
                          <Text style={styles.shipmentRoute}>
                            {s.origin} ➔ {s.destination}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.shipmentTail}>
                        <View style={styles.shipmentStatusPill}>
                          <Text style={styles.shipmentStatusText}>{getShipmentStatusLabel(s.current_status, t)}</Text>
                        </View>
                        <Ionicons name="open-outline" size={16} color={AUTH_COLORS.secondaryText} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  scroll: { flex: 1, minHeight: 0 },
  content: {
    gap: 20,
    paddingBottom: 32,
  },
  contentDesktop: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 64,
    alignItems: 'center',
  },
  contentMobile: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  contentWithDock: {
    paddingBottom: AUTH_MOBILE_DOCK_PADDING,
  },
  card: {
    width: '100%',
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    padding: 20,
    gap: 16,
  },
  cardDesktop: {
    maxWidth: 780,
    padding: 26,
  },
  accountCard: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportProfileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  supportProfileLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  supportProfileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(199, 138, 75, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportProfileCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  supportProfileTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 14,
    fontWeight: '700',
  },
  supportProfileSubtitle: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 12,
  },
  accountDivider: {
    height: 1,
    backgroundColor: AUTH_COLORS.line,
    width: '100%',
    marginVertical: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  logoutButtonText: {
    color: AUTH_COLORS.danger,
    fontSize: 15,
    fontWeight: '700',
  },
  shadowCard: AUTH_SHADOW,
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitleWrap: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 20,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  roleTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(199, 138, 75, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(199, 138, 75, 0.35)',
  },
  roleTagText: {
    color: COLORS.orange,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  infoFieldsGrid: {
    gap: 14,
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: AUTH_COLORS.secondaryText,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  readOnlyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  readOnlyText: {
    color: AUTH_COLORS.primaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  nicknameDisplay: {
    color: COLORS.orange,
    fontWeight: '700',
  },
  editLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editLinkText: {
    color: COLORS.orange,
    fontSize: 12,
    fontWeight: '700',
  },
  editNicknameBox: {
    gap: 10,
  },
  nicknameInput: {
    borderWidth: 1,
    borderColor: COLORS.orangeBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    fontSize: 15,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    color: AUTH_COLORS.primaryText,
    minHeight: 46,
  },
  editActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 241, 234, 0.08)',
  },
  cancelBtnText: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.orangeSoft,
    borderWidth: 1,
    borderColor: COLORS.orangeBorder,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: COLORS.primaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  loadingArea: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCardBox: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyCardTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyCardSubtitle: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 380,
  },
  companiesGrid: {
    gap: 12,
  },
  companyCard: {
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    padding: 16,
    gap: 12,
  },
  companyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  companyIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(199, 138, 75, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  companyNameText: {
    color: AUTH_COLORS.primaryText,
    fontSize: 16,
    fontWeight: '800',
  },
  companyMetaText: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 11,
  },
  companyStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 241, 234, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245, 241, 234, 0.1)',
  },
  statPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: AUTH_COLORS.primaryText,
  },

  // Modal de Detalle
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  modalCardDesktop: {
    maxWidth: 680,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: AUTH_COLORS.line,
  },
  modalHeaderLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalCompanyIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(199, 138, 75, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCompanyTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 18,
    fontWeight: '800',
  },
  modalCompanySubtitle: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 12,
  },
  closeModalBtn: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: AUTH_COLORS.surfaceAlt,
  },
  modalTabsRow: {
    flexDirection: 'row',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: AUTH_COLORS.line,
    paddingBottom: 4,
  },
  modalTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  modalTabActive: {
    backgroundColor: 'rgba(199, 138, 75, 0.15)',
  },
  modalTabText: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  modalTabTextActive: {
    color: COLORS.orange,
    fontWeight: '800',
  },
  modalBodyScroll: {
    maxHeight: 380,
  },
  emptyList: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyListText: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
  },
  membersList: {
    gap: 8,
    paddingVertical: 4,
  },
  memberRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  memberInfoCopy: {
    gap: 2,
    flex: 1,
  },
  memberName: {
    color: AUTH_COLORS.primaryText,
    fontSize: 14,
    fontWeight: '700',
  },
  memberEmail: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 12,
  },
  memberRoleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 241, 234, 0.08)',
  },
  memberRoleText: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 11,
    fontWeight: '700',
  },
  shipmentsList: {
    gap: 8,
    paddingVertical: 4,
  },
  shipmentRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  shipmentLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  shipmentCopy: {
    gap: 2,
  },
  shipmentDo: {
    color: AUTH_COLORS.primaryText,
    fontSize: 14,
    fontWeight: '700',
  },
  shipmentRoute: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 12,
  },
  shipmentTail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shipmentStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(199, 138, 75, 0.15)',
  },
  shipmentStatusText: {
    color: COLORS.orange,
    fontSize: 11,
    fontWeight: '700',
  },
});
