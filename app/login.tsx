// Archivo: app/login.tsx
/*
Pantalla de acceso por OTP de 6 dígitos.
Solo permite solicitar código para correos registrados por usuarios internos.
Flujo: paso 1 → ingresa correo → paso 2 → ingresa código de 6 dígitos
*/

import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  const [code, setCode] = useState('');
  // Controla en qué paso del flujo está el usuario.
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);

  // Paso 1: envía el código OTP al correo del usuario.
  // shouldCreateUser: false garantiza que solo usuarios ya invitados
  // puedan solicitar el código; rechaza correos no registrados.
  const handleSendCode = async () => {
    if (!email) {
      Alert.alert(t('common.error'), t('login.missingEmail'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (error) {
      Alert.alert(t('common.error'), error.message);
    } else {
      // Código enviado exitosamente, pasa al paso 2.
      setStep('code');
    }
  };

  // Paso 2: verifica el código OTP ingresado por el usuario.
  // Si es válido, Supabase establece la sesión automáticamente
  // y el auth listener del layout redirige al dashboard.
  const handleVerifyCode = async () => {
    if (!code) {
      Alert.alert(t('common.error'), t('login.missingCode'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });
    setLoading(false);
    if (!error){
      const {data: {session}}= await supabase.auth.getSession();
      if (session){
        console.log("sesion activa")
        router.replace('/');
      }
    }
    console.log("verifyOtp error:", error)
    console.log("verifyOtp success:", !error)
    if (error) {
      Alert.alert(t('common.error'), error.message);
    }
    // Si no hay error, el auth listener redirige automáticamente.
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
        <Text style={styles.subtitle}>
          {step === 'email' ? t('login.subtitle') : t('login.enterCode')}
        </Text>

        {step === 'email' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder={t('login.emailPlaceholder')}
              placeholderTextColor={COLORS.placeholder}
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
              placeholderTextColor={COLORS.placeholder}
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
            {/* Permite volver al paso 1 para cambiar el correo. */}
            <TouchableOpacity onPress={() => { setStep('email'); setCode(''); }} style={styles.backLink}>
              <Text style={styles.backLinkText}>{t('login.changeEmail')}</Text>
            </TouchableOpacity>
          </>
        )}
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
  backLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  backLinkText: {
    color: COLORS.blueMid,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});