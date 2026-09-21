// Archivo: app/(auth)/profile/[id].tsx
// Descripcion: Pantalla de detalle de perfil. Muestra datos basicos, empresa asignada
// y permite gestionar la empresa del usuario y sus cargas.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
} from '../../../components/auth/AuthChrome';
import { AUTH_MOBILE_DOCK_PADDING, toggleLanguage } from '../../../components/auth/AuthNavigation';
import { AuthSearchBar } from '../../../components/auth/AuthSearchBar';
import Header from '../../../components/Header';
import { useNativeNotification } from '../../../components/ui/NativeNotification';
import { useResponsive } from '../../../hooks/useResponsive';
import { supabase } from '../../../lib/URLs';

type Profile = {
  id: string;
  email: string;
  is_internal: boolean;
  nickname: string;
  company_id?: string | null;
};

type Company = {
  id: string;
  name: string;
};

export default function ProfileDetail() {
  const { t } = useTranslation();
  const notification = useNativeNotification();
  const { id } = useLocalSearchParams();
  const { height, isDesktop } = useResponsive();
  const profileId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';

  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  // Estado para modal de cambio/asignación de empresa
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

  // Estado para eliminar perfil
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deletingProfile, setDeletingProfile] = useState(false);

  // Estado para edición de alias (nickname)
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);

  const filteredCompanies = useMemo(() => {
    const q = companySearchQuery.trim().toLowerCase();
    if (!q) return allCompanies;
    return allCompanies.filter((c) => c.name.toLowerCase().includes(q));
  }, [allCompanies, companySearchQuery]);

  useEffect(() => {
    void loadProfileDetails();
  }, [id]);

  const loadProfileDetails = async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/login');
        return;
      }
      setCurrentUserId(user.id);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);
      setNicknameDraft(profileData.nickname || '');

      // Cargar datos de empresa si el perfil tiene company_id
      if (profileData.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('id, name')
          .eq('id', profileData.company_id)
          .single();
        setCompany(companyData ?? null);
      } else {
        setCompany(null);
      }
    } catch {
      notification.error(t('profileDetail.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNickname = async () => {
    const clean = nicknameDraft.trim();
    if (!clean) {
      notification.error(t('profileDetail.nicknameEmpty', { defaultValue: 'El alias no puede estar vacío' }));
      return;
    }

    if (!profile) return;

    setSavingNickname(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ nickname: clean })
        .eq('id', profileId);

      if (error) throw error;

      setProfile((prev) => (prev ? { ...prev, nickname: clean } : null));
      setIsEditingNickname(false);
      notification.success(t('profileDetail.nicknameUpdated', { defaultValue: 'Alias actualizado correctamente' }));
    } catch {
      notification.error(t('profileDetail.nicknameError', { defaultValue: 'No se pudo actualizar el alias' }));
    } finally {
      setSavingNickname(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!profile) return;
    if (currentUserId === profile.id) {
      notification.error(t('profileDetail.cannotDeleteSelf', { defaultValue: 'No puedes eliminar tu propio perfil' }));
      return;
    }

    const name = profile.nickname || profile.email || profile.id;
    const confirmed = await notification.confirm({
      title: t('profileDetail.deleteTitle', { defaultValue: 'Enviar a papelera' }),
      message: t('profileDetail.deleteConfirm', {
        name,
        defaultValue: `¿Estás seguro de mover el perfil de "${name}" a la papelera del sistema?`,
      }),
      confirmLabel: t('common.delete', { defaultValue: 'Mover a papelera' }),
      cancelLabel: t('common.cancel', { defaultValue: 'Cancelar' }),
      destructive: true,
    });

    if (!confirmed) return;

    setDeletingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'inactive' })
        .eq('id', profileId);

      if (error) throw error;

      notification.success(t('profileDetail.deleteSuccess', { defaultValue: 'Perfil movido a la papelera' }));
      router.replace('/profiles' as any);
    } catch {
      notification.error(t('profileDetail.deleteError', { defaultValue: 'No se pudo mover el perfil a la papelera' }));
      setDeletingProfile(false);
    }
  };

  const handleOpenCompanyModal = async () => {
    setCompanySearchQuery('');
    setShowCompanyModal(true);
    setLoadingCompanies(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .order('name', { ascending: true });
      if (error) throw error;
      setAllCompanies(data ?? []);
    } catch {
      notification.error(t('companies.loadError'));
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleSelectCompany = async (targetCompanyId: string | null) => {
    setSavingCompany(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ company_id: targetCompanyId })
        .eq('id', profileId);

      if (error) throw error;

      notification.success(
        targetCompanyId
          ? t('companies.memberAssigned')
          : t('companies.memberUnlinked'),
      );

      setShowCompanyModal(false);
      void loadProfileDetails();
    } catch {
      notification.error(t('companies.updateError'));
    } finally {
      setSavingCompany(false);
    }
  };

  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/profiles');
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, styles.container]}>
        <AuthScreenBackground />
        <ActivityIndicator size="large" color={AUTH_COLORS.orange} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.center, styles.container]}>
        <AuthScreenBackground />
        <Text style={styles.emptyText}>{t('profileDetail.notFound')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AuthScreenBackground />
      <Header
        isDesktop={isDesktop}
        title={t('profileDetail.headerTitle')}
        showSearch={false}
        onGoBack={backFunction}
        onToggleLanguage={toggleLanguage}
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
        <View style={[styles.heroCard, styles.shadowCard]}>
          <View style={styles.heroBadge}>
            <Ionicons
              name={profile.is_internal ? 'shield-checkmark-outline' : 'person-outline'}
              size={26}
              color={profile.is_internal ? AUTH_COLORS.green : AUTH_COLORS.blue}
            />
          </View>
          <Text style={styles.heroTitle}>{profile.nickname || t('profiles.unnamedProfile')}</Text>
          <Text style={styles.heroSubtitle}>{profile.email}</Text>

          <View style={[styles.rolePill, profile.is_internal ? styles.rolePillInternal : styles.rolePillExternal]}>
            <Text style={[styles.rolePillText, profile.is_internal ? styles.rolePillTextInternal : styles.rolePillTextExternal]}>
              {profile.is_internal ? t('profiles.internalRole') : t('profiles.externalRole')}
            </Text>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={[styles.section, styles.shadowCard]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('profileDetail.sectionInfo')}</Text>
              {!isEditingNickname ? (
                <TouchableOpacity
                  style={styles.editCompanyButton}
                  onPress={() => {
                    setNicknameDraft(profile.nickname || '');
                    setIsEditingNickname(true);
                  }}
                >
                  <Ionicons name="create-outline" size={15} color={AUTH_COLORS.orange} />
                  <Text style={styles.editCompanyButtonText}>
                    {t('common.edit', { defaultValue: 'Editar' })}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <InfoRow label={t('profileDetail.email')} value={profile.email || ''} />

            {isEditingNickname ? (
              <View style={styles.editNicknameContainer}>
                <Text style={styles.infoLabel}>{t('profileDetail.alias')}</Text>
                <TextInput
                  style={styles.nicknameInput}
                  value={nicknameDraft}
                  onChangeText={setNicknameDraft}
                  placeholder={t('profileDetail.nicknamePlaceholder', { defaultValue: 'Ingresa el alias...' })}
                  placeholderTextColor={AUTH_COLORS.secondaryText}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveNickname}
                />
                <View style={styles.editActionsRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => {
                      setNicknameDraft(profile.nickname || '');
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
                    {savingNickname ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-outline" size={15} color="#ffffff" />
                        <Text style={styles.saveBtnText}>{t('common.save')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <InfoRow label={t('profileDetail.alias')} value={profile.nickname || ''} />
            )}
          </View>

          {/* Sección de Empresa Asignada con gestión directa */}
          <View style={[styles.section, styles.shadowCard]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('companies.header')}</Text>
              <TouchableOpacity style={styles.editCompanyButton} onPress={handleOpenCompanyModal}>
                <Ionicons name="swap-horizontal-outline" size={15} color={AUTH_COLORS.orange} />
                <Text style={styles.editCompanyButtonText}>
                  {company ? t('common.change') : t('companies.assign')}
                </Text>
              </TouchableOpacity>
            </View>

            {company ? (
              <TouchableOpacity
                style={styles.companyRow}
                onPress={() => router.push(`/companies/${company.id}` as any)}
              >
                <View style={styles.companyBadge}>
                  <Ionicons name="business-outline" size={20} color={AUTH_COLORS.orange} />
                </View>
                <View style={styles.companyCopy}>
                  <Text style={styles.companyLabel}>{t('companies.assignedCompany')}</Text>
                  <Text style={styles.companyName}>{company.name}</Text>
                </View>
                <Ionicons name="chevron-forward-outline" size={16} color={AUTH_COLORS.secondaryText} />
              </TouchableOpacity>
            ) : (
              <View style={styles.companyRow}>
                <View style={[styles.companyBadge, { backgroundColor: AUTH_COLORS.surfaceAlt }]}>
                  <Ionicons name="business-outline" size={20} color={AUTH_COLORS.secondaryText} />
                </View>
                <View style={styles.companyCopy}>
                  <Text style={styles.companyLabel}>{t('companies.assignedCompany')}</Text>
                  <Text style={[styles.companyName, { color: AUTH_COLORS.secondaryText }]}>
                    {t('companies.noCompanyAssigned')}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {currentUserId && currentUserId !== profile.id ? (
          <View style={styles.dangerZone}>
            <TouchableOpacity
              style={styles.deleteProfileButton}
              onPress={handleDeleteProfile}
              disabled={deletingProfile}
            >
              {deletingProfile ? (
                <ActivityIndicator size="small" color={AUTH_COLORS.danger} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={17} color={AUTH_COLORS.danger} />
                  <Text style={styles.deleteProfileButtonText}>
                    {t('profileDetail.deleteAction', { defaultValue: 'Mover perfil a la papelera' })}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      {/* Modal para seleccionar / cambiar empresa del usuario con buscador en tiempo real */}
      <Modal
        visible={showCompanyModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCompanyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDesktop && styles.modalCardDesktop]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('companies.selectCompany')}
              </Text>
              <TouchableOpacity onPress={() => setShowCompanyModal(false)}>
                <Ionicons name="close" size={22} color={AUTH_COLORS.primaryText} />
              </TouchableOpacity>
            </View>

            {/* Buscador en tiempo real de empresas */}
            <AuthSearchBar
              value={companySearchQuery}
              onChangeText={setCompanySearchQuery}
              placeholder={t('companies.searchPlaceholder')}
              searching={loadingCompanies}
            />

            {loadingCompanies ? (
              <View style={styles.modalCenter}>
                <ActivityIndicator size="small" color={AUTH_COLORS.orange} />
              </View>
            ) : filteredCompanies.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="business-outline" size={28} color={AUTH_COLORS.secondaryText} />
                <Text style={styles.emptyText}>
                  {companySearchQuery.trim()
                      ? t('companies.notFound')
                      : t('companies.empty')}
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Opción de desvincular (solo si no hay filtro de búsqueda activo) */}
                {company && !companySearchQuery.trim() ? (
                  <TouchableOpacity
                    style={[styles.modalCompanyRow, styles.modalUnlinkRow]}
                    onPress={() => handleSelectCompany(null)}
                    disabled={savingCompany}
                  >
                    <Ionicons name="close-circle-outline" size={20} color={AUTH_COLORS.danger} />
                    <Text style={styles.modalUnlinkText}>
                      {t('companies.unlinkFromCompany')}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {filteredCompanies.map((c) => {
                  const isSelected = c.id === company?.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.modalCompanyRow, isSelected && styles.modalCompanyRowSelected]}
                      onPress={() => handleSelectCompany(c.id)}
                      disabled={savingCompany}
                    >
                      <View style={styles.companyBadge}>
                        <Ionicons name="business-outline" size={18} color={AUTH_COLORS.orange} />
                      </View>
                      <Text style={[styles.modalCompanyName, isSelected && styles.modalCompanyNameSelected]}>
                        {c.name}
                      </Text>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={20} color={AUTH_COLORS.orange} />
                      ) : (
                        <Ionicons name="add-circle-outline" size={20} color={AUTH_COLORS.secondaryText} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '---'}</Text>
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
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    gap: 18,
    paddingBottom: 28,
  },
  contentDesktop: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 64,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  contentMobile: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  emptyCard: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  contentWithDock: {
    paddingBottom: AUTH_MOBILE_DOCK_PADDING,
  },
  heroCard: {
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  heroBadge: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: AUTH_COLORS.primaryText,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    color: AUTH_COLORS.secondaryText,
    textAlign: 'center',
  },
  rolePill: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
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
  grid: {
    gap: 18,
  },
  section: {
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    padding: 20,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 18,
    fontWeight: '800',
  },
  editCompanyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: AUTH_COLORS.surfaceAlt,
  },
  editCompanyButtonText: {
    color: AUTH_COLORS.orange,
    fontSize: 12,
    fontWeight: '700',
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  companyBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  companyLabel: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 11,
    fontWeight: '600',
  },
  companyName: {
    color: AUTH_COLORS.primaryText,
    fontSize: 15,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: AUTH_COLORS.line,
  },
  infoLabel: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  infoValue: {
    color: AUTH_COLORS.primaryText,
    fontSize: 14,
    fontWeight: '700',
  },
  assignedShipmentList: {
    gap: 10,
  },
  shipmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  shipmentIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shipmentCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  shipmentTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 14,
    fontWeight: '800',
  },
  shipmentRoute: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 12,
  },
  shipmentMeta: {
    color: AUTH_COLORS.blue,
    fontSize: 11,
    fontWeight: '700',
  },
  sectionCopy: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: AUTH_COLORS.primaryText,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 14,
  },
  shadowCard: AUTH_SHADOW,

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxHeight: 480,
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  modalCardDesktop: {
    maxWidth: 480,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 16,
    fontWeight: '800',
  },
  modalCenter: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  modalScroll: {
    maxHeight: 320,
  },
  modalCompanyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    marginBottom: 8,
  },
  modalCompanyRowSelected: {
    borderColor: AUTH_COLORS.orangeBorder,
    borderWidth: 1,
  },
  modalCompanyName: {
    flex: 1,
    color: AUTH_COLORS.primaryText,
    fontSize: 14,
    fontWeight: '700',
  },
  modalCompanyNameSelected: {
    color: AUTH_COLORS.orange,
  },
  modalUnlinkRow: {
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderColor: 'rgba(255, 69, 58, 0.2)',
    borderWidth: 1,
    justifyContent: 'center',
  },
  modalUnlinkText: {
    color: AUTH_COLORS.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  dangerZone: {
    marginTop: 8,
    alignItems: 'center',
  },
  deleteProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  deleteProfileButtonText: {
    color: AUTH_COLORS.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  editNicknameContainer: {
    gap: 8,
    paddingTop: 6,
  },
  nicknameInput: {
    height: 44,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
    paddingHorizontal: 14,
    color: AUTH_COLORS.primaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  editActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: AUTH_COLORS.orange,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});