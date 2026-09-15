// Pantalla: createShipment
// Objetivo:
// - Capturar datos de una nueva carga en formulario.
// - Validar campos minimos en cliente.
// - Enviar payload a la Edge Function `create-shipment`.

import i18n, { setAppLanguage } from '@/i18n';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AUTH_MOBILE_DOCK_PADDING } from '../../components/auth/AuthNavigation';
import Header from '../../components/Header';
import { COLORS } from '../../components/ui/COLORS';
import { useNativeNotification } from '../../components/ui/NativeNotification';
import { useResponsive } from '../../hooks/useResponsive';
import {
  BOOKING_STATUSES,
  CARGO_TYPES,
  INCOTERMS,
  INSPECTION_STATUSES,
  SHIPMENT_TYPE_OPTIONS,
  getShipmentOperationLabelKey,
  getShipmentStatusOptions,
  inferShipmentOperationType,
} from '../../lib/shipmentType';
import { createShipmentFunctionUrl, supabase, supabaseAnonKey } from '../../lib/URLs';
import {
  formatDateInputValue,
  formatDateTimeInputValue,
  mergeDateAndTime,
  parseDateInputValue,
} from '../../utils/dateFormatting';
import { resolveErrorMessage as resolveErrorMessageUtil } from '../../utils/errorHandling';

type ShipmentDateField = 'etd' | 'eta' | 'atd' | 'ata' | 'documentaryCutoff';

const DATE_TIME_FIELDS: ShipmentDateField[] = ['atd', 'ata', 'documentaryCutoff'];

const isDateTimeField = (field: ShipmentDateField) => DATE_TIME_FIELDS.includes(field);

