// Archivo: app/(auth)/profile/[id].tsx
// Descripcion: Pantalla de detalle de perfil. Muestra datos basicos y permite navegar a asignacion de carga.

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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
  // ID del perfil a visualizar.
  const { id } = useLocalSearchParams();

  // Estado de permisos/usuario actual.
  const [isOwner, setIsOwner] = useState(false);
  const [isInternal, setIsInternal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Perfil cargado y estado visual.
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Carga inicial de datos del perfil.
  useEffect(() => {
    void loadProfileDetails();
  }, [id]);

  // Valida sesion, rol y carga datos del perfil solicitado.
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

      setUserId(user.id);

      const { data: ownProfile } = await supabase
        .from('profiles')
        .select('is_internal')
        .eq('id', user.id)
        .single();

      setIsInternal(ownProfile?.is_internal || false);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData);
      setIsOwner(profileData?.id === user.id);
    } catch (error) {
      console.error('Error cargando perfil:', error);
      alert('Error al cargar perfil');
    } finally {
      setLoading(false);
    }
  };

  // Navegacion atras segura con alternativa a listado de perfiles.
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
        <Text>Perfil no encontrado</Text>
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
        <LogoCorner />
        <Text style={styles.headerTitle}>Perfil</Text>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={backFunction}>
            <Text style={styles.topActionText}>Volver</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push(`/assignShipment/${id}`)}>
            <Text style={styles.topActionText}>Asignar Carga</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informacion</Text>
          <InfoRow label="Correo" value={profile.email || ''} />
          <InfoRow label="Alias" value={profile.nickname || ''} />
        </View>
      </ScrollView>
    </View>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
};

// Fila reutilizable para mostrar datos label/valor.
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
  // Clase personalizada: imagen de fondo completa.
  background: { width: '100%', height: '100%' },
  // Clase personalizada: contenedor raiz de pantalla.
  container: { flex: 1, backgroundColor: 'transparent' },
  // Clase personalizada: scroll principal.
  scroll: { flex: 1 },
  // Clase personalizada: area interna con separacion del header.
  content: { zIndex: 1, paddingBottom: 20, paddingTop: 100 },
  // Clase personalizada: centrado para estados de carga o vacio.
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Clase personalizada: encabezado fijo superior.
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
  // Clase personalizada: titulo del header.
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B2A3A',
    textAlign: 'center',
    paddingBottom: 14,
  },
  // Clase personalizada: contenedor de botones de accion del header.
  topActions: {
    position: 'absolute',
    right: 16,
    top: 25,
    flexDirection: 'row',
    gap: 8,
  },
  // Clase personalizada: texto de botones del header.
  topActionText: { color: '#1B2A3A', fontSize: 16, fontWeight: '600', padding: 6 },
  // Clase personalizada: tarjeta de informacion del perfil.
  section: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 15,
    borderRadius: 8,
  },
  // Clase personalizada: titulo de seccion.
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  // Clase personalizada: fila de informacion label/valor.
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  // Clase personalizada: etiqueta del dato.
  infoLabel: { width: 140, fontWeight: '600', color: '#666' },
  // Clase personalizada: valor del dato.
  infoValue: { flex: 1, color: '#333' },
});

