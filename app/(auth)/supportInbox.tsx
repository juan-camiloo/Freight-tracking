// Pantalla de bandeja de tickets de soporte (actualmente comentada/desactivada).
// Flujo esperado:
// 1) Validar que el usuario sea interno.
// 2) Cargar tickets, areas y perfiles relacionados.
// 3) Permitir tomar ticket y cerrarlo desde la UI.
/*import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LogoCorner from '../../components/LogoCorner';
import { supabase } from '../../lib/supabase';

type Ticket = {
  id: string;
  user_id: string;
  area_id: string | null;
  assigned_to: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'closed';
  handoff_reason: string | null;
  ai_confidence: number | null;
  created_at: string;
};

type Area = {
  id: string;
  name: string;
};

type Profile = {
  id: string;
  nickname: string | null;
  email: string | null;
};

const COLORS = {
  blue: '#1E5F99',
  blueDark: '#1B2A3A',
  orange: '#F28A07',
  cream: '#FFF6EC',
  creamGlass: 'rgba(255, 246, 236, 0.92)',
  textSecondary: '#6B7C8F',
  border: '#D7E3EE',
};

export default function SupportInbox() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [areasById, setAreasById] = useState<Record<string, string>>({});
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    void bootstrap();
  }, []);

  const bootstrap = async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/login');
        return;
      }

      setCurrentUserId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_internal')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.is_internal) {
        Alert.alert('No autorizado', 'Esta pantalla es solo para personal interno');
        router.replace('/');
        return;
      }

      await loadData();
    } catch (error) {
      console.error('Error cargando bandeja:', error);
      Alert.alert('Error', 'No se pudo cargar la bandeja');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    const [{ data: areas }, { data: ticketRows, error: ticketsError }] = await Promise.all([
      supabase.from('support_areas').select('id, name'),
      supabase.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(100),
    ]);

    if (ticketsError) throw ticketsError;

    const mapAreas: Record<string, string> = {};
    (areas as Area[] | null)?.forEach((area) => {
      mapAreas[area.id] = area.name;
    });
    setAreasById(mapAreas);

    const loadedTickets = (ticketRows as Ticket[]) || [];
    setTickets(loadedTickets);

    const profileIds = Array.from(
      new Set(
        loadedTickets
          .flatMap((ticket) => [ticket.user_id, ticket.assigned_to])
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (profileIds.length === 0) {
      setProfilesById({});
      return;
    }

    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, nickname, email')
      .in('id', profileIds);

    const mapProfiles: Record<string, Profile> = {};
    (profileRows as Profile[] | null)?.forEach((profile) => {
      mapProfiles[profile.id] = profile;
    });
    setProfilesById(mapProfiles);
  };

  const handleClaim = async (ticketId: string) => {
    if (!currentUserId) return;
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ assigned_to: currentUserId, status: 'in_progress' })
        .eq('id', ticketId);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error tomando ticket:', error);
      Alert.alert('Error', 'No se pudo tomar el ticket');
    }
  };

  const handleClose = async (ticketId: string) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: 'closed' })
        .eq('id', ticketId);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error cerrando ticket:', error);
      Alert.alert('Error', 'No se pudo cerrar el ticket');
    }
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

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image source={require('../../visual/background.png')} style={styles.background} resizeMode="cover" />
      </View>

      <View style={styles.fixedHeader}>
        <LogoCorner />
        <Text style={styles.headerTitle}>Bandeja Soporte</Text>
        <TouchableOpacity onPress={backFunction} style={styles.topActionContainer}>
          <Text style={styles.topActionText}>Volver</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay tickets</Text>}
          renderItem={({ item }) => {
            const requester = profilesById[item.user_id];
            const assignee = item.assigned_to ? profilesById[item.assigned_to] : null;
            const areaName = item.area_id ? areasById[item.area_id] : 'sin_area';

            return (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Area: {areaName}</Text>
                <Text style={styles.cardMeta}>Estado: {item.status}</Text>
                <Text style={styles.cardMeta}>Prioridad: {item.priority}</Text>
                <Text style={styles.cardMeta}>
                  Cliente: {requester?.nickname || requester?.email || item.user_id}
                </Text>
                <Text style={styles.cardMeta}>
                  Asignado a: {assignee?.nickname || assignee?.email || 'Sin asignar'}
                </Text>
                {item.handoff_reason ? <Text style={styles.reason}>Motivo: {item.handoff_reason}</Text> : null}
                {typeof item.ai_confidence === 'number' ? (
                  <Text style={styles.cardMeta}>Confianza : {(item.ai_confidence * 100).toFixed(1)}%</Text>
                ) : null}
                <View style={styles.actions}>
                  {!item.assigned_to && item.status !== 'closed' && (
                    <TouchableOpacity style={styles.actionButton} onPress={() => handleClaim(item.id)}>
                      <Text style={styles.actionButtonText}>Tomar</Text>
                    </TouchableOpacity>
                  )}
                  {item.status !== 'closed' && (
                    <TouchableOpacity style={styles.actionButtonAlt} onPress={() => handleClose(item.id)}>
                      <Text style={styles.actionButtonText}>Cerrar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { width: '100%', height: '100%' },
  container: { flex: 1, backgroundColor: 'transparent', paddingTop: 30 },
  content: { flex: 1, zIndex: 1, paddingTop: 72, paddingHorizontal: 12 },
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
    color: COLORS.blueDark,
    textAlign: 'center',
    paddingBottom: 14,
  },
  topActionContainer: { position: 'absolute', right: 16, top: 25 },
  topActionText: { color: COLORS.blueDark, fontSize: 16, fontWeight: '600', padding: 6 },
  card: {
    backgroundColor: COLORS.creamGlass,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  cardTitle: {
    color: COLORS.blueDark,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardMeta: {
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  reason: {
    color: COLORS.blueDark,
    marginVertical: 6,
  },
  actions: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionButtonAlt: {
    backgroundColor: COLORS.orange,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionButtonText: {
    color: COLORS.cream,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginTop: 24,
  },
});*/
