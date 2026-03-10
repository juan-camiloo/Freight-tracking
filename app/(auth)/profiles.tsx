// Archivo: app/(auth)/profiles.tsx
// Descripcion: Pantalla de perfiles para usuarios internos. Permite cargar, buscar y abrir el detalle de cada perfil.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LogoCorner from '../../components/LogoCorner';
import { supabase, supabaseAnonKey } from '../../lib/supabase';

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

// Estructura de perfil usada para renderizar la lista.
type Profile = {
  id: string;
  email: string | null;
  is_internal: boolean;
  nickname?: string | null;
};

// Evita reportar como fallo los rechazos por abort de peticiones en navegacion.
const isAbortError = (error: unknown) =>
  error instanceof Error &&
  (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted'));

export default function Profiles() {
  // Texto del filtro de busqueda.
  const [searchQuery, setSearchQuery] = useState('');
  // Lista completa recibida desde la funcion server-side.
  const [profiles, setProfiles] = useState<Profile[]>([]);
  // Resultados filtrados por busqueda local.
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  // Estado visual para mostrar "Buscando...".
  const [searching, setSearching] = useState(false);
  // Estado de carga inicial.
  const [loading, setLoading] = useState(true);

  // Carga de datos inicial al abrir la pantalla.
  useEffect(() => {
    void loadUserAndProfiles();
  }, []);

  // Debounce para ejecutar filtrado local sin recalcular en cada tecla.
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

  // Valida sesion y consulta perfiles usando la Edge Function protegida.
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
        Alert.alert('Error', 'No hay sesion activa');
        return;
      }

      const response = await fetch(
        'https://wmzafpkrmyhxbvymdjgu.supabase.co/functions/v1/list-profiles',
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
        throw new Error(errorText || 'No se pudieron cargar perfiles');
      }

      const data = await response.json();
      setProfiles(data || []);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Error cargando perfiles:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Algo salio mal... Intentalo de nuevo');
    } finally {
      setLoading(false);
    }
  };

  // Filtra la lista en memoria por alias o correo.
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

  // Navegacion segura hacia atras con alternativa al dashboard.
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
        <Text style={styles.headerTitle}>Perfiles</Text>
        <TouchableOpacity onPress={backFunction} style={styles.topActionContainer}>
          <Text style={styles.topActionText}>Volver</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por alias o correo..."
            placeholderTextColor={COLORS.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {searching && (
          <View style={styles.searchStatus}>
            <ActivityIndicator size="small" color={COLORS.orange} />
            <Text style={styles.searchStatusText}>Buscando...</Text>
          </View>
        )}

        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const label =
              (item.nickname && item.nickname.trim()) ||
              (item.email && item.email.trim()) ||
              'Perfil sin alias';

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
              {searchQuery.trim().length > 0
                ? 'No se encontraron perfiles'
                : 'No hay perfiles disponibles'}
            </Text>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Clase personalizada: imagen de fondo de pantalla completa.
  background: { width: '100%', height: '100%' },
  // Clase personalizada: contenedor raiz de la pantalla de perfiles.
  container: { flex: 1, backgroundColor: 'transparent', paddingTop: 30 },
  // Clase personalizada: area principal debajo del encabezado fijo.
  content: { flex: 1, zIndex: 1, paddingTop: 72 },
  // Clase personalizada: centrado para estados de carga.
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Clase personalizada: header fijo con titulo y accion de regreso.
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
  // Clase personalizada: titulo del encabezado.
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B2A3A',
    textAlign: 'center',
    paddingBottom: 14,
  },
  // Clase personalizada: contenedor del boton volver en el header.
  topActionContainer: { position: 'absolute', right: 16, top: 25 },
  // Clase personalizada: texto del boton volver.
  topActionText: { color: '#1B2A3A', fontSize: 16, fontWeight: '600', padding: 6 },
  // Clase personalizada: contenedor de la barra de busqueda.
  searchContainer: {
    flexDirection: 'row',
    paddingTop: 16,
    padding: 15,
    backgroundColor: COLORS.cream,
  },
  // Clase personalizada: input de busqueda de perfiles.
  searchInput: {
    flex: 1,
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    color: COLORS.blueDark,
    backgroundColor: COLORS.cream,
  },
  // Clase personalizada: fila de estado mientras se filtra o consulta.
  searchStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
    paddingBottom: 10,
    backgroundColor: COLORS.cream,
  },
  // Clase personalizada: texto de estado de busqueda.
  searchStatusText: { color: COLORS.textSecondary, fontSize: 13 },
  // Clase personalizada: tarjeta por perfil en la lista.
  card: {
    backgroundColor: COLORS.creamGlass,
    margin: 10,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  // Clase personalizada: alias o nombre visible del perfil.
  cardProfile: { fontSize: 18, fontWeight: 'bold', marginBottom: 5, color: COLORS.blueDark },
  // Clase personalizada: correo mostrado como texto secundario.
  cardSub: { color: COLORS.textSecondary },
  // Clase personalizada: mensaje cuando la lista esta vacia.
  emptyText: { textAlign: 'center', marginTop: 50, color: COLORS.textSecondary },
});

