// Archivo: components/navigation/AppTopBar.tsx
// Barra superior global persistente del App Shell (Nivel 1 de navegación).

import LogoCorner from '@/components/LogoCorner';
import { COLORS } from '@/components/ui/COLORS';
import { FONT_SIZE, FONT_WEIGHT } from '@/components/ui/TYPOGRAPHY';
import { useResponsive } from '@/hooks/useResponsive';
import { supabase } from '@/lib/URLs';
import { SupportTicketsModal } from '@/components/support/SupportTicketsModal';
import { supportModal } from '@/lib/supportModal';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import i18n from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type AppTopBarProps = {
  onOpenMobileMenu?: () => void;
};

export function AppTopBar({ onOpenMobileMenu }: AppTopBarProps) {
  const { isDesktop } = useResponsive();
  const { t } = useTranslation();

  const [currentLang, setCurrentLang] = useState(i18n.language || 'es');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [profile, setProfile] = useState<{
    email: string | null;
    nickname: string | null;
    is_internal: boolean;
    company_name: string | null;
  } | null>(null);

  useEffect(() => {
    return supportModal.subscribe((open) => setShowSupportModal(open));
  }, []);

  useEffect(() => {
    const onLangChanged = (lng: string) => setCurrentLang(lng);
    i18n.on('languageChanged', onLangChanged);
    return () => {
      i18n.off('languageChanged', onLangChanged);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('email, nickname, is_internal, company_id')
        .eq('id', user.id)
        .single();
      if (mounted && data) {
        let compName: string | null = null;
        if (data.company_id) {
          const { data: comp } = await supabase
            .from('companies')
            .select('name')
            .eq('id', data.company_id)
            .single();
          compName = comp?.name || null;
        }
        setProfile({
          email: data.email,
          nickname: data.nickname,
          is_internal: Boolean(data.is_internal),
          company_name: compName,
        });
      }
    };
    void fetchUser();
    return () => {
      mounted = false;
    };
  }, []);

  const isInternal = Boolean(profile?.is_internal);
  const userDisplayName = profile?.nickname || profile?.email?.split('@')[0] || t('common.user');
  const companyLabel = profile?.company_name || t('companies.noCompanyAssigned');

  const handleToggleLang = () => {
    const nextLang = currentLang.toLowerCase().startsWith('en') ? 'es' : 'en';
    void i18n.changeLanguage(nextLang);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <View style={[styles.topBarContainer, isDesktop && styles.topBarContainerDesktop]}>
      {/* Lado izquierdo: Branding + Menú móvil (solo si el usuario tiene opciones de menú interno) */}
      <View style={styles.leftSection}>
        {!isDesktop && isInternal && onOpenMobileMenu && (
          <TouchableOpacity
            style={styles.mobileMenuButton}
            onPress={onOpenMobileMenu}
            activeOpacity={0.7}
            accessibilityLabel="Abrir menú"
          >
            <Ionicons name="menu-outline" size={22} color={COLORS.surface} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.brandLink}
          onPress={() => router.push('/')}
          activeOpacity={0.8}
        >
          <LogoCorner inline size={isDesktop ? 78 : 64} height={isDesktop ? 30 : 26} />
        </TouchableOpacity>
      </View>

      {/* Lado derecho: Conmutador de Idioma, Perfil de Usuario y Logout */}
      <View style={styles.rightSection}>
        {/* Conmutador de Idioma */}
        <TouchableOpacity style={styles.langButton} onPress={handleToggleLang} activeOpacity={0.75}>
          <Ionicons name="globe-outline" size={14} color={COLORS.surface} />
          <Text style={styles.langButtonText}>
            {currentLang.toUpperCase().startsWith('EN') ? 'EN' : 'ES'}
          </Text>
        </TouchableOpacity>

        {/* Botón de Soporte y Seguimiento de Tickets */}
        <TouchableOpacity
          style={styles.supportButton}
          onPress={() => setShowSupportModal(true)}
          activeOpacity={0.75}
          accessibilityLabel={t('supportModal.title') || 'Soporte y Tickets'}
        >
          <Ionicons name="headset-outline" size={15} color={COLORS.surface} />
          {isDesktop ? (
            <Text style={styles.supportButtonText}>
              {t('supportModal.buttonLabel') || 'Soporte'}
            </Text>
          ) : null}
        </TouchableOpacity>

        {/* Separador sutil */}
        <View style={styles.separator} />

        {/* Perfil del Usuario: Despliega Nickname y Empresa */}
        <TouchableOpacity
          style={styles.profilePill}
          onPress={() => router.push('/myProfile')}
          activeOpacity={0.8}
        >
          <View style={styles.profileTextWrap}>
            <Text style={styles.profileName} numberOfLines={1}>
              {userDisplayName}
            </Text>
            <View style={styles.companyTagPill}>
              <Text style={styles.profileCompany} numberOfLines={1}>
                {companyLabel}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={14} color="rgba(245, 241, 234, 0.45)" />
        </TouchableOpacity>

        {!isInternal && (
          <TouchableOpacity
            style={styles.clientLogoutBtn}
            onPress={handleLogout}
            activeOpacity={0.75}
            accessibilityLabel={t('common.logout')}
          >
            <Ionicons name="log-out-outline" size={18} color="#FF6B6B" />
          </TouchableOpacity>
        )}
      </View>

      {/* Modal de Soporte y Seguimiento de Tickets */}
      <SupportTicketsModal
        visible={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topBarContainer: {
    height: 56,
    backgroundColor: '#253046',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 241, 234, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  topBarContainerDesktop: {
    height: 62,
    paddingHorizontal: 22,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mobileMenuButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 241, 234, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  langButton: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 241, 234, 0.06)',
  },
  langButtonText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.surface,
    lineHeight: 16,
  },
  supportButton: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 241, 234, 0.06)',
  },
  supportButtonText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.surface,
    lineHeight: 16,
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(245, 241, 234, 0.12)',
    marginHorizontal: 2,
    alignSelf: 'center',
  },
  profilePill: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 241, 234, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(245, 241, 234, 0.08)',
  },
  profileTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileName: {
    fontSize: FONT_SIZE.xs + 1,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
    maxWidth: 120,
    lineHeight: 16,
  },
  companyTagPill: {
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(199, 138, 75, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(199, 138, 75, 0.3)',
    maxWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCompany: {
    fontSize: 9,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.orange,
    lineHeight: 12,
  },
  clientLogoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
