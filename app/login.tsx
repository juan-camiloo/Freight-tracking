// Archivo: app/login.tsx
/*
Pantalla de acceso por OTP de 6 digitos.
Solo permite solicitar codigo para correos registrados por usuarios internos.
Flujo: paso 1 -> ingresa correo -> paso 2 -> ingresa codigo de 6 digitos
*/
import Header from '@/components/Header';
import { useResponsive } from '@/hooks/useResponsive';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import {
  AUTH_COLORS,
  AUTH_SHADOW,
  AuthScreenBackground,
} from '../components/auth/AuthChrome';
import { useNativeNotification } from '../components/ui/NativeNotification';
import { supabase } from '../lib/URLs';


export default function Login() {
  const { t } = useTranslation();
  const notification = useNativeNotification();
  const { height, isDesktop } = useResponsive();
  const { reason } = useLocalSearchParams<{ reason?: string }>();

  const [cooldown, setCooldown] = useState(0)
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (reason === 'account_inactive') {
      notification.error(t('login.accountInactive', { defaultValue: 'Tu cuenta se encuentra inactiva. Comunícate con el administrador.' }));
    } else if (reason === 'company_inactive') {
      notification.error(t('login.companyInactive', { defaultValue: 'La empresa asociada a tu cuenta se encuentra inactiva. Comunícate con el administrador.' }));
    }
  }, [reason]);

  const handleSendCode = async () => {
    if (cooldown > 0) return; 
    if (!email) {
      notification.error(t('login.missingEmail'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (error) {
      notification.error(getLoginRequestMessage(error.message, t('login.emailNotRegistered')));
    } else {
      notification.success(t('login.codeSent'));
      setStep('code');
    }
  };

  const handleVerifyCode = async () => {
    if (!code) {
      notification.error(t('login.missingCode'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });
    setLoading(false);
    if (!error) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        // Validar que el perfil o su empresa no se encuentren inactivos
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('id, status, is_internal, company_id')
          .eq('id', session.user.id)
          .single();

        let isInactive = userProfile?.status === 'inactive';
        let inactiveReason = 'account';

        if (!isInactive && userProfile?.company_id) {
          const { data: comp } = await supabase
            .from('companies')
            .select('status')
            .eq('id', userProfile.company_id)
            .single();
          if (comp?.status === 'inactive') {
            isInactive = true;
            inactiveReason = 'company';
          }
        }

        if (isInactive) {
          await supabase.auth.signOut();
          notification.error(
            inactiveReason === 'company'
              ? t('login.companyInactive', { defaultValue: 'La empresa asociada a tu cuenta se encuentra inactiva. Comunícate con el administrador.' })
              : t('login.accountInactive', { defaultValue: 'Tu cuenta se encuentra inactiva. Comunícate con el administrador.' })
          );
          return;
        }

        notification.success(t('login.success'));
        router.replace('/');
      }
    }
    if (error) {
      notification.error(getLoginVerifyMessage(error.message, t('login.invalidCode')));
    }
    setCooldown (60)
    const interval = setInterval(() =>{
      setCooldown(c => {if (c <= 1) clearInterval (interval); return c -1;})
    })
  };

  return (
    <View style={[styles.container, { minHeight: height }]}>
      <AuthScreenBackground />
      <Header 
        title={t('login.headerTitle')} 
        showSearch = {false}
        isDesktop={isDesktop} 
      />

      <View style={styles.content}>
        <View style={[styles.card, styles.shadowCard, isDesktop && styles.cardDesktop]}>
          <Text style={styles.title}>{t('login.title')}</Text>
          <Text style={styles.subtitle}>
            {step === 'email' ? t('login.subtitle') : t('login.enterCode')}
          </Text>

          {step === 'email' ? (
            <>
              <TextInput
                style={styles.input}
                placeholder={t('login.emailPlaceholder')}
                placeholderTextColor={AUTH_COLORS.secondaryText}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSendCode}
              />
              <TouchableOpacity style={styles.button} onPress={handleSendCode} disabled={loading}>
                <Text style={styles.buttonText}>
                  {loading ? t('common.sending') : t('login.sendCode')}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="000000"
                placeholderTextColor={AUTH_COLORS.secondaryText}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleVerifyCode}
              />
              <TouchableOpacity style={styles.button} onPress={handleVerifyCode} disabled={loading}>
                <Text style={styles.buttonText}>
                  {loading ? t('common.verifying') : t('login.verify')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setStep('email');
                  setCode('');
                }}
                style={styles.backLink}
              >
                <Text style={styles.backLinkText}>{t('login.changeEmail')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function getLoginRequestMessage(message: string, fallback: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('signups not allowed') ||
    normalized.includes('user not found') ||
    normalized.includes('not registered')
  ) {
    return fallback;
  }
  console.log (message)
  return message;
}


function getLoginVerifyMessage(message: string, fallback: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('token') || normalized.includes('otp') || normalized.includes('invalid')) {
    return fallback;
  }
  return message;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AUTH_COLORS.backgroundBottom,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadowCard: AUTH_SHADOW,
  card: {
    width: '100%',
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    padding: 22,
  },
  cardDesktop: {
    maxWidth: 520,
    padding: 28,
  },
  title: {
    color: AUTH_COLORS.primaryText,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: AUTH_COLORS.secondaryText,
    marginBottom: 26,
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderColor: AUTH_COLORS.line,
    borderWidth: 1,
    color: AUTH_COLORS.primaryText,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    fontSize: 16,
    minHeight: 52,
    marginBottom: 18,
  },
  button: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: AUTH_COLORS.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
  },
  buttonText: {
    color: AUTH_COLORS.primaryText,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  backLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  backLinkText: {
    color: AUTH_COLORS.blue,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
