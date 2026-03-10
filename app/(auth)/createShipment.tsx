// Archivo: app/(auth)/createShipment.tsx
// Descripcion: Pantalla para crear una nueva carga. Recolecta datos del formulario y llama la Edge Function create-shipment.

import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

export default function CreateShipment() {
  // Campos del formulario de creacion.
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

  // Controla estado visual de envio del formulario.
  const [saving, setSaving] = useState(false);

  // Navegacion de retorno segura.
  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  // Envia datos del formulario a la funcion server-side para crear la carga.
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
        'https://wmzafpkrmyhxbvymdjgu.supabase.co/functions/v1/create-shipment',
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
          <Field label="DO Number *" value={doNumber} onChangeText={setDoNumber} placeholder="DO12345" />
          <Field label="Via" value={shipmentType} onChangeText={setShipmentType} placeholder="Aereo / Maritimo" />
          <Field label="Origen *" value={origin} onChangeText={setOrigin} placeholder="Ciudad, Pais" />
          <Field label="Destino *" value={destination} onChangeText={setDestination} placeholder="Ciudad, Pais" />
          <Field label="ETD" value={etd} onChangeText={setEtd} placeholder="YYYY-MM-DD" />
          <Field label="ETA" value={eta} onChangeText={setEta} placeholder="YYYY-MM-DD" />
          <Field label="Incoterm" value={incoterm} onChangeText={setIncoterm} placeholder="FOB, CIF..." />
          <Field label="Estado Actual" value={currentStatus} onChangeText={setCurrentStatus} placeholder="En transito" />
          <Field label="Ubicacion Actual" value={currentLocation} onChangeText={setCurrentLocation} placeholder="Ciudad, Pais" />
          <Field label="Exportador" value={exporter} onChangeText={setExporter} placeholder="Empresa" />
          <Field label="Consignatario" value={consignee} onChangeText={setConsignee} placeholder="Empresa" />
          <Field label="Guia/Booking" value={airWaybill} onChangeText={setAirWaybill} placeholder="Numero" />
          <Field label="Vuelo/Motonave" value={flightVessel} onChangeText={setFlightVessel} placeholder="Nombre/ID" />
          <Field label="Contenedor" value={containerNumber} onChangeText={setContainerNumber} placeholder="CONT123" />
          <Field label="Naviera/Aerolinea" value={carrier} onChangeText={setCarrier} placeholder="Nombre" />
          <Field
            label="Correo del dueno de la carga"
            value={ownerEmail}
            onChangeText={setOwnerEmail}
            placeholder="usuario@email.com"
          />

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
};

// Componente reutilizable de etiqueta + input para reducir repeticion.
function Field({ label, value, onChangeText, placeholder }: FieldProps) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={COLORS.placeholder}
        value={value}
        onChangeText={onChangeText}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Clase personalizada: imagen de fondo a pantalla completa.
  background: { width: '100%', height: '100%' },
  // Clase personalizada: contenedor raiz de pantalla.
  container: { flex: 1, backgroundColor: 'transparent' },
  // Clase personalizada: scroll principal del formulario largo.
  scroll: { flex: 1 },
  // Clase personalizada: area interna separada del header.
  content: { zIndex: 1, paddingBottom: 20, paddingTop: 80 },
  // Clase personalizada: encabezado superior fijo.
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
  // Clase personalizada: contenedor del boton volver.
  topActionContainer: { position: 'absolute', right: 16, top: 25 },
  // Clase personalizada: texto del boton volver.
  topActionText: { color: '#1B2A3A', fontSize: 16, fontWeight: '600', padding: 6 },
  // Clase personalizada: tarjeta visual que agrupa todos los campos.
  form: {
    margin: 16,
    padding: 20,
    backgroundColor: COLORS.creamGlass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  // Clase personalizada: etiqueta de cada campo del formulario.
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 10, color: COLORS.blueDark },
  // Clase personalizada: input base para los campos de texto.
  input: {
    borderWidth: 1,
    borderColor: COLORS.blueMid,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: COLORS.cream,
    color: COLORS.blueDark,
  },
  // Clase personalizada: variacion multilinea para observaciones.
  textArea: { height: 100, textAlignVertical: 'top' },
  // Clase personalizada: boton principal de envio.
  button: {
    backgroundColor: COLORS.blue,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  // Clase personalizada: texto del boton principal.
  buttonText: { color: COLORS.cream, fontSize: 16, fontWeight: '700' },
});
