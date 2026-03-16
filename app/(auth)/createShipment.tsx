// Pantalla: createShipment
// Objetivo:
// - Capturar datos de una nueva carga en formulario.
// - Validar campos minimos en cliente.
// - Enviar payload a la Edge Function `create-shipment`.

import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import { useState, type CSSProperties } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

const SHIPMENT_TYPES = [
  { label: 'Aereo', value: 'Aereo' },
  { label: 'Maritimo', value: 'Maritimo' },
  { label: 'Terrestre', value: 'Terrestre' },
];

const INCOTERMS = [
  { label: 'EXW', value: 'EXW' },
  { label: 'FCA', value: 'FCA' },
  { label: 'FAS', value: 'FAS' },
  { label: 'FOB', value: 'FOB' },
  { label: 'CFR', value: 'CFR' },
  { label: 'CIF', value: 'CIF' },
  { label: 'CPT', value: 'CPT' },
  { label: 'CIP', value: 'CIP' },
  { label: 'DAP', value: 'DAP' },
  { label: 'DPU', value: 'DPU' },
  { label: 'DDP', value: 'DDP' },
];

const CARGO_TYPES = [
  { label: 'General', value: 'general' },
  { label: 'Dangerous', value: 'dangerous' },
  { label: 'Perishable', value: 'perishable' },
  { label: 'Refrigerated', value: 'refrigerated' },
  { label: 'Project', value: 'project' },
];

const BOOKING_STATUSES = [
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Cancelled', value: 'cancelled' },
];

const INSPECTION_STATUSES = [
  { label: 'None', value: 'none' },
  { label: 'Documentary', value: 'documentary' },
  { label: 'Physical', value: 'physical' },
  { label: 'Customs', value: 'customs' },
];

const RECORD_STATUSES = [
  { label: 'Activo', value: 'active' },
  { label: 'Inactivo', value: 'inactive' },
];

