// Archivo: app/(auth)/assignShipment/[id].tsx
// Pantalla para asignar una carga existente a un perfil especifico.

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

type ShipmentResult = {
  id: string;
  do_number: string;
  origin: string;
  destination: string;
  current_status?: string | null;
};

const isAbortError = (error: unknown) =>
  error instanceof Error &&
  (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted'));

export default function AssignShipment() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams();
  // Texto de busqueda para encontrar cargas.
  const [query, setQuery] = useState('');
  // Lista de resultados retornados por la busqueda.
  const [results, setResults] = useState<ShipmentResult[]>([]);
  // Estado visual para mostrar "buscando".
  const [searching, setSearching] = useState(false);
  // Perfil destino al que se asigna la carga.
  const [profile, setProfile] = useState<any>(null);
  // Estado de asignacion por carga.
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignedShipmentIds, setAssignedShipmentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Debounce de la busqueda para evitar consultar en cada tecla.
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

  useEffect(() => {
    if (id) {
      void getData();
      void loadAssignedShipments();
    }
  }, [id]);

  // Carga el perfil destino con el ID de la ruta.
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

  // Carga las cargas ya asignadas a este perfil para marcar estado.
  const loadAssignedShipments = async () => {
    const clientId = String(id ?? '');
    if (!clientId) return;

    try {
      const { data, error } = await supabase
        .from('profile_shipment')
        .select('shipment_id')
        .eq('client_id', clientId);

      if (error) throw error;
      const ids = new Set((data ?? []).map((row: { shipment_id: string }) => row.shipment_id));
      setAssignedShipmentIds(ids);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Error cargando asignaciones:', error);
    }
  };

  // Relaciona la carga con el perfil y dispara notificacion.
  const handleAssign = async (shipmentId: string) => {
    const clientId = String(id ?? '');
    if (!clientId) {
      Alert.alert(t('common.error'), t('assignShipment.invalidProfileId'));
      return;
    }

    try {
      setAssigningId(shipmentId);
      const { error } = await supabase
        .from('profile_shipment')
        .upsert({ client_id: clientId, shipment_id: shipmentId }, { onConflict: 'client_id,shipment_id' });

      if (error) throw error;

      setAssignedShipmentIds((prev) => new Set(prev).add(shipmentId));

      await notifyShipmentEvent({
        eventType: 'assigned',
        shipmentId,
        targetUserId: clientId,
      });

      Alert.alert(
        t('common.success'),
        t('assignShipment.assignedOk', { shipmentId, clientId }),
      );
    } catch (error) {
      console.error('Error asignando carga:', error);
      Alert.alert(t('common.error'), t('assignShipment.assignError'));
    } finally {
      setAssigningId(null);
    }
  };

  // Navegacion segura al perfil anterior o fallback.
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
        <Text style={styles.headerTitle}>{t('assignShipment.headerTitle')}</Text>
        <TouchableOpacity onPress={backFunction} style={styles.topActionContainer}>
          <Text style={styles.topActionText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.form}>
          <Text style={styles.subtitle}>{t('assignShipment.targetProfile')}</Text>
          {profile ? (
            <>
              <Text style={styles.shipmentId}>{profile.nickname}</Text>
              <Text style={styles.email}>{profile.email}</Text>
            </>
          ) : (
            <Text style={styles.shipmentId}>{t('assignShipment.loadingProfile')}</Text>
          )}

          <Text style={styles.label}>{t('assignShipment.searchLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('assignShipment.searchPlaceholder')}
            placeholderTextColor={COLORS.placeholder}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => {
              const clean = query.trim();
              if (clean) {
                void searchShipments(clean);
              }
            }}
          />

          {searching && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={COLORS.orange} />
              <Text style={styles.loadingText}>{t('common.searching')}</Text>
            </View>
          )}

          {results.length === 0 && !searching && query.trim().length > 0 && (
            <Text style={styles.emptyText}>{t('assignShipment.notFound')}</Text>
          )}

          {results.map((item) => (
            <View key={item.id} style={styles.resultCard}>
              <View style={styles.resultInfo}>
                <Text style={styles.resultTitle}>{item.do_number}</Text>
                <Text style={styles.resultSub}>{item.origin} {'->'} {item.destination}</Text>
                {item.current_status ? <Text style={styles.resultStatus}>{item.current_status}</Text> : null}
              </View>
              <TouchableOpacity
                style={[
                  styles.resultButton,
                  (assigningId === item.id || assignedShipmentIds.has(item.id)) && styles.resultButtonDisabled,
                ]}
                onPress={() => handleAssign(item.id)}
                disabled={assigningId === item.id || assignedShipmentIds.has(item.id)}
              >
                <Text style={styles.resultButtonText}>
                  {assigningId === item.id
                    ? t('assignShipment.assigning')
                    : assignedShipmentIds.has(item.id)
                      ? t('assignShipment.assigned')
                      : t('assignShipment.assign')}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { width: '100%', height: '100%' },
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { zIndex: 1, paddingBottom: 20, paddingTop: 80 },
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
  form: {
    margin: 16,
    padding: 20,
    backgroundColor: COLORS.creamGlass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 6 },
  shipmentId: { fontSize: 14, fontWeight: '700', color: COLORS.blueDark, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: COLORS.blueDark },
  input: {
    borderWidth: 1,
    borderColor: COLORS.blueMid,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: COLORS.cream,
    color: COLORS.blueDark,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  loadingText: { color: COLORS.textSecondary, fontSize: 13 },
  emptyText: { marginTop: 12, color: COLORS.textSecondary },
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
  resultInfo: { flex: 1 },
  resultTitle: { fontSize: 16, fontWeight: '700', color: COLORS.blueDark },
  resultSub: { marginTop: 2, fontSize: 12, color: COLORS.textSecondary },
  resultStatus: { marginTop: 4, fontSize: 12, color: COLORS.orange, fontWeight: '600' },
  resultButton: {
    backgroundColor: COLORS.blue,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  resultButtonDisabled: {
    opacity: 0.6,
  },
  email: { fontSize: 14, color: '#525f6e', marginBottom: 16, marginTop: -15 },
  resultButtonText: { color: COLORS.cream, fontWeight: '700' },
});
