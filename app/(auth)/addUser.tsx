// Archivo: app/(auth)/addUser.tsx
// Descripcion: Pantalla para invitar nuevos usuarios y asignarles su rol, nickname y empresa.

import Header from '@/components/Header';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
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
import { inviteUserFunctionUrl, supabase } from '../../lib/URLs';

type CompanyOption = {
  id: string;
  name: string;
};

export default function AddUser() {
  const { t } = useTranslation();
  const notification = useNativeNotification();
  const { height, isDesktop } = useResponsive();

  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [searchCompanyQuery, setSearchCompanyQuery] = useState('');
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedCompany = useMemo(() => {
    return companies.find((c) => c.id === companyId);
  }, [companies, companyId]);

  const filteredCompanies = useMemo(() => {
    const q = searchCompanyQuery.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, searchCompanyQuery]);

  useEffect(() => {
    let mounted = true;
    const fetchCompanies = async () => {
      setLoadingCompanies(true);
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name')
          .order('name', { ascending: true });
        if (!error && data && mounted) {
          setCompanies(data);
        }
      } catch {
        // Fallback silencioso
      } finally {
        if (mounted) setLoadingCompanies(false);
      }
    };
    void fetchCompanies();
    return () => {
      mounted = false;
    };
  }, []);

  const handleAddUser = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanNickname = nickname.trim();

    if (!cleanEmail) {
      notification.error(t('addUser.missingEmail'));
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        notification.error(t('addUser.noSession'));
        setLoading(false);
        return;
      }

      const response = await fetch(inviteUserFunctionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
          nickname: cleanNickname || null,
          is_internal: isInternal,
          company_id: companyId || null,
        }),
      });

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const errorMessage =
          typeof payload?.error_key === 'string'
            ? t(payload.error_key, payload.error_params ?? {})
            : typeof payload?.error === 'string'
              ? payload.error
              : t('addUser.inviteError');
        throw new Error(errorMessage);
      }

      // Seguridad adicional: asegurar persistencia de nickname y company_id en profiles
      if (payload?.user?.id) {
        await supabase
          .from('profiles')
          .update({
            nickname: cleanNickname || null,
            company_id: companyId || null,
          })
          .eq('id', payload.user.id);
      }

        notification.success(t('addUser.createdSuccess'));
        router.replace('/profiles');
    } catch (error) {
      if (error instanceof Error) {
        notification.error(error.message);
      } else {
        notification.error(t('addUser.unknownError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/profiles');
    }
  };

  const isWeb = Platform.OS === 'web';

  return (
    <View style={styles.container}>
      <AuthScreenBackground />
      <Header
        title={t('dashboard.addUser')}
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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, styles.shadowCard, isDesktop && styles.cardDesktop]}>
          <Text style={styles.title}>{t('addUser.headerTitle')}</Text>
          <Text style={styles.subtitle}>
            {t('addUser.description')}
          </Text>

          {/* Campo Correo Electrónico */}
          <Text style={styles.label}>{t('addUser.emailLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('login.emailPlaceholder')}
            placeholderTextColor={AUTH_COLORS.secondaryText}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />

          {/* Campo Nickname / Alias */}
          <Text style={styles.label}>{t('addUser.nicknameLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('addUser.nicknamePlaceholder')}
            placeholderTextColor={AUTH_COLORS.secondaryText}
            value={nickname}
            onChangeText={setNickname}
            autoCapitalize="words"
            returnKeyType="next"
          />

          {/* Campo Selector de Empresa con Buscador */}
          <Text style={styles.label}>{t('addUser.companyLabel')}</Text>
          <TouchableOpacity
            style={styles.companySelectButton}
            onPress={() => {
              setSearchCompanyQuery('');
              setShowCompanyModal(true);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.companySelectLead}>
              <View style={[styles.companyBadge, { width: 32, height: 32, borderRadius: 10 }]}>
                <Ionicons
                  name="business-outline"
                  size={16}
                  color={selectedCompany ? AUTH_COLORS.orange : AUTH_COLORS.secondaryText}
                />
              </View>
              <Text
                style={[
                  styles.companySelectText,
                  selectedCompany && styles.companySelectTextSelected,
                ]}
                numberOfLines={1}
              >
                {selectedCompany
                  ? selectedCompany.name
                  : t('addUser.selectCompanyPlaceholder')}
              </Text>
            </View>
            <View style={styles.companySelectTrail}>
              {selectedCompany ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setCompanyId('');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={AUTH_COLORS.secondaryText} />
                </TouchableOpacity>
              ) : (
                <Ionicons name="chevron-forward" size={16} color={AUTH_COLORS.secondaryText} />
              )}
            </View>
          </TouchableOpacity>

          {/* Selector de Rol Interno / Operativo */}
          <View style={styles.switchCard}>
            <View style={styles.switchCopy}>
              <Text style={styles.switchTitle}>{t('addUser.isInternal')}</Text>
              <Text style={styles.switchHint}>
                {t('addUser.internalHint')}
              </Text>
            </View>
            <Switch
              value={isInternal}
              onValueChange={setIsInternal}
              trackColor={{ false: AUTH_COLORS.surfaceMuted, true: AUTH_COLORS.orangeSoft }}
              thumbColor={isInternal ? AUTH_COLORS.orange : AUTH_COLORS.surface}
            />
          </View>

          {/* Botón de Creación */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleAddUser}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {loading
                ? t('addUser.creating')
                  : t('addUser.createUser')}
              </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal con Buscador en Vivo de Empresas */}
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

            <AuthSearchBar
              value={searchCompanyQuery}
              onChangeText={setSearchCompanyQuery}
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
                  {searchCompanyQuery.trim()
                    ? t('companies.notFound')
                    : t('companies.empty')}
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Opción Sin Empresa */}
                <TouchableOpacity
                  style={[styles.modalCompanyRow, !companyId && styles.modalCompanyRowSelected]}
                  onPress={() => {
                    setCompanyId('');
                    setShowCompanyModal(false);
                  }}
                >
                  <View style={[styles.companyBadge, { backgroundColor: AUTH_COLORS.surfaceAlt }]}>
                    <Ionicons name="remove-circle-outline" size={18} color={AUTH_COLORS.secondaryText} />
                  </View>
                  <Text style={[styles.modalCompanyName, !companyId && styles.modalCompanyNameSelected]}>
                    {t('companies.noCompanyAssigned')}
                  </Text>
                  {!companyId ? (
                    <Ionicons name="checkmark-circle" size={20} color={AUTH_COLORS.orange} />
                  ) : null}
                </TouchableOpacity>

                {filteredCompanies.map((c) => {
                  const isSelected = c.id === companyId;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.modalCompanyRow, isSelected && styles.modalCompanyRowSelected]}
                      onPress={() => {
                        setCompanyId(c.id);
                        setShowCompanyModal(false);
                      }}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: AUTH_COLORS.backgroundBottom,
  },
  scroll: { flex: 1, minHeight: 0 },
  content: {
    gap: 18,
    paddingBottom: 28,
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
  },
  cardDesktop: {
    maxWidth: 720,
    padding: 28,
  },
  shadowCard: AUTH_SHADOW,
  title: {
    color: AUTH_COLORS.primaryText,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 14,
    color: AUTH_COLORS.secondaryText,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 12,
    color: AUTH_COLORS.secondaryText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    fontSize: 15,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    color: AUTH_COLORS.primaryText,
    minHeight: 46,
  },
  companySelectButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    gap: 10,
  },
  companySelectLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  companySelectText: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 14,
    flex: 1,
  },
  companySelectTextSelected: {
    color: AUTH_COLORS.primaryText,
    fontWeight: '700',
  },
  companySelectTrail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  switchCopy: {
    flex: 1,
    gap: 4,
  },
  switchTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 15,
    fontWeight: '700',
  },
  switchHint: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 18,
    backgroundColor: AUTH_COLORS.orangeSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: AUTH_COLORS.primaryText,
    fontSize: 15,
    fontWeight: '700',
  },

  // Modal selector
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
  companyBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(199, 138, 75, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 14,
    textAlign: 'center',
  },
});
