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

// Evita loguear como error cancelaciones de promesas por navegacion o recarga.
const isAbortError = (error: unknown) =>
  error instanceof Error &&
  (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted'));

export default function Profiles() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  // Lista completa de perfiles cargada desde la Edge Function.
  const [profiles, setProfiles] = useState<Profile[]>([]);
  // Subconjunto filtrado localmente mientras el usuario escribe.
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  // Indicador visual del filtrado en progreso.
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  const resolveErrorMessage = async (response: Response, fallbackMessage: string) => {
    try {
      const text = await response.text();
      if (text) {
        try {
          const payload = JSON.parse(text);
          if (typeof payload?.error_key === 'string') {
            return t(payload.error_key, payload.error_params ?? {});
          }
          if (typeof payload?.reason_key === 'string') {
            return t(payload.reason_key, payload.reason_params ?? {});
          }
          if (typeof payload?.error === 'string') return payload.error;
          if (typeof payload?.reason === 'string') return payload.reason;
        } catch {
          return text;
        }
      }
    } catch {
      // ignore response parsing errors
    }
    return fallbackMessage;
  };

  useEffect(() => {
    void loadUserAndProfiles();
  }, []);

  // Debounce de 250ms para filtrar localmente sin saturar el hilo principal
  // y mostrar feedback visual (ruedita de carga).
  // Se incluye profiles como dependencia porque el filtro opera sobre ese array.
  useEffect(() => {
    const clean = searchQuery.trim();
    if (!clean) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeout = setTimeout(() => {
      filterProfiles(clean);
      setSearching(false);
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchQuery, profiles]);

  // Valida sesion y carga todos los perfiles via Edge Function.
  // Se usa la Edge Function en lugar de consultar Supabase directo porque
  // la tabla profiles puede tener RLS que limite la visibilidad entre usuarios.
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
        const errorMessage = await resolveErrorMessage(response, t('profiles.loadError'));
        throw new Error(errorMessage);
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

  // Filtra localmente sobre el array ya cargado en memoria.
  // No requiere nueva consulta al servidor porque los perfiles son pocos
  // y la lista completa ya esta disponible tras la carga inicial.
  const filterProfiles = (cleanQuery: string) => {
    const clean = cleanQuery.trim().toLowerCase();

    const next = profiles.filter((item) => {
      const nickname = item.nickname?.toLowerCase() ?? '';
      const email = item.email?.toLowerCase() ?? '';
      return nickname.includes(clean) || email.includes(clean);
    });

    setSearchResults(next);
  };

  // Navegacion de retorno segura: usa back() si hay historial, reemplaza a raiz si no.
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

  // Si hay busqueda activa se muestran los resultados filtrados; si no, la lista completa.
  const listData = searchQuery.trim().length > 0 ? searchResults : profiles;

  return (
    <View style={styles.container}>
      {/* pointerEvents="none" en el fondo para que los toques pasen a los elementos superiores */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
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
            {t('profiles.headerTitle')}
          </Text>
          <View style={styles.topActions}>
            <TouchableOpacity onPress={backFunction}>
              <Text style={styles.topActionText}>{t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('profiles.searchPlaceholder')}
            placeholderTextColor={COLORS.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={() => {
              const clean = searchQuery.trim();
              if (!clean) {
                setSearchResults([]);
                setSearching(false);
                return;
              }
              filterProfiles(clean);
            }}
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
            // Prioridad de label: nickname > email > texto por defecto.
            // Garantiza que siempre haya algo legible en la tarjeta.
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
  topActionText: { color: '#1B2A3A', fontSize: 16, fontWeight: '600', padding: 6, includeFontPadding: false },
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