export default function CreateShipment() {
  const { t } = useTranslation();
  const notification = useNativeNotification();
  const { ownerEmail: ownerEmailParam } = useLocalSearchParams();
  const { height, isDesktop } = useResponsive();
  const initialOwnerEmail =
    typeof ownerEmailParam === 'string' ? ownerEmailParam : Array.isArray(ownerEmailParam) ? ownerEmailParam[0] : '';

  const [doNumber, setDoNumber] = useState('');
  const [shipmentType, setShipmentType] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [etd, setEtd] = useState('');
  const [eta, setEta] = useState('');
  const [atd, setAtd] = useState('');
  const [ata, setAta] = useState('');
  const [documentaryCutoff, setDocumentaryCutoff] = useState('');
  const [incoterm, setIncoterm] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [freeDays, setFreeDays] = useState('');
  const [bookingStatus, setBookingStatus] = useState('');
  const [inspectionStatus, setInspectionStatus] = useState('');
  const [currentStatus, setCurrentStatus] = useState('expo_start_operation');
  const [currentLocation, setCurrentLocation] = useState('');
  const [exporter, setExporter] = useState('');
  const [consignee, setConsignee] = useState('');
  const [airWaybill, setAirWaybill] = useState('');
  const [flightVessel, setFlightVessel] = useState('');
  const [containerNumber, setContainerNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [observation, setObservation] = useState('');
  const [ownerEmail, setOwnerEmail] = useState(initialOwnerEmail);
  const [companyId, setCompanyId] = useState('');
  const [companyOptions, setCompanyOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    const op = inferShipmentOperationType(doNumber);
    if (op === 'impo') {
      if (!currentStatus || currentStatus === 'expo_start_operation') {
        setCurrentStatus('impo_start_operation');
      }
    } else if (op === 'expo') {
      if (!currentStatus || currentStatus === 'impo_start_operation') {
        setCurrentStatus('expo_start_operation');
      }
    }
  }, [doNumber]);

  useEffect(() => {
    async function loadCompanies() {
      try {
        const { data } = await supabase.from('companies').select('id, name').order('name', { ascending: true });
        if (data) {
          setCompanyOptions(data.map((c) => ({ label: c.name, value: c.id })));
        }
      } catch {
        // no-op
      }
    }
    void loadCompanies();
  }, []);

  const [activeDateField, setActiveDateField] = useState<ShipmentDateField | null>(null);
  const [androidTimeField, setAndroidTimeField] = useState<ShipmentDateField | null>(null);
  const [dateDraft, setDateDraft] = useState(new Date());

  // Bloquea el boton de envio mientras la Edge Function procesa la request.
  const [saving, setSaving] = useState(false);

  const resolveOptions = (options: { labelKey: string; value: string }[]) =>
    options.map((option) => ({ label: t(option.labelKey), value: option.value }));

  const shipmentTypeOptions = resolveOptions(SHIPMENT_TYPE_OPTIONS);
  const cargoTypeOptions = resolveOptions(CARGO_TYPES);
  const bookingStatusOptions = resolveOptions(BOOKING_STATUSES);
  const inspectionStatusOptions = resolveOptions(INSPECTION_STATUSES);
  const statusOptions = resolveOptions(getShipmentStatusOptions(doNumber));
  const statusOptionsWithCurrentValue = currentStatus && !statusOptions.some((option) => option.value === currentStatus)
    ? [...statusOptions, { label: currentStatus, value: currentStatus }]
    : statusOptions;
  const operationTypeLabelKey = getShipmentOperationLabelKey(doNumber);
  const operationTypeHint = operationTypeLabelKey ? `${t('shipmentForm.labels.operationType')}: ${t(operationTypeLabelKey)}` : undefined;

  const carrierLabel =
    shipmentType === 'maritime'
      ? t('shipmentForm.labels.carrierMaritime')
      : shipmentType === 'air'
        ? t('shipmentForm.labels.carrierAir')
        : shipmentType === 'land'
          ? t('shipmentForm.labels.carrierLand')
          : t('shipmentForm.labels.carrier');

  const carrierPlaceholder =
    shipmentType === 'maritime'
      ? t('shipmentForm.placeholders.carrierMaritime')
      : shipmentType === 'air'
        ? t('shipmentForm.placeholders.carrierAir')
        : shipmentType === 'land'
          ? t('shipmentForm.placeholders.carrierLand')
          : t('shipmentForm.placeholders.carrier');

  const resolveErrorMessage = resolveErrorMessageUtil;

  const getDateValue = (field: ShipmentDateField) => {
    switch (field) {
      case 'etd': return etd;
      case 'eta': return eta;
      case 'atd': return atd;
      case 'ata': return ata;
      case 'documentaryCutoff': return documentaryCutoff;
      default: return '';
    }
  };

  const setDateValue = (field: ShipmentDateField, value: string) => {
    switch (field) {
      case 'etd': setEtd(value); break;
      case 'eta': setEta(value); break;
      case 'atd': setAtd(value); break;
      case 'ata': setAta(value); break;
      case 'documentaryCutoff': setDocumentaryCutoff(value); break;
    }
  };

  const toggleLanguage = async () => {
    const next = i18n.language === 'es' ? 'en' : 'es';
    await setAppLanguage(next as 'es' | 'en');
  };

  const openDatePicker = (field: ShipmentDateField) => {
    const currentValue = getDateValue(field);
    const parsed = parseDateInputValue(currentValue);
    setDateDraft(parsed ?? new Date());
    setActiveDateField(field);
  };

  const applyDateSelection = (field: ShipmentDateField, date: Date) => {
    const formatted = isDateTimeField(field) ? formatDateTimeInputValue(date) : formatDateInputValue(date);
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
      notification.error(t('createShipment.doRequiredError'));
      return;
    }

    if (freeDays && Number.isNaN(Number(freeDays))) {
      notification.error(t('createShipment.freeDaysError'));
      return;
    }

    if (shipmentType === 'air' && airWaybill && !/^\d{3}-\d{7,8}$/.test(airWaybill.trim())) {
      notification.error(t('createShipment.awbFormatError'));
      return;
    }

    if (shipmentType === 'maritime' && containerNumber && !/^[A-Z]{4}\d{7}$/.test(containerNumber.trim().toUpperCase())) {
      notification.error(t('createShipment.containerFormatError'));
      return;
    }

    setSaving(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        notification.error(t('createShipment.noSession'));
        return;
      }
      const userId = sessionData.session?.user?.id;

      const cleanString = (val: string | null | undefined): string | null => {
        if (typeof val !== 'string') return null;
        const trimmed = val.trim();
        return trimmed.length > 0 ? trimmed : null;
      };

      const response = await fetch(createShipmentFunctionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          do_number: cleanString(doNumber) || doNumber,
          shipment_type: cleanString(shipmentType),
          origin: cleanString(origin),
          destination: cleanString(destination),
          etd: etd || null,
          eta: eta || null,
          atd: atd || null,
          ata: ata || null,
          documentary_cutoff: documentaryCutoff || null,
          incoterm: cleanString(incoterm),
          cargo_type: cleanString(cargoType),
          free_days: freeDays ? Number(freeDays) : null,
          booking_status: cleanString(bookingStatus),
          inspection_status: cleanString(inspectionStatus),
          current_status: cleanString(currentStatus),
          current_location: cleanString(currentLocation),
          exporter: cleanString(exporter),
          consignee: cleanString(consignee),
          air_waybill: cleanString(airWaybill),
          flight_vessel: cleanString(flightVessel),
          container_number: cleanString(containerNumber),
          carrier: cleanString(carrier),
          owner_email: cleanString(ownerEmail),
          observation: cleanString(observation),
          created_by: userId,
        }),
      });

      if (!response.ok) {
        const errorMessage = await resolveErrorMessage(response, t('createShipment.createError'));
        throw new Error(errorMessage);
      }

      const createdJson = await response.json().catch(() => null);
      if (companyId && createdJson?.id) {
        try {
          await supabase.from('company_shipment').upsert(
            { company_id: companyId, shipment_id: createdJson.id },
            { onConflict: 'company_id,shipment_id' },
          );
        } catch {
          // no-op
        }
      }

      notification.success(t('createShipment.createdOk'));
      router.replace('/');
    } catch (error) {
      if (error instanceof Error) {
        notification.error(error.message);
      } else {
        notification.error(t('createShipment.unknownError'));
      }
    } finally {
      setSaving(false);
    }
  };

  const rowStyle = [styles.row, !isDesktop && styles.rowMobile];
  const fieldStyle = [styles.fieldContainer, !isDesktop && styles.fieldContainerMobile];

  return (
    <View style={styles.container}>
      <View style={styles.backgroundBase} />
      <View style={styles.backgroundGlowOne} />
      <View style={styles.backgroundGlowTwo} />
      <Header
        isDesktop={isDesktop}
        title={t('dashboard.createShipment')}
        showSearch={false}
        onGoBack={backFunction}
        onToggleLanguage={toggleLanguage}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          isDesktop ? styles.contentDesktop : styles.contentMobile,
          !isDesktop && styles.contentWithDock,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.form, styles.shadowCard, !isDesktop && styles.formMobile]}>
          <FormSection title={t('shipmentForm.sections.shipmentInfo')}>
            <View style={rowStyle}>
              <View style={fieldStyle}>
                <Field label={t('shipmentForm.labels.doNumber')} value={doNumber} onChangeText={setDoNumber} placeholder={t('shipmentForm.placeholders.doNumber')} onSubmitEditing={handleCreate} />
              </View>
              <View style={fieldStyle}>
                <SelectField label={t('shipmentForm.labels.via')} value={shipmentType} onValueChange={setShipmentType} options={shipmentTypeOptions} placeholder={t('shipmentForm.placeholders.via')} />
              </View>
            </View>

            <View style={rowStyle}>
              <View style={fieldStyle}>
                <Field label={t('shipmentForm.labels.origin')} value={origin} onChangeText={setOrigin} placeholder={t('shipmentForm.placeholders.origin')} onSubmitEditing={handleCreate} />
              </View>
              <View style={fieldStyle}>
                <Field label={t('shipmentForm.labels.destination')} value={destination} onChangeText={setDestination} placeholder={t('shipmentForm.placeholders.destination')} onSubmitEditing={handleCreate} />
              </View>
              <View style={fieldStyle}>
                <SelectField label={t('shipmentForm.labels.incoterm')} value={incoterm} onValueChange={setIncoterm} options={INCOTERMS} placeholder={t('shipmentForm.placeholders.incoterm')} />
              </View>
            </View>

            <View style={rowStyle}>
              <View style={fieldStyle}>
                <SelectField label={t('shipmentForm.labels.cargoType')} value={cargoType} onValueChange={setCargoType} options={cargoTypeOptions} placeholder={t('shipmentForm.placeholders.cargoType')} />
              </View>
              <View style={fieldStyle}>
                <SelectField
                  label={t('shipmentForm.labels.company')}
                  value={companyId}
                  onValueChange={setCompanyId}
                  options={companyOptions}
                  placeholder={t('shipmentForm.placeholders.company')}
                />
              </View>
              <View style={fieldStyle}>
                <View />
              </View>
            </View>
          </FormSection>

          <FormSection title={t('shipmentForm.sections.dates')}>
            <View style={rowStyle}>
              <View style={fieldStyle}>
                <DateField label={t('shipmentForm.labels.etd')} value={etd} placeholder={t('shipmentForm.placeholders.etd')} onPress={() => openDatePicker('etd')} onChangeText={setEtd} mode="date" />
              </View>
              <View style={fieldStyle}>
                <DateField label={t('shipmentForm.labels.eta')} value={eta} placeholder={t('shipmentForm.placeholders.eta')} onPress={() => openDatePicker('eta')} onChangeText={setEta} mode="datetime" />
              </View>
              <View style={fieldStyle}>
                <DateField label={t('shipmentForm.labels.documentaryCutoff')} value={documentaryCutoff} placeholder={t('shipmentForm.placeholders.documentaryCutoff')} onPress={() => openDatePicker('documentaryCutoff')} onChangeText={setDocumentaryCutoff} mode="date" />
              </View>
            </View>

            <View style={rowStyle}>
              <View style={fieldStyle}>
                <DateField label={t('shipmentForm.labels.atd')} value={atd} placeholder={t('shipmentForm.placeholders.atd')} onPress={() => openDatePicker('atd')} onChangeText={setAtd} mode="datetime" />
              </View>
              <View style={fieldStyle}>
                <DateField label={t('shipmentForm.labels.ata')} value={ata} placeholder={t('shipmentForm.placeholders.ata')} onPress={() => openDatePicker('ata')} onChangeText={setAta} mode="datetime" />
              </View>
              <View style={fieldStyle}>
                <Field label={t('shipmentForm.labels.freeDays')} value={freeDays} onChangeText={setFreeDays} placeholder={t('shipmentForm.placeholders.freeDays')} keyboardType="numeric" onSubmitEditing={handleCreate} />
              </View>
            </View>
          </FormSection>
          <FormSection title={t('shipmentForm.sections.parties')}>
            <View style={rowStyle}>
              <View style={fieldStyle}>
                <Field label={t('shipmentForm.labels.exporter')} value={exporter} onChangeText={setExporter} placeholder={t('shipmentForm.placeholders.exporter')} onSubmitEditing={handleCreate} />
              </View>
              <View style={fieldStyle}>
                <Field label={t('shipmentForm.labels.consignee')} value={consignee} onChangeText={setConsignee} placeholder={t('shipmentForm.placeholders.consignee')} onSubmitEditing={handleCreate} />
              </View>
            </View>
          </FormSection>

          <FormSection title={t('shipmentForm.sections.transport')}>
            <View style={rowStyle}>
              <View style={fieldStyle}>
                <Field label={t('shipmentForm.labels.awb')} value={airWaybill} onChangeText={setAirWaybill} placeholder={t('shipmentForm.placeholders.awb')} onSubmitEditing={handleCreate} />
              </View>
              <View style={fieldStyle}>
                <Field label={t('shipmentForm.labels.flight')} value={flightVessel} onChangeText={setFlightVessel} placeholder={t('shipmentForm.placeholders.flight')} onSubmitEditing={handleCreate} />
              </View>
              <View style={fieldStyle}>
                <Field label={t('shipmentForm.labels.container')} value={containerNumber} onChangeText={setContainerNumber} placeholder={t('shipmentForm.placeholders.container')} onSubmitEditing={handleCreate} />
              </View>
            </View>

            <View style={rowStyle}>
              <View style={fieldStyle}>
                <Field label={carrierLabel} value={carrier} onChangeText={setCarrier} placeholder={carrierPlaceholder} onSubmitEditing={handleCreate} />
              </View>
              <View style={fieldStyle}>
                <View />
              </View>
              <View style={fieldStyle}>
                <View />
              </View>
            </View>
          </FormSection>

          <FormSection title={t('shipmentForm.sections.notes')}>
            <View style={rowStyle}>
              <View style={fieldStyle}>
                <SelectField label={t('shipmentForm.labels.status')} value={currentStatus} onValueChange={setCurrentStatus} options={statusOptionsWithCurrentValue} placeholder={t('shipmentForm.placeholders.status')} helperText={operationTypeHint} />
              </View>
              <View style={fieldStyle}>
                <Field label={t('shipmentForm.labels.location')} value={currentLocation} onChangeText={setCurrentLocation} placeholder={t('shipmentForm.placeholders.location')} onSubmitEditing={handleCreate} />
              </View>
              <View style={fieldStyle}>
                <SelectField label={t('shipmentForm.labels.bookingStatus')} value={bookingStatus} onValueChange={setBookingStatus} options={bookingStatusOptions} placeholder={t('shipmentForm.placeholders.bookingStatus')} />
              </View>
            </View>

            <View style={rowStyle}>
              <View style={fieldStyle}>
                <SelectField label={t('shipmentForm.labels.inspectionStatus')} value={inspectionStatus} onValueChange={setInspectionStatus} options={inspectionStatusOptions} placeholder={t('shipmentForm.placeholders.inspectionStatus')} />
              </View>
              <View style={fieldStyle}>
                <View />
              </View>
              <View style={fieldStyle}>
                <View />
              </View>
            </View>
            <Text style={styles.label}>{t('shipmentForm.labels.observation')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('shipmentForm.placeholders.observation')}
              placeholderTextColor={COLORS.secondaryText}
              value={observation}
              onChangeText={setObservation}
              multiline
              numberOfLines={4}
            />
          </FormSection>

          <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={saving}>
            <Text style={styles.buttonText}>
              {saving ? t('createShipment.creating') : t('dashboard.createShipment')}
            </Text>
          </TouchableOpacity>
        </View>

        {Platform.OS !== 'web' && activeDateField ? (
          <View style={Platform.OS === 'ios' ? styles.datePickerCard : {}}>
            <DateTimePicker
              value={dateDraft}
              mode={isDateTimeField(activeDateField) && Platform.OS === 'ios' ? 'datetime' : 'date'}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                if (!activeDateField) return;
                if (event.type === 'dismissed') { setActiveDateField(null); return; }
                const nextDate = selectedDate ?? dateDraft;
                if (Platform.OS === 'android' && isDateTimeField(activeDateField)) {
                  setDateDraft(nextDate);
                  setActiveDateField(null);
                  setAndroidTimeField(activeDateField);
                  return;
                }
                applyDateSelection(activeDateField, nextDate);
                if (Platform.OS !== 'ios') setActiveDateField(null);
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
              if (event.type === 'dismissed' || !androidTimeField) return;
              const nextDate = selectedDate ?? dateDraft;
              applyDateSelection(androidTimeField, mergeDateAndTime(dateDraft, nextDate));
            }}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

