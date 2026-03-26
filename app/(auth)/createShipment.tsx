// Pantalla: createShipment
// Objetivo:
// - Capturar datos de una nueva carga en formulario.
// - Validar campos minimos en cliente.
// - Enviar payload a la Edge Function `create-shipment`.

import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
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
  { labelKey: 'shipmentForm.options.shipmentType.air', value: 'air' },
  { labelKey: 'shipmentForm.options.shipmentType.sea', value: 'maritime' },
  { labelKey: 'shipmentForm.options.shipmentType.land', value: 'land' },
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
  { labelKey: 'shipmentForm.options.cargoType.general', value: 'general' },
  { labelKey: 'shipmentForm.options.cargoType.dangerous', value: 'dangerous' },
  { labelKey: 'shipmentForm.options.cargoType.perishable', value: 'perishable' },
  { labelKey: 'shipmentForm.options.cargoType.refrigerated', value: 'refrigerated' },
  { labelKey: 'shipmentForm.options.cargoType.chemicals', value: 'chemicals' },
];

const BOOKING_STATUSES = [
  { labelKey: 'shipmentForm.options.bookingStatus.pending', value: 'pending' },
  { labelKey: 'shipmentForm.options.bookingStatus.confirmed', value: 'confirmed' },
  { labelKey: 'shipmentForm.options.bookingStatus.rejected', value: 'rejected' },
  { labelKey: 'shipmentForm.options.bookingStatus.waiting_carrier', value: 'waiting_carrier' },
];

