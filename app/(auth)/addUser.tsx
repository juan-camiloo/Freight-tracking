// Archivo: app/(auth)/addUser.tsx
// Descripcion: Pantalla para invitar nuevos usuarios. Solo internos deben usar esta vista.

import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LogoCorner from '../../components/LogoCorner';
import { inviteUserFunctionUrl, supabase } from '../../lib/supabase';

const COLORS = {
  blue: '#1E5F99',
  blueMid: '#2B6AA0',
  blueDark: '#1B2A3A',
  orange: '#F28A07',
  cream: '#FFF6EC',
  creamGlass: 'rgba(255, 246, 236, 0.92)',
  textSecondary: '#6B7C8F',
  placeholder: '#8B98A6',
  border: '#D7E3EE',
};

export default function AddUser() {
  const { t } = useTranslation();
  // Datos del formulario de invitacion.
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  // Estado visual del envio.
  const [loading, setLoading] = useState(false);

  // Envia invitacion usando Edge Function.
  const handleAddUser = async () => {
    if (!email) {
      Alert.alert(t('common.error'), t('addUser.missingEmail'));
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        Alert.alert(t('common.error'), t('addUser.noSession'));
        setLoading(false);
        return;
      }

      const response = await fetch(
          inviteUserFunctionUrl, {
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

      Alert.alert(t('common.success'), t('addUser.createdSuccess'));
      router.replace('/');
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert(t('common.error'), error.message);
      } else {
        Alert.alert(t('common.error'), t('addUser.unknownError'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Navegacion segura hacia atras o al dashboard.
  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill]}>
        <Image
          source={require('../../visual/background.png')}
          style={styles.background}
          resizeMode="cover"
        />
      </View>

      <View style={styles.fixedHeader}>
        <View style={styles.headerRow}>
          <LogoCorner inline size={120} />
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {t('addUser.headerTitle')}
          </Text>
          <View style={styles.topActions}>
            <TouchableOpacity onPress={backFunction}>
              <Text style={styles.topActionText}>{t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.form}>
          <Text style={styles.label}>{t('addUser.emailLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('login.emailPlaceholder')}
            placeholderTextColor={COLORS.placeholder}
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
            placeholderTextColor={COLORS.placeholder}
            value={nickname}
            onChangeText={setNickname}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleAddUser}
          />

          <View style={styles.switchContainer}>
            <Text style={styles.label}>{t('addUser.isInternal')}</Text>
            <Switch
              value={isInternal}
              onValueChange={setIsInternal}
              trackColor={{ false: COLORS.border, true: '#FFB24C' }}
              thumbColor={isInternal ? COLORS.orange : COLORS.cream}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleAddUser} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? t('addUser.creating') : t('addUser.createUser')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { position: 'absolute', width: '100%', height: '100%' },
  container: { flex: 1 },
  content: { flex: 1, paddingTop: 72 },
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B2A3A',
    textAlign: 'center',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 60,
  },
  topActionText: {
    color: '#1B2A3A',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
  },
  form: {
    margin: 16,
    padding: 20,
    backgroundColor: COLORS.creamGlass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 50,
  },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: COLORS.blueDark },
  input: {
    borderWidth: 1,
    borderColor: COLORS.blueMid,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: COLORS.cream,
    color: COLORS.blueDark,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  button: {
    backgroundColor: COLORS.orange,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: COLORS.blueDark, fontSize: 16, fontWeight: '700' },
});
