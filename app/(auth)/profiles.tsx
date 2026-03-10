// Archivo: app/(auth)/profiles.tsx
// Descripcion: Pantalla de perfiles para usuarios internos. Permite cargar, buscar y abrir el detalle de cada perfil.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LogoCorner from '../../components/LogoCorner';
import { listProfilesFunctionUrl, supabase, supabaseAnonKey } from '../../lib/supabase';

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

type Profile = {
  id: string;
  email: string | null;
  is_internal: boolean;
  nickname?: string | null;
};

const isAbortError = (error: unknown) =>
  error instanceof Error &&
  (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted'));

export default function Profiles() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadUserAndProfiles();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(() => {
      filterProfiles();
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchQuery, profiles]);

  const loadUserAndProfiles = async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/login');
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        Alert.alert(t('common.error'), t('profiles.noSession'));
        return;
      }

      const response = await fetch(
        listProfilesFunctionUrl,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || t('profiles.loadError'));
      }

      const data = await response.json();
      setProfiles(data || []);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Error cargando perfiles:', error);
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('profiles.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  const filterProfiles = () => {
    setSearching(true);
    const clean = searchQuery.trim().toLowerCase();

    const next = profiles.filter((item) => {
      const nickname = item.nickname?.toLowerCase() ?? '';
      const email = item.email?.toLowerCase() ?? '';
      return nickname.includes(clean) || email.includes(clean);
    });

    setSearchResults(next);
    setSearching(false);
  };

  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.orange} />
      </View>
    );
  }

  const listData = searchQuery.trim().length > 0 ? searchResults : profiles;

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image
          source={require('../../visual/background.png')}
          style={styles.background}
          resizeMode="cover"
        />
      </View>

      <View style={styles.fixedHeader}>
        <LogoCorner />
        <Text style={styles.headerTitle}>{t('profiles.headerTitle')}</Text>
        <TouchableOpacity onPress={backFunction} style={styles.topActionContainer}>
          <Text style={styles.topActionText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('profiles.searchPlaceholder')}
            placeholderTextColor={COLORS.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {searching && (
          <View style={styles.searchStatus}>
            <ActivityIndicator size="small" color={COLORS.orange} />
            <Text style={styles.searchStatusText}>{t('common.searching')}</Text>
          </View>
        )}

        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const label =
              (item.nickname && item.nickname.trim()) ||
              (item.email && item.email.trim()) ||
              t('profiles.unnamedProfile');

            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() =>
                  router.push({
                    pathname: '/profile/[id]',
                    params: { id: item.id },
                  })
                }
              >
                <Text style={styles.cardProfile}>{label}</Text>
                {item.email && <Text style={styles.cardSub}>{item.email}</Text>}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {searchQuery.trim().length > 0 ? t('profiles.notFound') : t('profiles.empty')}
            </Text>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { width: '100%', height: '100%' },
  container: { flex: 1, backgroundColor: 'transparent', paddingTop: 30 },
  content: { flex: 1, zIndex: 1, paddingTop: 72 },
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B2A3A',
    textAlign: 'center',
    paddingBottom: 14,
  },
  topActionContainer: { position: 'absolute', right: 16, top: 25 },
  topActionText: { color: '#1B2A3A', fontSize: 16, fontWeight: '600', padding: 6 },
  searchContainer: {
    flexDirection: 'row',
    paddingTop: 16,
    padding: 15,
    backgroundColor: COLORS.cream,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    color: COLORS.blueDark,
    backgroundColor: COLORS.cream,
  },
  searchStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
    paddingBottom: 10,
    backgroundColor: COLORS.cream,
  },
  searchStatusText: { color: COLORS.textSecondary, fontSize: 13 },
  card: {
    backgroundColor: COLORS.creamGlass,
    margin: 10,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardProfile: { fontSize: 18, fontWeight: 'bold', marginBottom: 5, color: COLORS.blueDark },
  cardSub: { color: COLORS.textSecondary },
  emptyText: { textAlign: 'center', marginTop: 50, color: COLORS.textSecondary },
});
