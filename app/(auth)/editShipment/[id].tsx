// Archivo: app/(auth)/editShipment/[id].tsx
// Descripcion: Pantalla para editar una carga existente y registrar una observacion en el historial si aplica.

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type CSSProperties } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

export default function EditShipment() {
  // ID de la carga a editar, tomado de la ruta dinamica.
  const { id } = useLocalSearchParams();

  // Estados visuales de carga y guardado.
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Campos editables del formulario.
  const [doNumber, setDoNumber] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shipmentType, setShipmentType] = useState('');
  const [currentStatus, setCurrentStatus] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [exporter, setExporter] = useState('');
  const [consignee, setConsignee] = useState('');
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
  const [airWaybill, setAirWaybill] = useState('');
  const [flightVessel, setFlightVessel] = useState('');
  const [containerNumber, setContainerNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [observation, setObservation] = useState('');
  const [clientId, setClientId] = useState('');

  const [activeDateField, setActiveDateField] = useState<DateField | null>(null);
  const [androidTimeField, setAndroidTimeField] = useState<DateField | null>(null);
  const [dateDraft, setDateDraft] = useState(new Date());

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
      setTrackingNumber(data.tracking_number || '');
      setShipmentType(data.shipment_type || '');
      setCurrentStatus(data.current_status || '');
      setCurrentLocation(data.current_location || '');
      setExporter(data.exporter || '');
      setConsignee(data.consignee || '');
      setOrigin(data.origin || '');
      setDestination(data.destination || '');
      setEtd(data.etd || '');
      setEta(data.eta || '');
      setDocumentaryCutoff(data.documentary_cutoff || '');
      setIncoterm(data.incoterm || '');
      setCargoType(data.cargo_type || '');
      setFreeDays(data.free_days !== null && data.free_days !== undefined ? String(data.free_days) : '');
      setBookingStatus(data.booking_status || '');
      setInspectionStatus(data.inspection_status || '');
      setRecordStatus(data.status || '');
      setAirWaybill(data.air_waybill || '');
      setFlightVessel(data.flight_vessel || '');
      setContainerNumber(data.container_number || '');
      setCarrier(data.carrier || '');
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

    if (freeDays && Number.isNaN(Number(freeDays))) {
      Alert.alert('Error', 'Free days debe ser un numero');
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('shipments')
        .update({
          do_number: doNumber,
          tracking_number: trackingNumber || null,
          shipment_type: shipmentType || null,
          current_status: currentStatus,
          current_location: currentLocation,
          exporter,
          consignee,
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
          air_waybill: airWaybill || null,
          flight_vessel: flightVessel || null,
          container_number: containerNumber || null,
          carrier: carrier || null,
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
            <Text style={[styles.topActionText, styles.deleteText, saving && styles.disabled]}>Eliminar carga</Text>
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
          <InputField label="Tracking Number" value={trackingNumber} onChangeText={setTrackingNumber} onSubmitEditing={handleSave} />
          <SelectField label="Via" value={shipmentType} onValueChange={setShipmentType} options={SHIPMENT_TYPES} placeholder="Selecciona via" />
          <InputField label="Estado Actual" value={currentStatus} onChangeText={setCurrentStatus} onSubmitEditing={handleSave} />
          <InputField label="Ubicacion Actual" value={currentLocation} onChangeText={setCurrentLocation} onSubmitEditing={handleSave} />
          <InputField label="Exportador" value={exporter} onChangeText={setExporter} onSubmitEditing={handleSave} />
          <InputField label="Consignatario" value={consignee} onChangeText={setConsignee} onSubmitEditing={handleSave} />
          <InputField label="Origen *" value={origin} onChangeText={setOrigin} onSubmitEditing={handleSave} />
          <InputField label="Destino *" value={destination} onChangeText={setDestination} onSubmitEditing={handleSave} />
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
          <InputField
            label="Free Days"
            value={freeDays}
            onChangeText={setFreeDays}
            keyboardType="numeric"
            onSubmitEditing={handleSave}
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
          <InputField label="Guia/Booking" value={airWaybill} onChangeText={setAirWaybill} onSubmitEditing={handleSave} />
          <InputField label="Vuelo/Motonave" value={flightVessel} onChangeText={setFlightVessel} onSubmitEditing={handleSave} />
          <InputField label="Contenedor" value={containerNumber} onChangeText={setContainerNumber} onSubmitEditing={handleSave} />
          <InputField label="Naviera/Aerolinea" value={carrier} onChangeText={setCarrier} onSubmitEditing={handleSave} />

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

        {Platform.OS !== 'web' && activeDateField ? (
          <View style={Platform.OS === 'ios' ? styles.datePickerCard : undefined}>
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

type InputFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing?: () => void;
  keyboardType?: 'default' | 'numeric' | 'email-address';
};

// Componente reutilizable para evitar repetir etiqueta + input.
function InputField({ label, value, onChangeText, onSubmitEditing, keyboardType }: InputFieldProps) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
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
      <View style={[styles.pickerWrapper, isWeb && styles.pickerWrapperWeb]}>
        <Picker
          selectedValue={value}
          onValueChange={(itemValue) => onValueChange(String(itemValue))}
          style={[styles.picker, isWeb && styles.pickerWeb, { color: displayColor }]}
          itemStyle={isWeb ? styles.pickerItemWeb : undefined}
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
    const webInputStyle: CSSProperties = {
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
  // Clase personalizada: variante multilinea para observacion.
  textArea: { height: 100, textAlignVertical: 'top' },
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
