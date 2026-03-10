// Archivo: app/login.tsx
/*
Pantalla de acceso por magic link.
Solo permite solicitar OTP para correos registrados por usuarios internos.
*/

import * as Linking from 'expo-linking';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LogoCorner from '../components/LogoCorner';
import { supabase } from '../lib/supabase';

const COLORS = {
  blueMid: '#1862A0',
  blueDark: '#1B2A3A',
  orange: '#F28A07',
  cream: '#FFF6EC',
  creamGlass: 'rgba(255, 246, 236, 0.92)',
  textSecondary: '#6B7C8F',
  placeholder: '#8B98A6',
  border: '#D7E3EE',
};

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  function getRedirectTo() {
    if (Platform.OS === 'web') {
      return Linking.createURL('/auth/callback');
    }
    const nativeUrl = Linking.createURL('auth/callback', { scheme: 'freighttracking' });
    return nativeUrl;
  }

  const handleLogin = async () => {
    if (!email) {
      Alert.alert(t('common.error'), t('login.missingEmail'));
      return;
    }

    setLoading(true);

    const redirectTo = getRedirectTo();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: redirectTo,
      },
    });

    setLoading(false);

    if (error) {
      Alert.alert(t('common.error'), error.message);
    } else {
      Alert.alert(t('common.success'), t('login.checkEmail'));
    }
  };

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        <Image source={require('../visual/background.png')} style={styles.background} resizeMode="cover" />
      </View>

      <View style={styles.fixedHeader}>
        <LogoCorner />
        <Text style={styles.headerTitle}>{t('login.headerTitle')}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{t('login.title')}</Text>
        <Text style={styles.subtitle}>{t('login.subtitle')}</Text>

        <TextInput
          style={styles.input}
          placeholder={t('login.emailPlaceholder')}
          placeholderTextColor={COLORS.placeholder}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>
            {loading ? t('common.sending') : t('login.sendMagicLink')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    zIndex: 1,
    backgroundColor: COLORS.creamGlass,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 72,
  },
  background: { width: '100%', height: '100%' },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'transparent',
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 4,
    justifyContent: 'center',
    backgroundColor: COLORS.orange,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.orange,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B2A3A',
    textAlign: 'center',
    paddingBottom: 14,
  },
  title: {
    color: COLORS.blueDark,
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    backgroundColor: COLORS.cream,
    borderColor: COLORS.blueMid,
    borderWidth: 1,
    color: COLORS.blueDark,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    fontSize: 16,
    minHeight: 48,
    marginBottom: 20,
  },
  button: {
    backgroundColor: COLORS.orange,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    minHeight: 56,
    justifyContent: 'center',
  },
  buttonText: {
    color: COLORS.blueDark,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
    lineHeight: 22,
    flexShrink: 1,
  },
});
