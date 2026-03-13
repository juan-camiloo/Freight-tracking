// Pantalla: createShipment
// Objetivo:
// - Capturar datos de una nueva carga en formulario.
// - Validar campos minimos en cliente.
// - Enviar payload a la Edge Function `create-shipment`.

import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LogoCorner from '../../components/LogoCorner';
import { createShipmentFunctionUrl, supabase, supabaseAnonKey } from '../../lib/supabase';

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

export default function CreateShipment() {
  // Un estado por campo para mantener control granular sobre cada input
  // y facilitar el armado del payload sin transformaciones adicionales.
  const [doNumber, setDoNumber] = useState('');
  const [shipmentType, setShipmentType] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [etd, setEtd] = useState('');
  const [eta, setEta] = useState('');
  const [incoterm, setIncoterm] = useState('');
  const [currentStatus, setCurrentStatus] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [exporter, setExporter] = useState('');
  const [consignee, setConsignee] = useState('');
  const [airWaybill, setAirWaybill] = useState('');
  const [flightVessel, setFlightVessel] = useState('');
  const [containerNumber, setContainerNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [observation, setObservation] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  // Bloquea el boton de envio mientras la Edge Function procesa la request.
  const [saving, setSaving] = useState(false);

  // Navegacion de retorno segura: usa back() si hay historial, fallback a raiz si no.
  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  // Valida campos obligatorios en cliente antes de consumir la Edge Function.
  const handleCreate = async () => {
    if (!doNumber || !origin || !destination) {
      Alert.alert('Error', 'DO, origen y destino son obligatorios');
      return;
    }

    setSaving(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        Alert.alert('Error', 'No hay sesion activa, vuelve a iniciar sesion');
        return;
      }

      const response = await fetch(
        createShipmentFunctionUrl,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            do_number: doNumber,
            shipment_type: shipmentType || null,
            origin,
            destination,
            etd: etd || null,
            eta: eta || null,
            incoterm: incoterm || null,
            current_status: currentStatus || null,
            current_location: currentLocation || null,
            exporter: exporter || null,
            consignee: consignee || null,
            air_waybill: airWaybill || null,
            flight_vessel: flightVessel || null,
            container_number: containerNumber || null,
            carrier: carrier || null,
            // Si no se proporciona owner_email, la Edge Function asigna la carga al usuario autenticado.
            owner_email: ownerEmail || null,
            observation: observation || null,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'No se pudo crear la carga');
      }

      Alert.alert('Exito', 'Carga creada');
      // Reemplazar en lugar de push para que el usuario no pueda volver
      // al formulario ya enviado con el boton atras.
      router.replace('/');
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Error', 'Algo salio mal... Intentalo de nuevo');
      }
    } finally {
      setSaving(false);
    }
  };

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
        <Text style={styles.headerTitle}>Crear Carga</Text>
        <TouchableOpacity onPress={backFunction} style={styles.topActionContainer}>
          <Text style={styles.topActionText}>Volver</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.form}>
          {/* Campos marcados con * son obligatorios segun validacion en handleCreate */}
          <Field label="DO Number *" value={doNumber} onChangeText={setDoNumber} placeholder="DO12345" onSubmitEditing={handleCreate} />
          <Field label="Via" value={shipmentType} onChangeText={setShipmentType} placeholder="Aereo / Maritimo" onSubmitEditing={handleCreate} />
          <Field label="Origen *" value={origin} onChangeText={setOrigin} placeholder="Ciudad, Pais" onSubmitEditing={handleCreate} />
          <Field label="Destino *" value={destination} onChangeText={setDestination} placeholder="Ciudad, Pais" onSubmitEditing={handleCreate} />
          <Field label="ETD" value={etd} onChangeText={setEtd} placeholder="YYYY-MM-DD" onSubmitEditing={handleCreate} />
          <Field label="ETA" value={eta} onChangeText={setEta} placeholder="YYYY-MM-DD" onSubmitEditing={handleCreate} />
          <Field label="Incoterm" value={incoterm} onChangeText={setIncoterm} placeholder="FOB, CIF..." onSubmitEditing={handleCreate} />
          <Field label="Estado Actual" value={currentStatus} onChangeText={setCurrentStatus} placeholder="En transito" onSubmitEditing={handleCreate} />
          <Field label="Ubicacion Actual" value={currentLocation} onChangeText={setCurrentLocation} placeholder="Ciudad, Pais" onSubmitEditing={handleCreate} />
          <Field label="Exportador" value={exporter} onChangeText={setExporter} placeholder="Empresa" onSubmitEditing={handleCreate} />
          <Field label="Consignatario" value={consignee} onChangeText={setConsignee} placeholder="Empresa" onSubmitEditing={handleCreate} />
          <Field label="Guia/Booking" value={airWaybill} onChangeText={setAirWaybill} placeholder="Numero" onSubmitEditing={handleCreate} />
          <Field label="Vuelo/Motonave" value={flightVessel} onChangeText={setFlightVessel} placeholder="Nombre/ID" onSubmitEditing={handleCreate} />
          <Field label="Contenedor" value={containerNumber} onChangeText={setContainerNumber} placeholder="CONT123" onSubmitEditing={handleCreate} />
          <Field label="Naviera/Aerolinea" value={carrier} onChangeText={setCarrier} placeholder="Nombre" onSubmitEditing={handleCreate} />
          <Field
            label="Correo del dueno de la carga"
            value={ownerEmail}
            onChangeText={setOwnerEmail}
            placeholder="usuario@email.com"
            onSubmitEditing={handleCreate}
          />

          {/* Observacion usa TextInput directo (no Field) por necesitar multiline */}
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

          <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={saving}>
            <Text style={styles.buttonText}>{saving ? 'Creando...' : 'Crear Carga'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmitEditing?: () => void;
};

// Componente reutilizable de etiqueta + input para reducir repeticion en el formulario.
// No se extrae a un archivo separado porque solo se usa en esta pantalla.
function Field({ label, value, onChangeText, placeholder, onSubmitEditing }: FieldProps) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={COLORS.placeholder}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="done"
          onSubmitEditing={onSubmitEditing}
      />
    </>
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
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 10, color: COLORS.blueDark },
  input: {
    borderWidth: 1,
    borderColor: COLORS.blueMid,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: COLORS.cream,
    color: COLORS.blueDark,
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  button: {
    backgroundColor: COLORS.blue,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: COLORS.cream, fontSize: 16, fontWeight: '700' },
}); 