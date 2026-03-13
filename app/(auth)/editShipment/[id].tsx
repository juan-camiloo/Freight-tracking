// Archivo: app/(auth)/editShipment/[id].tsx
// Descripcion: Pantalla para editar una carga existente y registrar una observacion en el historial si aplica.

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

export default function EditShipment() {
  // ID de la carga a editar, tomado de la ruta dinamica.
  const { id } = useLocalSearchParams();

  // Estados visuales de carga y guardado.
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Campos editables del formulario.
  const [doNumber, setDoNumber] = useState('');
  const [currentStatus, setCurrentStatus] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [exporter, setExporter] = useState('');
  const [consignee, setConsignee] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [observation, setObservation] = useState('');
  const [clientId, setClientId] = useState('');

  // Carga los datos al abrir la pantalla o cuando cambia el id.
  useEffect(() => {
    void loadShipment();
  }, [id]);

  // Consulta la carga actual para poblar los campos del formulario.
  // Consulta datos actuales de la carga en DB.
  const loadShipment = async () => {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setDoNumber(data.do_number || '');
      setCurrentStatus(data.current_status || '');
      setCurrentLocation(data.current_location || '');
      setExporter(data.exporter || '');
      setConsignee(data.consignee || '');
      setOrigin(data.origin || '');
      setDestination(data.destination || '');
      setClientId(data.client_id || '');
    } catch {
      Alert.alert('Error', 'No se pudo cargar la carga');
    } finally {
      setLoading(false);
    }
  };

  // Guarda los cambios en shipments y opcionalmente agrega un registro en shipment_updates.
  // Valida y guarda cambios. Registra observacion si aplica.
  const handleSave = async () => {
    if (!doNumber || !origin || !destination) {
      Alert.alert('Error', 'DO, origen y destino son obligatorios');
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('shipments')
        .update({
          do_number: doNumber,
          current_status: currentStatus,
          current_location: currentLocation,
          exporter,
          consignee,
          origin,
          destination,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      if (observation) {
        const { error: updateLogError } = await supabase.from('shipment_updates').insert({
          shipment_id: id,
          status: currentStatus,
          location: currentLocation,
          observation,
        });

        if (updateLogError) throw updateLogError;
      }

      await notifyShipmentEvent({
        eventType: 'updated',
        shipmentId: String(id ?? ''),
        doNumber,
        status: currentStatus,
      });

      Alert.alert('Exito', 'Carga actualizada');
      router.replace('/');
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Error', 'Algo salio mal... Intenta nuevamente');
      }
    } finally {
      setSaving(false);
    }
  };

  // Modal de confirmacion para eliminar carga.
  const handleDelete = () => {
    Alert.alert('Eliminar carga', 'Esta acción no se puede deshacer. ¿Deseas continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          void confirmDelete();
        },
      },
    ]);
  };

  // Elimina en DB y notifica al usuario asignado.
  const confirmDelete = async () => {
    const shipmentId = String(id ?? '');
    if (!shipmentId) {
      Alert.alert('Error', 'ID de carga invalido');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('shipments').delete().eq('id', shipmentId);
      if (error) throw error;

      await notifyShipmentEvent({
        eventType: 'deleted',
        shipmentId,
        targetUserId: clientId || undefined,
        doNumber,
      });

      Alert.alert('Exito', 'Carga eliminada');
      router.replace('/');
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Error', 'No se pudo eliminar la carga');
      }
    } finally {
      setSaving(false);
    }
  };

  // Vuelve atras y, si no hay historial, abre el detalle de la carga.
  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace({
      pathname: '/shipment/[id]',
      params: { id: String(id ?? '') },
    });
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
          source={require('../../../visual/background.png')}
          style={styles.background}
          resizeMode="cover"
        />
      </View>

      <View style={styles.fixedHeader}>
        <LogoCorner />
        <Text style={styles.headerTitle}>Editar Carga</Text>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={backFunction}>
            <Text style={styles.topActionText}>Volver</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} disabled={saving}>
            <Text style={[styles.topActionText, styles.deleteText, saving && styles.disabled]}>Eliminar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.topActionText, saving && styles.disabled]}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.form}>
          <InputField label="DO Number *" value={doNumber} onChangeText={setDoNumber} onSubmitEditing={handleSave} />
          <InputField label="Estado Actual" value={currentStatus} onChangeText={setCurrentStatus} onSubmitEditing={handleSave} />
          <InputField label="Ubicacion Actual" value={currentLocation} onChangeText={setCurrentLocation} onSubmitEditing={handleSave} />
          <InputField label="Exportador" value={exporter} onChangeText={setExporter} onSubmitEditing={handleSave} />
          <InputField label="Consignatario" value={consignee} onChangeText={setConsignee} onSubmitEditing={handleSave} />
          <InputField label="Origen *" value={origin} onChangeText={setOrigin} onSubmitEditing={handleSave} />
          <InputField label="Destino *" value={destination} onChangeText={setDestination} onSubmitEditing={handleSave} />

          <Text style={styles.label}>Observacion (opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Agregar observacion..."
            placeholderTextColor={COLORS.placeholder}
            value={observation}
            onChangeText={setObservation}
            multiline
            numberOfLines={4}
          />
        </View>
      </ScrollView>
    </View>
  );
}

type InputFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing?: () => void;
};

// Componente reutilizable para evitar repetir etiqueta + input.
function InputField({ label, value, onChangeText, onSubmitEditing }: InputFieldProps) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="done"
        onSubmitEditing={onSubmitEditing}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Clase personalizada: imagen de fondo de pantalla completa.
  background: { width: '100%', height: '100%' },
  // Clase personalizada: contenedor raiz de pantalla.
  container: { flex: 1, backgroundColor: 'transparent' },
  // Clase personalizada: scroll principal del formulario.
  scroll: { flex: 1 },
  // Clase personalizada: area interna separada del header.
  content: { zIndex: 1, paddingBottom: 20, paddingTop: 72 },
  // Clase personalizada: centrado para estado de carga inicial.
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Clase personalizada: encabezado fijo con acciones volver/guardar.
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
  // Clase personalizada: fila de acciones en header.
  topActions: {
    position: 'absolute',
    right: 16,
    top: 25,
    flexDirection: 'row',
    gap: 8,
  },
  // Clase personalizada: texto de acciones superiores.
  topActionText: { color: '#1B2A3A', fontSize: 16, fontWeight: '600', padding: 6 },
  // Clase personalizada: opacidad reducida para accion deshabilitada.
  disabled: { opacity: 0.5 },
  // Clase personalizada: color de accion destructiva.
  deleteText: { color: '#9F1D20' },
  // Clase personalizada: tarjeta del formulario.
  form: {
    margin: 16,
    padding: 20,
    backgroundColor: COLORS.creamGlass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  // Clase personalizada: etiqueta de campo.
  label: { fontSize: 14, fontWeight: '600', marginBottom: 5, marginTop: 10, color: COLORS.blueDark },
  // Clase personalizada: input base para editar campos.
  input: {
    borderWidth: 1,
    borderColor: COLORS.blueMid,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: COLORS.cream,
    color: COLORS.blueDark,
  },
  // Clase personalizada: variante multilinea para observacion.
  textArea: { height: 100, textAlignVertical: 'top' },
});
