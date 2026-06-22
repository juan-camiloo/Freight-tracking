// Archivo: app/(auth)/editShipment/[id].tsx
// Descripcion: Pantalla para editar una carga existente y registrar una observacion en el historial si aplica.

import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AUTH_COLORS,
  AUTH_SHADOW,
  AuthScreenBackground
} from '../../../components/auth/AuthChrome';
import { AUTH_MOBILE_DOCK_PADDING, toggleLanguage } from '../../../components/auth/AuthNavigation';
import Header from '../../../components/Header';
import { useNativeNotification } from '../../../components/ui/NativeNotification';
import { useDashboardShipments } from '../../../hooks/useDashboardShipments';
import { useResponsive } from '../../../hooks/useResponsive';
import { notifyShipmentEvent } from '../../../lib/shipmentNotifications';
import { BOOKING_STATUSES, CARGO_TYPES, getShipmentOperationLabelKey, getShipmentStatusOptions, INCOTERMS, INSPECTION_STATUSES, normalizeShipmentType, SHIPMENT_TYPE_OPTIONS } from '../../../lib/shipmentType';
import { supabase } from '../../../lib/URLs';
import { formatDateInputValue, formatDateTimeInputValue, mergeDateAndTime, parseDateInputValue } from '../../../utils/dateFormatting';

type DateFieldName = 'etd' | 'eta' | 'atd' | 'ata' | 'documentaryCutoff';

const DATE_TIME_FIELDS: DateFieldName[] = ['atd', 'ata', 'documentaryCutoff'];

const isDateTimeField = (field?: DateFieldName | null) => Boolean(field && DATE_TIME_FIELDS.includes(field));

