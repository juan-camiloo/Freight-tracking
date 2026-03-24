/* Archivo: app/(auth)/index.tsx
Pantalla principal. Lista cargas, permite buscar cargas por DO, origen o destino
y en caso de usuario interno, muestra acciones de administracion.
*/

import i18n, { setAppLanguage } from '@/i18n';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LogoCorner from '../../components/LogoCorner';
import { supabase } from '../../lib/supabase';

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
// Solo se seleccionan los campos necesarios para la lista, no el shipment completo.
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
  const { t } = useTranslation();
  // Valor actual del campo de busqueda.
  const [searchQuery, setSearchQuery] = useState('');
  // Datos completos devueltos por la carga inicial de cargas.
  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  // Resultados filtrados al buscar; se usa en lugar de shipments cuando hay query activo.
  const [searchResults, setSearchResults] = useState<ShipmentListItem[]>([]);
  // Indicador visual de busqueda en progreso.
  const [searching, setSearching] = useState(false);
  // Indicador de carga inicial de la pantalla.
  const [loading, setLoading] = useState(true);
  // Habilita acciones de administracion si el usuario es interno.
  const [isInternal, setIsInternal] = useState(false);

  // Carga inicial: valida sesion, determina rol e hidrata la lista de cargas.
  useEffect(() => {
    void loadUserAndShipments();
  }, []);

  // Debounce de 300ms para evitar una consulta por cada caracter que escribe el usuario.
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

  // Valida sesion, determina rol interno y obtiene las cargas visibles para el usuario.
  // Las politicas RLS de Supabase filtran automaticamente segun el usuario autenticado.
  const loadUserAndShipments = async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/login');
        return;
      }

      // Consultar el perfil para saber si el usuario puede ver las acciones de admin.
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_internal')
        .eq('id', user.id)
        .single();

      setIsInternal(profile?.is_internal || false);

      // Cargar todas las cargas visibles para este usuario segun RLS,
      // ordenadas por fecha de creacion descendente para mostrar las mas recientes primero.
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
  const toggleLanguage = async ()=> {
    const next = i18n.language === 'es' ? 'en' : 'es';
    await setAppLanguage (next as 'es' | 'en')
  }

  // Busqueda flexible: acepta coincidencias parciales en DO, origen o destino.
  // ilike garantiza busqueda case-insensitive sin transformar el query en cliente.
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

  // Cierra la sesion de Supabase y redirige al login.
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
        {/* Titulo diferenciado segun tipo de usuario para mayor claridad contextual. */}
        <Text style={styles.headerTitle}>
          {isInternal ? t('dashboard.headerInternal') : t('dashboard.headerExternal')}
        </Text>
        <View style= {styles.topActions}>
        <TouchableOpacity onPress={toggleLanguage} >
          <Text style={styles.topActionText}>es/en</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={handleLogout}   
          style={{ minWidth: 60, alignItems: 'center' }}
        >
          <Text 
            style={styles.topActionText} 
            numberOfLines={1}
            adjustsFontSizeToFit
            onLayout={(e) => console.log('Logout width:', e.nativeEvent.layout.width)}
            >
            {t('common.logout')}
            </Text>
        </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {/* Barra de busqueda con debounce activo via useEffect */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('dashboard.searchPlaceholder')}
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
            <Text style={styles.searchStatusText}>{t('common.searching')}</Text>
          </View>
        )}

        {/* Acciones administrativas visibles exclusivamente para usuarios internos */}
        {isInternal && (
          <View style={styles.internalActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/createShipment')}>
              <Text style={styles.actionButtonText}>{t('dashboard.createShipment')}</Text>
            </TouchableOpacity>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButtonAlt, styles.actionHalf]}
                onPress={() => router.push('/addUser')}
              >
                <Text style={styles.actionButtonAltText}>{t('dashboard.addUser')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButtonAlt1, styles.actionHalf]}
                onPress={() => router.push('/profiles')}
              >
                <Text style={styles.actionButtonAltText}>{t('dashboard.viewProfiles')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* FAB flotante: IA para externos, Bandeja Soporte para internos */}
        {isInternal ? (
          <TouchableOpacity style={styles.fabAssistant} onPress={() => router.push('/supportInbox' as any)}>
            <Text style={styles.fabAssistantText}>{t('dashboard.fabTickets')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.fabAssistant} 
            onPress={() => router.push('/chat')}
            onLayout={(e) => console.log('FAB width:', e.nativeEvent.layout.width)}
          >
            <Text 
              style={styles.fabAssistantText} 
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {t('dashboard.fabAssistant')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Lista principal: muestra resultados de busqueda si hay query activo,
            o la lista completa cargada al inicio si no hay filtro aplicado. */}
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
                ? t('dashboard.noShipmentsFound')
                : t('dashboard.noShipmentsAvailable')}
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
    overflow: 'visible'
  },
  
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B2A3A',
    textAlign: 'center',
    paddingBottom: 14,
  },
  topActions: {
    position: 'absolute',
    right: 16,
    top: 30,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    minWidth: 100
  },
  topActionText: { 
    color: '#1B2A3A', 
    fontSize: 16, 
    fontWeight: '600', 
    padding: 6,
    lineHeight: 30,
  },
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
    right: 35,
    bottom: 15,
    minWidth: 100,
    height: 45, 
    borderRadius: 10,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    paddingHorizontal: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    overflow: 'visible'
  },
  fabAssistantText: {
    color: COLORS.cream,
    fontWeight: '700',
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionHalf: { flex: 1 },
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
