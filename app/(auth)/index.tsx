/* Archivo: app/(auth)/index.tsx
Pantalla principal. Lista cargas, permite buscar cargas por DO, origen o destino
y en caso de usuario interno, muestra acciones de administracion.
*/

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

// Modelo minimo usado para renderizar cada tarjeta de carga.
type ShipmentListItem = {
  id: string;
  do_number: string;
  origin: string;
  destination: string;
  current_status: string;
  incoterm?: string | null;
};

// Evita guardar como error los rechazos de promesas canceladas por navegacion o recarga.
const isAbortError = (error: unknown) =>
  error instanceof Error &&
  (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted'));

export default function Dashboard() {
  // Valor del buscador.
  const [searchQuery, setSearchQuery] = useState('');
  // Datos completos que devuelve la consulta inicial.
  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  // Resultados filtrados por texto.
  const [searchResults, setSearchResults] = useState<ShipmentListItem[]>([]);
  // Estado de busqueda para uso visual.
  const [searching, setSearching] = useState(false);
  // Estado de carga de pantalla.
  const [loading, setLoading] = useState(true);
  // Permiso de usuario interno para habilitar acciones administrativas.
  const [isInternal, setIsInternal] = useState(false);

  // Carga inicial de usuario, rol y cargas.
  useEffect(() => {
    console.log('SUPABASE_ANON_KEY:', supabaseAnonKey);
    void loadUserAndShipments();
  }, []);

  // Debounce. Evita una consulta por cada tecla que presione el usuario.
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(() => {
      void searchShipment(searchQuery.trim());
    }, 300);

      return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Valida sesion, determina rol interno y obtiene lista de cargas visible por RLS.
  const loadUserAndShipments = async () => {
    // Manejo de errores con try/catch y validacion de sesion.
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/login');
        return;
      }
      // Consulta el perfil para determinar si el usuario es interno.
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_internal')
        .eq('id', user.id)
        .single();

      setIsInternal(profile?.is_internal || false);
      // Consulta las cargas visibles para este usuario, ordenadas por fecha de creacion.
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShipments(data || []);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Error cargando cargas:', error);
    } finally {
      setLoading(false);
    }
  };

  // Consulta por DO, origen o destino, usa ilike para ignore case, se ordena descendentemente por fecha de creación.
  const searchShipment = async (cleanQuery: string) => {
    try {
      setSearching(true);
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .or(`do_number.ilike.%${cleanQuery}%,origin.ilike.%${cleanQuery}%,destination.ilike.%${cleanQuery}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Error buscando cargas:', error);
    } finally {
      setSearching(false);
    }
  };

  // Cierra sesion y envia al login.
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.orange} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        <Image
          source={require('../../visual/background.png')}
          style={styles.background}
          resizeMode="cover"
        />
      </View>

      <View style={styles.fixedHeader}>
        <LogoCorner />
        <Text style={styles.headerTitle}>
          {isInternal ? 'Cargas Vigentes' : 'Sus Cargas Disponibles'}
        </Text>
        <TouchableOpacity onPress={handleLogout} style={styles.topActionContainer}>
          <Text style={styles.topActionText}>Salir</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Barra de busqueda */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por DO..."
            placeholderTextColor={COLORS.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={() => {
              const clean = searchQuery.trim();
              if (clean) {
                void searchShipment(clean);
              }
            }}
          />
        </View>

        {searching && (
          <View style={styles.searchStatus}>
            <ActivityIndicator size="small" color={COLORS.orange} />
            <Text style={styles.searchStatusText}>Buscando...</Text>
          </View>
        )}

        {/* Acciones visibles solo para usuarios internos */}
        {isInternal && (
          <View style={styles.internalActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/addUser')}>
              <Text style={styles.actionButtonText}>+ Agregar Usuario</Text>
            </TouchableOpacity>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButtonAlt, styles.actionHalf]}
                onPress={() => router.push('/createShipment')}
              >
                <Text style={styles.actionButtonAltText}>+ Crear Carga</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButtonAlt1, styles.actionHalf]}
                onPress={() => router.push('/profiles')}
              >
                <Text style={styles.actionButtonAltText}>Ver Perfiles</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/supportInbox' as any)}>
              <Text style={styles.actionButtonText}>Bandeja Soporte</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.fabAssistant} onPress={() => router.push('/chat')}>
          <Text style={styles.fabAssistantText}>IA</Text>
        </TouchableOpacity>

        {/* Lista de cargas */}
        <FlatList
          data={searchQuery.trim() ? searchResults : shipments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => router.push(`/shipment/${item.id}`)}>
              <Text style={styles.cardDO}>{item.do_number}</Text>
              <Text style={styles.cardRoute}>
                {item.origin} {'->'} {item.destination}
              </Text>
              <Text style={styles.cardStatus}>{item.current_status}</Text>
              {item.incoterm && <Text style={styles.cardIncoterm}>{item.incoterm}</Text>}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {searchQuery.trim().length > 0
                ? 'No se encontraron cargas'
                : 'No hay cargas disponibles'}
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
    gap: 30,
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
  searchStatusText: { color: COLORS.textSecondary, fontSize: 16 },
  internalActions: {
    padding: 15,
    backgroundColor: COLORS.creamGlass,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  fabAssistant: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  fabAssistantText: {
    color: COLORS.cream,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionHalf: {
    flex: 1,
  },
  actionButton: {
    backgroundColor: COLORS.orange,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: { color: COLORS.cream, fontWeight: '700' },
  actionButtonAlt: {
    backgroundColor: COLORS.blue,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonAltText: { color: COLORS.cream, fontWeight: '700' },
  actionButtonAlt1: {
    backgroundColor: COLORS.orange,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  card: {
    backgroundColor: COLORS.creamGlass,
    margin: 10,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardDO: { fontSize: 18, fontWeight: 'bold', marginBottom: 5, color: COLORS.blueDark },
  cardRoute: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 5 },
  cardStatus: { fontSize: 14, color: COLORS.orange, fontWeight: '600' },
  cardIncoterm: { fontSize: 12, color: COLORS.textSecondary, marginTop: 5 },
  emptyText: { textAlign: 'center', marginTop: 50, color: COLORS.textSecondary },
});