export default function EditShipment() {
  const { t } = useTranslation();
  const notification = useNativeNotification();
  const { id } = useLocalSearchParams();
  const { height, isDesktop } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doNumber, setDoNumber] = useState('');
  const [shipmentType, setShipmentType] = useState('');
  const [currentStatus, setCurrentStatus] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [exporter, setExporter] = useState('');
  const [consignee, setConsignee] = useState('');
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
  const [airWaybill, setAirWaybill] = useState('');
  const [flightVessel, setFlightVessel] = useState('');
  const [containerNumber, setContainerNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [observation, setObservation] = useState('');
  const [clientId, setClientId] = useState('');

  const [activeDateField, setActiveDateField] = useState<DateFieldName | null>(null);
  const [androidTimeField, setAndroidTimeField] = useState<DateFieldName | null>(null);
  const [dateDraft, setDateDraft] = useState(new Date());

  const { userId } = useDashboardShipments();
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
  const manageLanguage = toggleLanguage;
  useEffect(() => {
    void loadShipment();
  }, [id]);

  const loadShipment = async () => {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setDoNumber(data.do_number || '');
      setShipmentType(normalizeShipmentType(data.shipment_type));
      setCurrentStatus(data.current_status || '');
      setCurrentLocation(data.current_location || '');
      setExporter(data.exporter || '');
      setConsignee(data.consignee || '');
      setOrigin(data.origin || '');
      setDestination(data.destination || '');
      setEtd(data.etd || '');
      setEta(data.eta || '');
      setAtd(data.atd || '');
      setAta(data.ata || '');
      setDocumentaryCutoff(data.documentary_cutoff || '');
      setIncoterm(data.incoterm || '');
      setCargoType(data.cargo_type || '');
      setFreeDays(data.free_days !== null && data.free_days !== undefined ? String(data.free_days) : '');
      setBookingStatus(data.booking_status || '');
      setInspectionStatus(data.inspection_status || '');
      setAirWaybill(data.air_waybill || '');
      setFlightVessel(data.flight_vessel || '');
      setContainerNumber(data.container_number || '');
      setCarrier(data.carrier || '');
      setClientId(data.client_id || '');
    } catch {
      notification.error(t('editShipment.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!doNumber || !origin || !destination) {
      notification.error(t('editShipment.doRequiredError'));
      return;
    }

    if (freeDays && Number.isNaN(Number(freeDays))) {
      notification.error(t('editShipment.freeDaysError'));
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('shipments')
        .update({
          do_number: doNumber,
          shipment_type: shipmentType || null,
          current_status: currentStatus,
          current_location: currentLocation,
          exporter,
          consignee,
          origin,
          destination,
          etd: etd || null,
          eta: eta || null,
          atd: atd || null,
          ata: ata || null,
          documentary_cutoff: documentaryCutoff || null,
          incoterm: incoterm || null,
          cargo_type: cargoType || null,
          free_days: freeDays ? Number(freeDays) : null,
          booking_status: bookingStatus || null,
          inspection_status: inspectionStatus || null,
          air_waybill: airWaybill || null,
          flight_vessel: flightVessel || null,
          container_number: containerNumber || null,
          carrier: carrier || null,
          updated_by: userId,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      if (observation) {
        const { error: updateLogError } = await supabase.from('shipment_updates').insert({
          shipment_id: id,
          status: currentStatus,
          location: currentLocation,
          observation,
          updated_by: userId
        });

        if (updateLogError) throw updateLogError;
      }

      await notifyShipmentEvent({
        eventType: 'updated',
        shipmentId: String(id ?? ''),
        doNumber,
        status: currentStatus,
      });

      notification.success(t('editShipment.updatedOk'));
      router.replace('/');
    } catch (error) {
      if (error instanceof Error) {
        notification.error(error.message);
      } else {
        notification.error(t('editShipment.unknownError'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await notification.confirm({
      title: t('common.delete'),
      message: t('editShipment.deleteConfirm'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });

    if (confirmed) {
      void confirmDelete();
    }
  };

  const confirmDelete = async () => {
    const shipmentId = String(id ?? '');
    if (!shipmentId) {
      notification.error(t('editShipment.invalidShipmentId'));
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

      notification.success(t('editShipment.deleteOk'));
      router.replace('/');
    } catch (error) {
      if (error instanceof Error) {
        notification.error(error.message);
      } else {
        notification.error(t('editShipment.deleteError'));
      }
    } finally {
      setSaving(false);
    }
  };

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

  const getDateValue = (field: DateFieldName) => {
    switch (field) {
      case 'etd':
        return etd;
      case 'eta':
        return eta;
      case 'atd':
        return atd;
      case 'ata':
        return ata;
      case 'documentaryCutoff':
        return documentaryCutoff;
      default:
        return '';
    }
  };

  const setDateValue = (field: DateFieldName, value: string) => {
    switch (field) {
      case 'etd':
        setEtd(value);
        break;
      case 'eta':
        setEta(value);
        break;
      case 'atd':
        setAtd(value);
        break;
      case 'ata':
        setAta(value);
        break;
      case 'documentaryCutoff':
        setDocumentaryCutoff(value);
        break;
      default:
        break;
    }
  };

  const openDatePicker = (field: DateFieldName) => {
    const currentValue = getDateValue(field);
    const parsed = parseDateInputValue(currentValue);
    setDateDraft(parsed ?? new Date());
    setActiveDateField(field);
  };

  const applyDateSelection = (field: DateFieldName, date: Date) => {
    const formatted = isDateTimeField(field) ? formatDateTimeInputValue(date) : formatDateInputValue(date);
    setDateValue(field, formatted);
  };

  if (loading) {
    return (
      <View style={[styles.center, styles.container]}>
        <AuthScreenBackground />
        <ActivityIndicator size="large" color={AUTH_COLORS.orange} />
      </View>
    );
  }

  const rowStyle = [styles.row, !isDesktop && styles.rowMobile];
  const fieldStyle = [styles.fieldContainer, !isDesktop && styles.fieldContainerMobile];

  return (
    <View style={[styles.container, { minHeight: height }]}>
      <AuthScreenBackground />
      <Header
        isDesktop= {isDesktop}
        title={t('editShipment.headerTitle')}
        onToggleLanguage={manageLanguage}
        showSearch = {false}
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
        <View style={[styles.heroCard, styles.shadowCard, !isDesktop && styles.heroCardMobile]}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{doNumber || t('shipmentForm.labels.doNumber')}</Text>
              <Text style={styles.heroMeta}>
                {currentStatus || t('shipmentForm.labels.status')}
                {currentLocation ? ` · ${currentLocation}` : ''}
              </Text>
            </View>
            <View style={[styles.heroActions, !isDesktop && styles.heroActionsMobile]}>
              <TouchableOpacity style={[styles.secondaryButton, !isDesktop && styles.actionButtonMobile, saving && styles.buttonDisabled]} onPress={handleDelete} disabled={saving}>
                <Ionicons name="trash-outline" size={18} color={AUTH_COLORS.danger} />
                <Text style={styles.secondaryButtonDangerText}>{t('common.delete')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, !isDesktop && styles.actionButtonMobile, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
                <Ionicons name="save-outline" size={18} color={AUTH_COLORS.primaryText} />
                <Text style={styles.primaryButtonText}>
                  {saving ? t('editShipment.saving') : t('common.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={[styles.form, styles.shadowCard, !isDesktop && styles.formMobile]}>
          <FormSection title={t('shipmentForm.sections.shipmentInfo')}>
            <View style={rowStyle}>
              <View style={fieldStyle}>
                <InputField label={t('shipmentForm.labels.doNumber')} value={doNumber} onChangeText={setDoNumber} onSubmitEditing={handleSave} />
              </View>
              <View style={fieldStyle}>
                <SelectField
                  label={t('shipmentForm.labels.via')}
                  value={shipmentType}
                  onValueChange={setShipmentType}
                  options={shipmentTypeOptions}
                  placeholder={t('shipmentForm.placeholders.via')}
                />
              </View>
            </View>

            <View style={rowStyle}>
              <View style={fieldStyle}>
                <InputField label={t('shipmentForm.labels.origin')} value={origin} onChangeText={setOrigin} onSubmitEditing={handleSave} />
              </View>
              <View style={fieldStyle}>
                <InputField label={t('shipmentForm.labels.destination')} value={destination} onChangeText={setDestination} onSubmitEditing={handleSave} />
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
                <View/>
              </View>
              <View style={fieldStyle}>
                <View/>
              </View>
            </View>
          </FormSection>

          <FormSection title={t('shipmentForm.sections.dates')}>
            <View style={rowStyle}>
              <View style={fieldStyle}>
                <DateField label={t('shipmentForm.labels.etd')} value={etd} placeholder={t('shipmentForm.placeholders.date')} onPress={() => openDatePicker('etd')} onChangeText={setEtd} mode="date" />
              </View>
              <View style={fieldStyle}>
                <DateField label={t('shipmentForm.labels.atd')} value={atd} placeholder={t('shipmentForm.placeholders.dateTime')} onPress={() => openDatePicker('atd')} onChangeText={setAtd} mode="datetime" />
              </View>
              <View style={fieldStyle}>
                <DateField label={t('shipmentForm.labels.eta')} value={eta} placeholder={t('shipmentForm.placeholders.date')} onPress={() => openDatePicker('eta')} onChangeText={setEta} mode="date" />
              </View>
            </View>

            <View style={rowStyle}>
              <View style={fieldStyle}>
                <DateField label={t('shipmentForm.labels.ata')} value={ata} placeholder={t('shipmentForm.placeholders.dateTime')} onPress={() => openDatePicker('ata')} onChangeText={setAta} mode="datetime" />
              </View>
              <View style={fieldStyle}>
                <DateField
                  label={t('shipmentForm.labels.documentaryCutoff')}
                  value={documentaryCutoff}
                  placeholder={t('shipmentForm.placeholders.dateTime')}
                  onPress={() => openDatePicker('documentaryCutoff')}
                  onChangeText={setDocumentaryCutoff}
                  mode="datetime"
                />
              </View>
              <View style={fieldStyle}>
                <InputField
                  label={t('shipmentForm.labels.freeDays')}
                  value={freeDays}
                  onChangeText={setFreeDays}
                  keyboardType="numeric"
                  onSubmitEditing={handleSave}
                />
              </View>
            </View>
          </FormSection>

          <FormSection title={t('shipmentForm.sections.tracking')}>
            <View style={rowStyle}>
              <View style={fieldStyle}>
                <SelectField label={t('shipmentForm.labels.status')} value={currentStatus} onValueChange={setCurrentStatus} options={statusOptionsWithCurrentValue} placeholder={t('shipmentForm.placeholders.status')} helperText={operationTypeHint} />
              </View>
              <View style={fieldStyle}>
                <InputField label={t('shipmentForm.labels.location')} value={currentLocation} onChangeText={setCurrentLocation} onSubmitEditing={handleSave} />
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
          </FormSection>

          <FormSection title={t('shipmentForm.sections.parties')}>
            <View style={rowStyle}>
              <View style={fieldStyle}>
                <InputField label={t('shipmentForm.labels.exporter')} value={exporter} onChangeText={setExporter} onSubmitEditing={handleSave} />
              </View>
              <View style={fieldStyle}>
                <InputField label={t('shipmentForm.labels.consignee')} value={consignee} onChangeText={setConsignee} onSubmitEditing={handleSave} />
              </View>
            </View>
          </FormSection>

          <FormSection title={t('shipmentForm.sections.transport')}>
            <View style={rowStyle}>
              <View style={fieldStyle}>
                <InputField label={t('shipmentForm.labels.awb')} value={airWaybill} onChangeText={setAirWaybill} onSubmitEditing={handleSave} />
              </View>
              <View style={fieldStyle}>
                <InputField label={t('shipmentForm.labels.flight')} value={flightVessel} onChangeText={setFlightVessel} onSubmitEditing={handleSave} />
              </View>
              <View style={fieldStyle}>
                <InputField label={t('shipmentForm.labels.container')} value={containerNumber} onChangeText={setContainerNumber} onSubmitEditing={handleSave} />
              </View>
            </View>

            <View style={rowStyle}>
              <View style={fieldStyle}>
                <InputField label={t('shipmentForm.labels.carrier')} value={carrier} onChangeText={setCarrier} onSubmitEditing={handleSave} />
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
            <Text style={styles.label}>{t('shipmentForm.labels.observation')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('shipmentForm.placeholders.observation')}
              placeholderTextColor={AUTH_COLORS.secondaryText}
              value={observation}
              onChangeText={setObservation}
              multiline
              numberOfLines={4}
            />
          </FormSection>
        </View>

        {Platform.OS !== 'web' && activeDateField ? (
          <View style={Platform.OS === 'ios' ? styles.datePickerCard : undefined}>
            <DateTimePicker
              value={dateDraft}
              mode={isDateTimeField(activeDateField) && Platform.OS === 'ios' ? 'datetime' : 'date'}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                if (!activeDateField) return;
                if (event.type === 'dismissed') {
                  setActiveDateField(null);
                  return;
                }

                const nextDate = selectedDate ?? dateDraft;

                if (Platform.OS === 'android' && isDateTimeField(activeDateField)) {
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

type InputFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing?: () => void;
  keyboardType?: 'default' | 'numeric' | 'email-address';
};

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
  options: { label: string; value: string }[];
  placeholder: string;
  helperText?: string;
};

function SelectField({ label, value, onValueChange, options, placeholder, helperText }: SelectFieldProps) {
  const isWeb = Platform.OS === 'web';
  const displayColor = value ? AUTH_COLORS.primaryText : AUTH_COLORS.secondaryText;
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.pickerWrapper, isWeb && styles.pickerWrapperWeb]}>
        <Picker
          selectedValue={value}
          onValueChange={(itemValue) => onValueChange(String(itemValue))}
          style={[styles.picker, isWeb && styles.pickerWeb, { color: displayColor }]}
          itemStyle={isWeb ? styles.pickerItemWeb : undefined}
          dropdownIconColor={AUTH_COLORS.primaryText}
        >
          <Picker.Item label={placeholder} value="" color={AUTH_COLORS.secondaryText} />
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
            color: value ? AUTH_COLORS.primaryText : AUTH_COLORS.secondaryText,
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AUTH_COLORS.backgroundBottom,
    overflow: 'hidden',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { flex: 1 },
  content: {
    gap: 18,
    paddingBottom: 28,
  },
  contentDesktop: {
    paddingHorizontal: 28,
    paddingTop: 24,
  },
  contentMobile: {
    paddingHorizontal: 12,
    paddingTop: 14,
  },
  contentWithDock: {
    paddingBottom: AUTH_MOBILE_DOCK_PADDING,
  },
  shadowCard: AUTH_SHADOW,
  heroCard: {
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    padding: 22,
    gap: 18,
  },
  heroCardMobile: {
    padding: 16,
    borderRadius: 20,
  },
  heroTop: {
    gap: 16,
  },
  heroCopy: {
    gap: 4,
  },
  heroTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 30,
    fontWeight: '800',
  },
  heroMeta: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 14,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroActionsMobile: {
    flexDirection: 'column',
  },
  form: {
    padding: 18,
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    gap: 20,
  },
  formMobile: {
    padding: 14,
    borderRadius: 20,
  },
  formSection: {
    gap: 8,
  },
  formSectionTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 16,
    fontWeight: '800',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: AUTH_COLORS.line,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 10,
  },
  rowMobile: {
    flexDirection: 'column',
    gap: 0,
  },
  fieldContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  fieldContainerMobile: {
    flex: undefined,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 14,
    marginBottom: 6,
    marginTop: 10,
    color: AUTH_COLORS.secondaryText,
  },
  helperText: {
    fontSize: 12,
    color: AUTH_COLORS.blue,
    marginTop: 6,
    marginBottom: 2,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    padding: 12,
    borderRadius: 12,
    fontSize: 16,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    color: AUTH_COLORS.primaryText,
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
    color: AUTH_COLORS.primaryText,
  },
  placeholderText: {
    color: AUTH_COLORS.secondaryText,
  },
  column: {
    flexDirection: 'column',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    overflow: 'hidden',
    minHeight: 48,
    justifyContent: 'center',
  },
  pickerWrapperWeb: {
    paddingHorizontal: 12,
  },
  picker: {
    width: '100%',
    color: AUTH_COLORS.primaryText,
    height: 48,
    fontSize: 16,
    backgroundColor: AUTH_COLORS.surfaceAlt,
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
  primaryButton: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: AUTH_COLORS.orangeSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
  },
  actionButtonMobile: {
    alignSelf: 'stretch',
  },
  primaryButtonText: {
    color: AUTH_COLORS.primaryText,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  secondaryButtonDangerText: {
    color: AUTH_COLORS.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  datePickerCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 28,
    padding: 12,
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  dateDoneButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
  },
  dateDoneText: {
    color: AUTH_COLORS.primaryText,
    fontWeight: '700',
  },
});