type FormSectionProps = {
  title: string;
  children: ReactNode;
};

function FormSection({ title, children }: FormSectionProps) {
  return (
    <View style={styles.formSection}>
      <Text style={styles.formSectionTitle}>{title}</Text>
      <View>{children}</View>
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
        placeholderTextColor={COLORS.secondaryText}
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
  options: { label: string; value: string }[];
  placeholder: string;
  helperText?: string;
};

function SelectField({ label, value, onValueChange, options, placeholder, helperText }: SelectFieldProps) {
  const isWeb = Platform.OS === 'web';
  const displayColor = value ? COLORS.primaryText : COLORS.secondaryText;
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.pickerWrapper, isWeb && styles.pickerWrapperWeb]}>
        <Picker
          selectedValue={value}
          onValueChange={(itemValue) => onValueChange(String(itemValue))}
          style={[styles.picker, isWeb && styles.pickerWeb, { color: displayColor }]}
          itemStyle={isWeb ? styles.pickerItemWeb : {}}
          dropdownIconColor={COLORS.primaryText}
        >
          <Picker.Item label={placeholder} value="" color={COLORS.secondaryText} />
          {options.map((option) => (
            <Picker.Item key={option.value} label={option.label} value={option.value} />
          ))}
        </Picker>
      </View>
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
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
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  if (mode === 'date') return normalized.length >= 10 ? normalized.slice(0, 10) : normalized;
  const localDateTime = normalized.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)?.[0];
  if (localDateTime) return localDateTime;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? normalized : formatDateTimeInputValue(parsed).replace(' ', 'T');
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
            color: value ? COLORS.primaryText : COLORS.secondaryText,
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
    <View style={styles.column}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={[styles.input, styles.inputPressable]} onPress={onPress} activeOpacity={0.8}>
        <Text style={[styles.dateText, !value && styles.placeholderText]}>{value || placeholder}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Estilos — solo los que se usan en este archivo
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  // Layout base
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.backgroundBottom,
  },
  backgroundBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.backgroundBottom,
  },
  backgroundGlowOne: {
    position: 'absolute',
    top: -120,
    left: -50,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(199, 138, 75, 0.18)',
  },
  backgroundGlowTwo: {
    position: 'absolute',
    top: 40,
    right: -70,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 104, 142, 0.18)',
  },

  // Header
  header: {
    paddingTop: 26,
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 14,
    backgroundColor: COLORS.backgroundTop,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  headerDesktop: {
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  brandBarDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  brandTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  headerActionsMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  iconAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 241, 234, 0.08)',
  },
  iconActionText: {
    color: COLORS.surface,
    fontSize: 12,
    fontWeight: '700',
  },

  // Scroll / contenido
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 18,
  },
  contentDesktop: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 64,
  },
  contentMobile: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 28,
  },
  contentWithDock: {
    paddingBottom: AUTH_MOBILE_DOCK_PADDING,
  },

  // Tarjeta del formulario
  form: {
    margin: 16,
    padding: 18,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.line,
    gap: 20,
  },
  formMobile: {
    margin: 0,
    padding: 14,
    borderRadius: 20,
  },
  formSection: {
    gap: 8,
  },
  formSectionTitle: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: '800',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  shadowCard: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 8,
  },

  // Filas y campos responsivos
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 10,
  },
  // En mobile las filas se apilan verticalmente
  rowMobile: {
    flexDirection: 'column',
    gap: 0,
  },
  fieldContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  // En mobile cada campo ocupa el 100%
  fieldContainerMobile: {
    flex: undefined,
    width: '100%',
  },

  // Inputs y labels
  label: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 14,
    marginBottom: 6,
    marginTop: 10,
    color: COLORS.secondaryText,
  },
  helperText: {
    fontSize: 12,
    color: COLORS.blue,
    marginTop: 6,
    marginBottom: 2,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 12,
    borderRadius: 12,
    fontSize: 16,
    backgroundColor: COLORS.surfaceAlt,
    color: COLORS.primaryText,
    minHeight: 48,
  },
  inputPressable: {
    justifyContent: 'center',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  dateText: {
    fontSize: 16,
    color: COLORS.primaryText,
  },
  placeholderText: {
    color: COLORS.secondaryText,
  },
  // Usado en DateField nativo (no-web) para envolver label + input
  column: {
    flexDirection: 'column',
  },

  // Picker
  pickerWrapper: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
    overflow: 'hidden',
    minHeight: 48,
    justifyContent: 'center',
  },
  pickerWrapperWeb: {
    paddingHorizontal: 12,
  },
  picker: {
    width: '100%',
    color: COLORS.primaryText,
    height: 48,
    fontSize: 16,
    backgroundColor: COLORS.surfaceAlt,
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

  // Botón enviar
  button: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: COLORS.orangeSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.orangeBorder,
    marginTop: 20,
  },
  buttonText: {
    color: COLORS.primaryText,
    fontSize: 14,
    fontWeight: '700',
  },

  // Date picker nativo (iOS)
  datePickerCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  dateDoneButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.orangeSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.orangeBorder,
  },
  dateDoneText: {
    color: COLORS.primaryText,
    fontWeight: '700',
  },
});
