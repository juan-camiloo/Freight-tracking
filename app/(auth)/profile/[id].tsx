// Archivo: app/(auth)/profile/[id].tsx
// Descripcion: Pantalla de detalle de perfil. Muestra datos basicos y permite navegar a asignacion de carga.

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LogoCorner from '../../../components/LogoCorner';
import { supabase } from '../../../lib/supabase';

type Profile = {
  id: string;
  email: string;
  is_internal: boolean;
  nickname: string;
};

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

export default function ProfileDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams();
  const profileId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
  // Datos basicos del perfil seleccionado.
  const [profile, setProfile] = useState<Profile | null>(null);
  // Estado de carga inicial.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadProfileDetails();
  }, [id]);

  // Consulta el perfil desde Supabase con el ID de la ruta.
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

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);
    } catch (error) {
      console.error('Error cargando perfil:', error);
      alert(t('profileDetail.loadError'));
    } finally {
      setLoading(false);
    }
  };

  // Navegacion segura al listado de perfiles.
  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/profiles');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text>{t('profileDetail.notFound')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image
          source={require('../../../visual/background.png')}
          style={styles.background}
          resizeMode="cover"
        />
      </View>

      <View style={styles.fixedHeader}>
        <View style={styles.headerRow}>
          <LogoCorner inline size={120} />
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {t('profileDetail.headerTitle')}
          </Text>
          <View style={styles.topActions}>
            <TouchableOpacity onPress={backFunction}>
              <Text style={styles.topActionText}>{t('common.back')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/assignShipment/[id]', params: { id: profileId } })}
              disabled={!profileId}
            >
              <Text style={[styles.topActionText, !profileId && styles.disabledText]}>
                {t('profileDetail.assignShipment')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profileDetail.sectionInfo')}</Text>
          <InfoRow label={t('profileDetail.email')} value={profile.email || ''} />
          <InfoRow label={t('profileDetail.alias')} value={profile.nickname || ''} />
        </View>
      </ScrollView>
    </View>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
};

function InfoRow({ label, value }: InfoRowProps) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { width: '100%', height: '100%' },
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { zIndex: 1, paddingBottom: 20, paddingTop: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
    flexShrink: 0,
  },
  topActionText: { color: '#1B2A3A', fontSize: 16, fontWeight: '600', padding: 6, includeFontPadding: false },
  disabledText: { opacity: 0.5 },
  section: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 15,
    borderRadius: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: { width: 140, fontWeight: '600', color: '#666' },
  infoValue: { flex: 1, color: '#333' },
});
