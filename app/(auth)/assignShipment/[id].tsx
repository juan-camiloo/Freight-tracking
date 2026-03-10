// Archivo: app/(auth)/assignShipment/[id].tsx
// Pantalla para asignar una carga existente a un perfil especifico.

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LogoCorner from '../../../components/LogoCorner';
import { notifyShipmentEvent } from '../../../lib/shipmentNotifications';
import { supabase } from '../../../lib/supabase';

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

// Datos minimos que se muestran por cada resultado de carga en la busqueda.
type ShipmentResult = {
  id: string;
  do_number: string;
  origin: string;
  destination: string;
  current_status?: string | null;
};

// Ignora aborts de promesas para evitar errores falsos en navegacion.
const isAbortError = (error: unknown) =>
  error instanceof Error &&
  (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted'));

export default function AssignShipment() {
  // ID del perfil recibido por ruta dinamica /assignShipment/[id].
  const { id } = useLocalSearchParams();
  // Texto actual del buscador.
  const [query, setQuery] = useState('');
  // Resultados de cargas que coinciden con la busqueda.
  const [results, setResults] = useState<ShipmentResult[]>([]);
  // Estado visual de busqueda en progreso.
  const [searching, setSearching] = useState(false);
  // Datos del perfil destino para confirmar a quien se asigna.
  const [profile, setProfile] = useState<any>(null);

  // Debounce de busqueda para no consultar en cada tecla.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(() => {
      void searchShipments(query.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  // Busca cargas por DO, origen o destino.
  const searchShipments = async (cleanQuery: string) => {
    try {
      setSearching(true);
      const { data, error } = await supabase
        .from('shipments')
        .select('id, do_number, origin, destination, current_status')
        .or(`do_number.ilike.%${cleanQuery}%,origin.ilike.%${cleanQuery}%,destination.ilike.%${cleanQuery}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Error buscando cargas:', error);
    } finally {
      setSearching(false);
    }
  };

  // Carga la informacion del perfil destino cuando cambia el id de ruta.
  useEffect(() => {
    if (id) {
      void getData();
    }
  }, [id]);

  // Consulta el perfil que recibira la asignacion.
  const getData = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (profileError) {
        console.error('Error cargando perfil destino:', profileError);
        return;
      }

      setProfile(profileData);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Error cargando perfil destino:', error);
    }
  };

  // Inserta o actualiza la relacion perfil-carga en la tabla intermedia.
  const handleAssign = async (shipmentId: string) => {
    const clientId = String(id ?? '');
    if (!clientId) {
      Alert.alert('Error', 'ID de perfil no valido');
      return;
    }

    try {
      const { error } = await supabase
        .from('profile_shipment')
        .upsert({ profile_id: clientId, shipment_id: shipmentId }, { onConflict: 'shipment_id' });

      if (error) throw error;

      await notifyShipmentEvent({
        eventType: 'assigned',
        shipmentId,
        targetUserId: clientId,
      });

      Alert.alert('Listo', `Carga ${shipmentId} asignada al perfil ${clientId}`);
    } catch (error) {
      console.error('Error asignando carga:', error);
      Alert.alert('Error', 'No se pudo asignar la carga');
    }
  };

  // Navega atras y, si no hay historial, vuelve al detalle del perfil.
  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace({
        pathname: '/profile/[id]',
        params: { id: String(id ?? '') },
      });
    }
  };

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
        <LogoCorner />
        <Text style={styles.headerTitle}>Asignar Carga</Text>
        <TouchableOpacity onPress={backFunction} style={styles.topActionContainer}>
          <Text style={styles.topActionText}>Volver</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.form}>
          <Text style={styles.subtitle}>Perfil destino</Text>
          {profile ? (
            <>
              <Text style={styles.shipmentId}>{profile.nickname}</Text>
              <Text style={styles.email}>{profile.email}</Text>
            </>
          ) : (
            <Text style={styles.shipmentId}>Cargando perfil...</Text>
          )}

          <Text style={styles.label}>Buscar carga</Text>
          <TextInput
            style={styles.input}
            placeholder="DO, origen o destino..."
            placeholderTextColor={COLORS.placeholder}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />

          {searching && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={COLORS.orange} />
              <Text style={styles.loadingText}>Buscando...</Text>
            </View>
          )}

          {results.length === 0 && !searching && query.trim().length > 0 && (
            <Text style={styles.emptyText}>No se encontraron cargas</Text>
          )}

          {results.map((item) => (
            <View key={item.id} style={styles.resultCard}>
              <View style={styles.resultInfo}>
                <Text style={styles.resultTitle}>{item.do_number}</Text>
                <Text style={styles.resultSub}>{item.origin} {'→'} {item.destination}</Text>
                {item.current_status ? <Text style={styles.resultStatus}>{item.current_status}</Text> : null}
              </View>
              <TouchableOpacity style={styles.resultButton} onPress={() => handleAssign(item.id)}>
                <Text style={styles.resultButtonText}>Asignar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Clase personalizada: imagen de fondo de pantalla completa.
  background: { width: '100%', height: '100%' },
  // Clase personalizada: contenedor raiz de la pantalla.
  container: { flex: 1, backgroundColor: 'transparent' },
  // Clase personalizada: contenedor de scroll para contenido largo.
  scroll: { flex: 1 },
  // Clase personalizada: zona interna desplazable debajo del header.
  content: { zIndex: 1, paddingBottom: 20, paddingTop: 80 },
  // Clase personalizada: encabezado fijo con titulo y accion de regreso.
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
  // Clase personalizada: texto del titulo del encabezado.
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B2A3A',
    textAlign: 'center',
    paddingBottom: 14,
  },
  // Clase personalizada: contenedor del boton volver.
  topActionContainer: { position: 'absolute', right: 16, top: 25 },
  // Clase personalizada: texto del boton volver.
  topActionText: { color: '#1B2A3A', fontSize: 16, fontWeight: '600', padding: 6 },
  // Clase personalizada: tarjeta principal del formulario de asignacion.
  form: {
    margin: 16,
    padding: 20,
    backgroundColor: COLORS.creamGlass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  // Clase personalizada: subtitulo descriptivo del bloque de perfil destino.
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 6 },
  // Clase personalizada: nombre o alias del perfil destino.
  shipmentId: { fontSize: 14, fontWeight: '700', color: COLORS.blueDark, marginBottom: 16 },
  // Clase personalizada: etiqueta de campo de entrada.
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: COLORS.blueDark },
  // Clase personalizada: input de texto para buscar cargas.
  input: {
    borderWidth: 1,
    borderColor: COLORS.blueMid,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: COLORS.cream,
    color: COLORS.blueDark,
  },
  // Clase personalizada: fila de estado de busqueda con spinner.
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  // Clase personalizada: texto "Buscando...".
  loadingText: { color: COLORS.textSecondary, fontSize: 13 },
  // Clase personalizada: mensaje cuando no hay resultados.
  emptyText: { marginTop: 12, color: COLORS.textSecondary },
  // Clase personalizada: tarjeta de resultado por cada carga encontrada.
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.cream,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  // Clase personalizada: bloque de texto dentro de la tarjeta de resultado.
  resultInfo: { flex: 1 },
  // Clase personalizada: texto DO destacado del resultado.
  resultTitle: { fontSize: 16, fontWeight: '700', color: COLORS.blueDark },
  // Clase personalizada: texto de ruta origen-destino del resultado.
  resultSub: { marginTop: 2, fontSize: 12, color: COLORS.textSecondary },
  // Clase personalizada: estado actual de la carga en resultado.
  resultStatus: { marginTop: 4, fontSize: 12, color: COLORS.orange, fontWeight: '600' },
  // Clase personalizada: boton para confirmar asignacion de una carga.
  resultButton: {
    backgroundColor: COLORS.blue,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  // Clase personalizada: correo del perfil destino.
  email: { fontSize: 14, color: '#525f6e', marginBottom: 16, marginTop: -15 },
  // Clase personalizada: texto del boton de asignar.
  resultButtonText: { color: COLORS.cream, fontWeight: '700' },
});