const INSPECTION_STATUSES = [
  { labelKey: 'shipmentForm.options.inspectionStatus.none', value: 'none' },
  { labelKey: 'shipmentForm.options.inspectionStatus.documentary', value: 'documentary' },
  { labelKey: 'shipmentForm.options.inspectionStatus.physical', value: 'physical' },
  { labelKey: 'shipmentForm.options.inspectionStatus.released', value: 'released' },
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
  const { t } = useTranslation();

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

  const resolveOptions = (options: Array<{ labelKey: string; value: string }>) =>
    options.map((option) => ({ label: t(option.labelKey), value: option.value }));

  const shipmentTypeOptions = resolveOptions(SHIPMENT_TYPES);
  const cargoTypeOptions = resolveOptions(CARGO_TYPES);
  const bookingStatusOptions = resolveOptions(BOOKING_STATUSES);
  const inspectionStatusOptions = resolveOptions(INSPECTION_STATUSES);

  const resolveErrorMessage = async (response: Response, fallbackMessage: string) => {
    try {
      const text = await response.text();
      if (text) {
        try {
          const payload = JSON.parse(text);
          if (typeof payload?.error_key === 'string') {
            return t(payload.error_key, payload.error_params ?? {});
          }
          if (typeof payload?.reason_key === 'string') {
            return t(payload.reason_key, payload.reason_params ?? {});
          }
          if (typeof payload?.error === 'string') return payload.error;
          if (typeof payload?.reason === 'string') return payload.reason;
        } catch {
          return text;
        }
      }
    } catch {
      // ignore response parsing errors
    }
    return fallbackMessage;
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
      Alert.alert(t('common.error'), t('createShipment.doRequiredError'));
      return;
    }

    if (freeDays && Number.isNaN(Number(freeDays))) {
      Alert.alert(t('common.error'), t('createShipment.freeDaysError'));
      return;
    }

    setSaving(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        Alert.alert(t('common.error'), t('createShipment.noSession'));
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
        const errorMessage = await resolveErrorMessage(response, t('createShipment.createError'));
        throw new Error(errorMessage);
      }

      Alert.alert(t('common.success'), t('createShipment.createdOk'));
      // Reemplazar en lugar de push para que el usuario no pueda volver
      // al formulario ya enviado con el boton atras.
      router.replace('/');
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert(t('common.error'), error.message);
      } else {
        Alert.alert(t('common.error'), t('createShipment.unknownError'));
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
        <View style={styles.headerRow}>
          <LogoCorner inline size={120} />
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {t('createShipment.headerTitle')}
          </Text>
          <View style={styles.topActions}>
            <TouchableOpacity onPress={backFunction}>
              <Text style={styles.topActionText}>{t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.form}>
          {/* Campos marcados con * son obligatorios segun validacion en handleCreate */}
          <Field label={t('shipmentForm.labels.doNumber')} value={doNumber} onChangeText={setDoNumber} placeholder={t('shipmentForm.placeholders.doNumber')} onSubmitEditing={handleCreate} />
          <Field label={t('shipmentForm.labels.trackingNumber')} value={trackingNumber} onChangeText={setTrackingNumber} placeholder={t('shipmentForm.placeholders.trackingNumber')} onSubmitEditing={handleCreate} />
          <SelectField label={t('shipmentForm.labels.via')} value={shipmentType} onValueChange={setShipmentType} options={shipmentTypeOptions} placeholder={t('shipmentForm.placeholders.via')} />
          <Field label={t('shipmentForm.labels.origin')} value={origin} onChangeText={setOrigin} placeholder={t('shipmentForm.placeholders.origin')} onSubmitEditing={handleCreate} />
          <Field label={t('shipmentForm.labels.destination')} value={destination} onChangeText={setDestination} placeholder={t('shipmentForm.placeholders.destination')} onSubmitEditing={handleCreate} />
          <DateField label={t('shipmentForm.labels.etd')} value={etd} placeholder={t('shipmentForm.placeholders.date')} onPress={() => openDatePicker('etd')} onChangeText={setEtd} mode="date" />
          <DateField label={t('shipmentForm.labels.eta')} value={eta} placeholder={t('shipmentForm.placeholders.date')} onPress={() => openDatePicker('eta')} onChangeText={setEta} mode="date" />
          <DateField
            label={t('shipmentForm.labels.documentaryCutoff')}
            value={documentaryCutoff}
            placeholder={t('shipmentForm.placeholders.dateTime')}
            onPress={() => openDatePicker('documentaryCutoff')}
            onChangeText={setDocumentaryCutoff}
            mode="datetime"
          />
          <SelectField label={t('shipmentForm.labels.incoterm')} value={incoterm} onValueChange={setIncoterm} options={INCOTERMS} placeholder={t('shipmentForm.placeholders.incoterm')} />
          <SelectField label={t('shipmentForm.labels.cargoType')} value={cargoType} onValueChange={setCargoType} options={cargoTypeOptions} placeholder={t('shipmentForm.placeholders.cargoType')} />
          <Field
            label={t('shipmentForm.labels.freeDays')}
            value={freeDays}
            onChangeText={setFreeDays}
            placeholder={t('shipmentForm.placeholders.freeDays')}
            keyboardType="numeric"
            onSubmitEditing={handleCreate}
          />
          <SelectField label={t('shipmentForm.labels.bookingStatus')} value={bookingStatus} onValueChange={setBookingStatus} options={bookingStatusOptions} placeholder={t('shipmentForm.placeholders.bookingStatus')} />
          <SelectField
            label={t('shipmentForm.labels.inspectionStatus')}
            value={inspectionStatus}
            onValueChange={setInspectionStatus}
            options={inspectionStatusOptions}
            placeholder={t('shipmentForm.placeholders.inspectionStatus')}
          />
          <Field label={t('shipmentForm.labels.status')} value={currentStatus} onChangeText={setCurrentStatus} placeholder={t('shipmentForm.placeholders.status')} onSubmitEditing={handleCreate} />
          <Field label={t('shipmentForm.labels.location')} value={currentLocation} onChangeText={setCurrentLocation} placeholder={t('shipmentForm.placeholders.location')} onSubmitEditing={handleCreate} />
          <Field label={t('shipmentForm.labels.exporter')} value={exporter} onChangeText={setExporter} placeholder={t('shipmentForm.placeholders.exporter')} onSubmitEditing={handleCreate} />
          <Field label={t('shipmentForm.labels.consignee')} value={consignee} onChangeText={setConsignee} placeholder={t('shipmentForm.placeholders.consignee')} onSubmitEditing={handleCreate} />
          <Field label={t('shipmentForm.labels.awb')} value={airWaybill} onChangeText={setAirWaybill} placeholder={t('shipmentForm.placeholders.awb')} onSubmitEditing={handleCreate} />
          <Field label={t('shipmentForm.labels.flight')} value={flightVessel} onChangeText={setFlightVessel} placeholder={t('shipmentForm.placeholders.flight')} onSubmitEditing={handleCreate} />
          <Field label={t('shipmentForm.labels.container')} value={containerNumber} onChangeText={setContainerNumber} placeholder={t('shipmentForm.placeholders.container')} onSubmitEditing={handleCreate} />
          <Field label={t('shipmentForm.labels.carrier')} value={carrier} onChangeText={setCarrier} placeholder={t('shipmentForm.placeholders.carrier')} onSubmitEditing={handleCreate} />
          <Field
            label={t('shipmentForm.labels.ownerEmail')}
            value={ownerEmail}
            onChangeText={setOwnerEmail}
            placeholder={t('shipmentForm.placeholders.ownerEmail')}
            keyboardType="email-address"
            autoCapitalize="none"
            onSubmitEditing={handleCreate}
          />

          {/* Observacion usa TextInput directo (no Field) por necesitar multiline */}
          <Text style={styles.label}>{t('shipmentForm.labels.observation')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t('shipmentForm.placeholders.observation')}
            placeholderTextColor={COLORS.placeholder}
            value={observation}
            onChangeText={setObservation}
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={saving}>
            <Text style={styles.buttonText}>{saving ? t('createShipment.creating') : t('createShipment.submit')}</Text>
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
                <Text style={styles.dateDoneText}>{t('common.done')}</Text>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B2A3A',
    textAlign: 'center',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 60,
  },
  topActionText: { color: '#1B2A3A', fontSize: 16, fontWeight: '600', padding: 6, includeFontPadding: false },
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