type DateField = 'etd' | 'eta' | 'documentaryCutoff';

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateTime = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(date)} ${hours}:${minutes}`;
};

const parseDateValue = (value: string) => {
  if (!value) return null;
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const mergeDateAndTime = (datePart: Date, timePart: Date) => {
  const merged = new Date(datePart);
  merged.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return merged;
};

export default function CreateShipment() {
  // Un estado por campo para mantener control granular sobre cada input
  // y facilitar el armado del payload sin transformaciones adicionales.
  const [doNumber, setDoNumber] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shipmentType, setShipmentType] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [etd, setEtd] = useState('');
  const [eta, setEta] = useState('');
  const [documentaryCutoff, setDocumentaryCutoff] = useState('');
  const [incoterm, setIncoterm] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [freeDays, setFreeDays] = useState('');
  const [bookingStatus, setBookingStatus] = useState('');
  const [inspectionStatus, setInspectionStatus] = useState('');
  const [recordStatus, setRecordStatus] = useState('');
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

  const [activeDateField, setActiveDateField] = useState<DateField | null>(null);
  const [androidTimeField, setAndroidTimeField] = useState<DateField | null>(null);
  const [dateDraft, setDateDraft] = useState(new Date());

  // Bloquea el boton de envio mientras la Edge Function procesa la request.
  const [saving, setSaving] = useState(false);

  const getDateValue = (field: DateField) => {
    switch (field) {
      case 'etd':
        return etd;
      case 'eta':
        return eta;
      case 'documentaryCutoff':
        return documentaryCutoff;
      default:
        return '';
    }
  };

  const setDateValue = (field: DateField, value: string) => {
    switch (field) {
      case 'etd':
        setEtd(value);
        break;
      case 'eta':
        setEta(value);
        break;
      case 'documentaryCutoff':
        setDocumentaryCutoff(value);
        break;
      default:
        break;
    }
  };

  const openDatePicker = (field: DateField) => {
    const currentValue = getDateValue(field);
    const parsed = parseDateValue(currentValue);
    setDateDraft(parsed ?? new Date());
    setActiveDateField(field);
  };

  const applyDateSelection = (field: DateField, date: Date) => {
    const formatted = field === 'documentaryCutoff' ? formatDateTime(date) : formatDate(date);
    setDateValue(field, formatted);
  };

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

    if (freeDays && Number.isNaN(Number(freeDays))) {
      Alert.alert('Error', 'Free days debe ser un numero');
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
            tracking_number: trackingNumber || null,
            shipment_type: shipmentType || null,
            origin,
            destination,
            etd: etd || null,
            eta: eta || null,
            documentary_cutoff: documentaryCutoff || null,
            incoterm: incoterm || null,
            cargo_type: cargoType || null,
            free_days: freeDays ? Number(freeDays) : null,
            booking_status: bookingStatus || null,
            inspection_status: inspectionStatus || null,
            status: recordStatus || null,
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
          <Field label="Tracking Number" value={trackingNumber} onChangeText={setTrackingNumber} placeholder="TRK12345" onSubmitEditing={handleCreate} />
          <SelectField label="Via" value={shipmentType} onValueChange={setShipmentType} options={SHIPMENT_TYPES} placeholder="Selecciona via" />
          <Field label="Origen *" value={origin} onChangeText={setOrigin} placeholder="Ciudad, Pais" onSubmitEditing={handleCreate} />
          <Field label="Destino *" value={destination} onChangeText={setDestination} placeholder="Ciudad, Pais" onSubmitEditing={handleCreate} />
          <DateField label="ETD" value={etd} placeholder="Selecciona fecha" onPress={() => openDatePicker('etd')} onChangeText={setEtd} mode="date" />
          <DateField label="ETA" value={eta} placeholder="Selecciona fecha" onPress={() => openDatePicker('eta')} onChangeText={setEta} mode="date" />
          <DateField
            label="Documentary Cutoff"
            value={documentaryCutoff}
            placeholder="Selecciona fecha y hora"
            onPress={() => openDatePicker('documentaryCutoff')}
            onChangeText={setDocumentaryCutoff}
            mode="datetime"
          />
          <SelectField label="Incoterm" value={incoterm} onValueChange={setIncoterm} options={INCOTERMS} placeholder="Selecciona incoterm" />
          <SelectField label="Cargo Type" value={cargoType} onValueChange={setCargoType} options={CARGO_TYPES} placeholder="Selecciona tipo de carga" />
          <Field
            label="Free Days"
            value={freeDays}
            onChangeText={setFreeDays}
            placeholder="0"
            keyboardType="numeric"
            onSubmitEditing={handleCreate}
          />
          <SelectField label="Booking Status" value={bookingStatus} onValueChange={setBookingStatus} options={BOOKING_STATUSES} placeholder="Selecciona estado" />
          <SelectField
            label="Inspection Status"
            value={inspectionStatus}
            onValueChange={setInspectionStatus}
            options={INSPECTION_STATUSES}
            placeholder="Selecciona estado"
          />
          <SelectField label="Estado del Registro" value={recordStatus} onValueChange={setRecordStatus} options={RECORD_STATUSES} placeholder="Selecciona estado" />
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
            keyboardType="email-address"
            autoCapitalize="none"
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

        {Platform.OS !== 'web' && activeDateField ? (
          <View style={Platform.OS === 'ios' ? styles.datePickerCard : {}}>
            <DateTimePicker
              value={dateDraft}
              mode={activeDateField === 'documentaryCutoff' && Platform.OS === 'ios' ? 'datetime' : 'date'}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                if (!activeDateField) return;
                if (event.type === 'dismissed') {
                  setActiveDateField(null);
                  return;
                }

                const nextDate = selectedDate ?? dateDraft;

                if (Platform.OS === 'android' && activeDateField === 'documentaryCutoff') {
                  setDateDraft(nextDate);
                  setActiveDateField(null);
                  setAndroidTimeField(activeDateField);
                  return;
                }

                applyDateSelection(activeDateField, nextDate);
                if (Platform.OS !== 'ios') {
                  setActiveDateField(null);
                }
              }}
            />
            {Platform.OS === 'ios' ? (
              <TouchableOpacity style={styles.dateDoneButton} onPress={() => setActiveDateField(null)}>
                <Text style={styles.dateDoneText}>Listo</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {Platform.OS === 'android' && androidTimeField ? (
          <DateTimePicker
            value={dateDraft}
            mode="time"
            display="default"
            onChange={(event, selectedDate) => {
              setAndroidTimeField(null);
              if (event.type === 'dismissed') return;
              if (!androidTimeField) return;
              const nextDate = selectedDate ?? dateDraft;
              const merged = mergeDateAndTime(dateDraft, nextDate);
              applyDateSelection(androidTimeField, merged);
            }}
          />
        ) : null}
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
  keyboardType?: 'default' | 'numeric' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

// Componente reutilizable de etiqueta + input para reducir repeticion en el formulario.
// No se extrae a un archivo separado porque solo se usa en esta pantalla.
function Field({ label, value, onChangeText, placeholder, onSubmitEditing, keyboardType, autoCapitalize }: FieldProps) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={COLORS.placeholder}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        returnKeyType="done"
        onSubmitEditing={onSubmitEditing}
      />
    </>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder: string;
};

function SelectField({ label, value, onValueChange, options, placeholder }: SelectFieldProps) {
  const isWeb = Platform.OS === 'web';
  const displayColor = value ? COLORS.blueDark : COLORS.placeholder;
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.pickerWrapper, isWeb ? styles.pickerWrapperWeb : {}]}>
        <Picker
          selectedValue={value}
          onValueChange={(itemValue) => onValueChange(String(itemValue))}
          style={[styles.picker, isWeb ? styles.pickerWeb : {}, { color: displayColor }]}
          itemStyle={isWeb ? styles.pickerItemWeb : {}}
          dropdownIconColor={COLORS.blueDark}
        >
          <Picker.Item label={placeholder} value="" color={COLORS.placeholder} />
          {options.map((option) => (
            <Picker.Item key={option.value} label={option.label} value={option.value} />
          ))}
        </Picker>
      </View>
    </>
  );
}

type DateFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
  onChangeText: (text: string) => void;
  mode: 'date' | 'datetime';
};

const webDateInputStyle: CSSProperties = {
  outlineStyle: 'none',
  boxSizing: 'border-box',
  WebkitAppearance: 'none',
  appearance: 'none',
  MozAppearance: 'textfield',
};
const toWebDateValue = (value: string, mode: 'date' | 'datetime') => {
  if (!value) return '';
  if (mode === 'date') return value;
  return value.includes(' ') ? value.replace(' ', 'T') : value;
};

const fromWebDateValue = (value: string, mode: 'date' | 'datetime') => {
  if (!value) return '';
  if (mode === 'date') return value;
  return value.includes('T') ? value.replace('T', ' ') : value;
};

function DateField({ label, value, placeholder, onPress, onChangeText, mode }: DateFieldProps) {
  if (Platform.OS === 'web') {
    const webInputStyle : CSSProperties = {
      ...(StyleSheet.flatten(styles.input) as CSSProperties),
    };
    return (
      <>
        <Text style={styles.label}>{label}</Text>
        <input
          style={{
            ...webInputStyle,
            ...webDateInputStyle,
            color: value ? COLORS.blueDark : COLORS.placeholder,
          }}
          placeholder={placeholder}
          value={toWebDateValue(value, mode)}
          onChange={(event) => {
            const nextValue = (event.target as HTMLInputElement).value;
            onChangeText(fromWebDateValue(nextValue, mode));
          }}
          type={mode === 'date' ? 'date' : 'datetime-local'}
        />
      </>
    );
  }

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={[styles.input, styles.inputPressable]} onPress={onPress} activeOpacity={0.8}>
        <Text style={[styles.dateText, !value && styles.placeholderText]}>{value || placeholder}</Text>
      </TouchableOpacity>
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
    minHeight: 48,
  },
  inputPressable: {
    justifyContent: 'center',
  },
  dateText: { fontSize: 16, color: COLORS.blueDark },
  placeholderText: { color: COLORS.placeholder },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: COLORS.blueMid,
    borderRadius: 8,
    backgroundColor: COLORS.cream,
    overflow: 'hidden',
    minHeight: 48,
    justifyContent: 'center',
  },
  pickerWrapperWeb: {
    paddingHorizontal: 12,
  },
  picker: {
    width: '100%',
    color: COLORS.blueDark,
    height: 48,
    fontSize: 16,
    backgroundColor: COLORS.cream,
    borderWidth: 0,
  },
  pickerWeb: {
    paddingHorizontal: 0,
    height: 46,
    boxSizing: 'border-box',
  },
  pickerItemWeb: {
    fontSize: 16,
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
  datePickerCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: COLORS.creamGlass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateDoneButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.blue,
    borderRadius: 8,
  },
  dateDoneText: { color: COLORS.cream, fontWeight: '700' },

});
