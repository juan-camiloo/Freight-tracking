// Archivo: app/(auth)/addUser.tsx
// Descripcion: Pantalla para invitar nuevos usuarios. Solo internos deben usar esta vista.
import Header from '@/components/Header';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import {
  AUTH_COLORS,
  AUTH_SHADOW,
  AuthScreenBackground
} from '../../components/auth/AuthChrome';
import { AUTH_MOBILE_DOCK_PADDING } from '../../components/auth/AuthNavigation';
import { useNativeNotification } from '../../components/ui/NativeNotification';
import { useResponsive } from '../../hooks/useResponsive';
import { inviteUserFunctionUrl, supabase } from '../../lib/URLs';

export default function AddUser() {
  const { t } = useTranslation();
  const notification = useNativeNotification();
  const { height, isDesktop } = useResponsive();

  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAddUser = async () => {
    if (!email) {
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
        body: JSON.stringify({ email, nickname, is_internal: isInternal }),
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

      notification.success(t('addUser.createdSuccess'));
      router.replace('/');
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
      router.replace('/');
    }
  };

  return (
    <View style={[styles.container, { minHeight: height }]}>
      <AuthScreenBackground />
      <Header
        title={t('dashboard.addUser')}
        isDesktop={isDesktop}
        showSearch = {false}
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
          <Text style={styles.subtitle}>{t('addUser.description')}</Text>

          <Text style={styles.label}>{t('addUser.emailLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('login.emailPlaceholder')}
            placeholderTextColor={AUTH_COLORS.secondaryText}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleAddUser}
          />

          <Text style={styles.label}>{t('addUser.nicknameLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('addUser.nicknamePlaceholder')}
            placeholderTextColor={AUTH_COLORS.secondaryText}
            value={nickname}
            onChangeText={setNickname}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleAddUser}
          />

          <View style={styles.switchCard}>
            <View style={styles.switchCopy}>
              <Text style={styles.switchTitle}>{t('addUser.isInternal')}</Text>
              <Text style={styles.switchHint}>{t('addUser.internalHint')}</Text>
            </View>
            <Switch
              value={isInternal}
              onValueChange={setIsInternal}
              trackColor={{ false: AUTH_COLORS.surfaceMuted, true: AUTH_COLORS.orangeSoft }}
              thumbColor={isInternal ? AUTH_COLORS.orange : AUTH_COLORS.surface}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleAddUser} disabled={loading}>
            <Text style={styles.buttonText}>
              {loading ? t('addUser.creating') : t('addUser.createUser')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AUTH_COLORS.backgroundBottom,
    overflow: 'hidden',
  },
  scroll: { flex: 1 },
  content: {
    gap: 18,
    paddingBottom: 28,
  },
  contentDesktop: {
    paddingHorizontal: 28,
    paddingTop: 24,
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
    padding: 18,
  },
  cardDesktop: {
    maxWidth: 760,
    padding: 24,
  },
  shadowCard: AUTH_SHADOW,
  title: {
    color: AUTH_COLORS.primaryText,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 8,
    color: AUTH_COLORS.secondaryText,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 14,
    marginBottom: 6,
    marginTop: 10,
    color: AUTH_COLORS.secondaryText,
  },
  input: {
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    padding: 12,
    borderRadius: 12,
    fontSize: 16,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    color: AUTH_COLORS.primaryText,
    minHeight: 48,
  },
  switchCard: {
    marginTop: 18,
    padding: 14,
    borderRadius: 18,
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
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: AUTH_COLORS.orangeSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
    marginTop: 20,
  },
  buttonText: {
    color: AUTH_COLORS.primaryText,
    fontSize: 14,
    fontWeight: '700',
  },
});
