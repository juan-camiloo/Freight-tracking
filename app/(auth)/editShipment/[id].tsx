// Archivo: app/(auth)/editShipment/[id].tsx
// Descripcion: Pantalla para editar una carga existente y registrar una observacion en el historial si aplica.

import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Linking,
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
import { useAuthUser } from '../../../contexts/AuthUserContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { notifyShipmentEvent } from '../../../lib/shipmentNotifications';
import * as types from '../../../lib/shipmentType';
import { supabase } from '../../../lib/URLs';
import { formatDateInputValue, formatDateTimeInputValue, mergeDateAndTime, parseDateInputValue } from '../../../utils/dateFormatting';

type DateFieldName = 'etd' | 'eta' | 'atd' | 'ata' | 'documentaryCutoff';

const DATE_TIME_FIELDS: DateFieldName[] = ['atd', 'ata', 'documentaryCutoff'];

const isDateTimeField = (field?: DateFieldName | null) => Boolean(field && DATE_TIME_FIELDS.includes(field));

export default function EditShipmentScreen() {
  const { t } = useTranslation();
  const notification = useNativeNotification();
  const { id } = useLocalSearchParams();
  const { height, isDesktop } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doNumber, setDoNumber] = useState('');
  const [shipmentType, setShipmentType] = useState('');
  const [currentStatus, setCurrentStatus] = useState('');
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

  // Estado para gestión de documentos
  const [documents, setDocuments] = useState<types.DocumentRecord[]>([]);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);

  const [activeDateField, setActiveDateField] = useState<DateFieldName | null>(null);
  const [androidTimeField, setAndroidTimeField] = useState<DateFieldName | null>(null);
  const [dateDraft, setDateDraft] = useState(new Date());

  const { userId } = useAuthUser();
  const resolveOptions = (options: { labelKey: string; value: string }[]) =>
    options.map((option) => ({ label: t(option.labelKey), value: option.value }));

  const shipmentTypeOptions = resolveOptions(types.SHIPMENT_TYPE_OPTIONS);
  const cargoTypeOptions = resolveOptions(types.CARGO_TYPES);
  const bookingStatusOptions = resolveOptions(types.BOOKING_STATUSES);
  const inspectionStatusOptions = resolveOptions(types.INSPECTION_STATUSES);
  const statusOptions = resolveOptions(types.getShipmentStatusOptions(doNumber));
  const statusOptionsWithCurrentValue = currentStatus && !statusOptions.some((option) => option.value === currentStatus)
    ? [...statusOptions, { label: currentStatus, value: currentStatus }]
    : statusOptions;
  const operationTypeLabelKey = types.getShipmentOperationLabelKey(doNumber);
  const operationTypeHint = operationTypeLabelKey ? `${t('shipmentForm.labels.operationType')}: ${t(operationTypeLabelKey)}` : undefined;
  const manageLanguage = toggleLanguage;

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

  useEffect(() => {
    void loadShipment();
  }, [id]);

  const loadShipment = async () => {
    try {
      const [shipmentRes, docsRes] = await Promise.all([
        supabase.from('shipments').select('*').eq('id', id).single(),
        supabase
          .from('documents')
          .select('*')
          .eq('shipment_id', id)
          .or('is_deleted.eq.false,is_deleted.is.null')
          .order('created_at', { ascending: false }),
      ]);

      if (shipmentRes.error) throw shipmentRes.error;
      const data = shipmentRes.data;

      setDoNumber(data.do_number || '');
      setShipmentType(types.normalizeShipmentType(data.shipment_type));
      setCurrentStatus(data.current_status || '');
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

      setDocuments((docsRes.data as types.DocumentRecord[]) ?? []);
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

    const cleanAwb = airWaybill.trim();
    if (cleanAwb && !/^[A-Za-z0-9\s\-_/.]{3,35}$/.test(cleanAwb)) {
      notification.error(t('editShipment.awbFormatError', { defaultValue: t('createShipment.awbFormatError') }));
      return;
    }

    if (shipmentType === 'maritime' && containerNumber && !types.isValidContainerNumber(containerNumber)) {
      notification.error(t('editShipment.containerFormatError', { defaultValue: t('createShipment.containerFormatError') }));
      return;
    }

    setSaving(true);

    try {
      const cleanString = (val: string | null | undefined): string | null => {
        if (typeof val !== 'string') return null;
        const trimmed = val.trim();
        return trimmed.length > 0 ? trimmed : null;
      };

      const { error: updateError } = await supabase
        .from('shipments')
        .update({
          do_number: cleanString(doNumber) || doNumber,
          shipment_type: cleanString(shipmentType),
          current_status: cleanString(currentStatus),
          exporter: cleanString(exporter),
          consignee: cleanString(consignee),
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
          air_waybill: cleanString(airWaybill),
          flight_vessel: cleanString(flightVessel),
          container_number: cleanString(containerNumber),
          carrier: cleanString(carrier),
          updated_by: userId,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      const cleanObs = cleanString(observation);
      if (cleanObs) {
        const { error: updateLogError } = await supabase.from('shipment_updates').insert({
          shipment_id: id,
          observation: cleanObs,
          updated_by: userId,
        });

        if (updateLogError) {
          console.warn('Update log error:', updateLogError);
        }
      }

      void notifyShipmentEvent({
        eventType: 'updated',
        shipmentId: String(id ?? ''),
        doNumber,
        status: currentStatus,
      }).catch((notifyErr) => {
        console.warn('Error enviando notificación en background:', notifyErr);
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
      const { error } = await supabase
        .from('shipments')
        .update({ status: 'inactive' })
        .eq('id', shipmentId);
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

  const handleUploadDocument = async () => {
    const shipmentId = String(id ?? '');
    if (!shipmentId) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];

      if (asset.size && asset.size > 20 * 1024 * 1024) {
        notification.error(t('shipmentDetail.fileTooLarge', { defaultValue: 'El archivo supera el tamaño máximo recomendado de 20 MB.' }));
        return;
      }

      setUploadingDocument(true);

      const safeName = asset.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${shipmentId}/${Date.now()}_${safeName}`;

      let uploadPayload: Blob | File;
      if (Platform.OS === 'web' && (asset as any).file) {
        uploadPayload = (asset as any).file;
      } else {
        const res = await fetch(asset.uri);
        uploadPayload = await res.blob();
      }

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, uploadPayload, {
          contentType: asset.mimeType || 'application/pdf',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: insertedDoc, error: insertError } = await supabase
        .from('documents')
        .insert({
          shipment_id: shipmentId,
          file_name: asset.name,
          file_size: asset.size ?? 0,
          file_path: storagePath,
          storage_path: storagePath,
          uploaded_by: userId,
          is_deleted: false,
        })
        .select('*')
        .single();

      if (insertError) throw insertError;

      setDocuments((prev) => [insertedDoc, ...prev]);
      notification.success(t('shipmentDetail.uploadSuccess', { defaultValue: 'Documento subido correctamente' }));
    } catch (err: any) {
      notification.error(err?.message || t('shipmentDetail.uploadError', { defaultValue: 'Error al subir documento' }));
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleOpenDocument = async (doc: types.DocumentRecord) => {
    const rawPath = doc.file_path || doc.storage_path;
    if (!rawPath) {
      notification.error(t('shipmentDetail.docNoPath', { defaultValue: 'Ruta no encontrada' }));
      return;
    }
    setOpeningDocumentId(doc.id);
    try {
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(rawPath, 3600);
      if (error || !data?.signedUrl) throw error || new Error('No se generó URL');
      await Linking.openURL(data.signedUrl);
    } catch {
      notification.error(t('shipmentDetail.docOpenError', { defaultValue: 'No se pudo abrir el documento' }));
    } finally {
      setOpeningDocumentId(null);
    }
  };

  const handleDeleteDocument = async (doc: types.DocumentRecord) => {
    const confirmed = await notification.confirm({
      title: t('shipmentDetail.deleteDocTitle', { defaultValue: 'Eliminar documento' }),
      message: t('shipmentDetail.deleteDocConfirm', {
        fileName: doc.file_name,
        defaultValue: `¿Eliminar "${doc.file_name}"?`,
      }),
      confirmLabel: t('common.delete', { defaultValue: 'Eliminar' }),
      cancelLabel: t('common.cancel', { defaultValue: 'Cancelar' }),
      destructive: true,
    });
    if (!confirmed) return;

    setDeletingDocumentId(doc.id);
    try {
      const { error } = await supabase
        .from('documents')
        .update({ is_deleted: true })
        .eq('id', doc.id);
      if (error) throw error;
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      notification.success(t('shipmentDetail.deleteDocOk', { defaultValue: 'Documento eliminado' }));
    } catch {
      notification.error(t('shipmentDetail.deleteDocError', { defaultValue: 'Error al eliminar documento' }));
    } finally {
      setDeletingDocumentId(null);
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
    <View style={styles.container}>
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
                <SelectField label={t('shipmentForm.labels.incoterm')} value={incoterm} onValueChange={setIncoterm} options={types.INCOTERMS} placeholder={t('shipmentForm.placeholders.incoterm')} />
              </View>
            </View>

            <View style={rowStyle}>
              <View style={fieldStyle}>
                <SelectField label={t('shipmentForm.labels.cargoType')} value={cargoType} onValueChange={setCargoType} options={cargoTypeOptions} placeholder={t('shipmentForm.placeholders.cargoType')} />
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
                <SelectField label={t('shipmentForm.labels.bookingStatus')} value={bookingStatus} onValueChange={setBookingStatus} options={bookingStatusOptions} placeholder={t('shipmentForm.placeholders.bookingStatus')} />
              </View>
              <View style={fieldStyle}>
                <SelectField label={t('shipmentForm.labels.inspectionStatus')} value={inspectionStatus} onValueChange={setInspectionStatus} options={inspectionStatusOptions} placeholder={t('shipmentForm.placeholders.inspectionStatus')} />
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
                <InputField label={carrierLabel} value={carrier} onChangeText={setCarrier} placeholder={carrierPlaceholder} onSubmitEditing={handleSave} />
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
          
          <FormSection title={t('shipmentDetail.sectionDocuments')}>
            <View style={styles.documentSectionHeader}>
              <Text style={styles.documentSectionDesc}>
                {t('shipmentDetail.documentsDescription', { defaultValue: 'Gestiona los documentos PDF asociados a esta carga' })}
              </Text>
              <TouchableOpacity
                style={styles.uploadDocBtn}
                onPress={handleUploadDocument}
                disabled={uploadingDocument}
              >
                {uploadingDocument ? (
                  <ActivityIndicator size="small" color={AUTH_COLORS.orange} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={16} color={AUTH_COLORS.orange} />
                    <Text style={styles.uploadDocBtnText}>
                      {t('shipmentDetail.uploadDocument', { defaultValue: 'Cargar documento' })}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {documents.length > 0 ? (
              <View style={styles.documentsWrap}>
                {documents.map((doc) => (
                  <View key={doc.id} style={styles.documentItemRow}>
                    <TouchableOpacity
                      style={styles.documentClickArea}
                      onPress={() => handleOpenDocument(doc)}
                      disabled={openingDocumentId === doc.id}
                    >
                      <View style={styles.documentIconWrap}>
                        <Ionicons name="document-text-outline" size={18} color={AUTH_COLORS.blue} />
                      </View>
                      <View style={styles.documentMetaWrap}>
                        <Text style={styles.documentTitle} numberOfLines={1}>{doc.file_name}</Text>
                        <Text style={styles.documentSize}>
                          {openingDocumentId === doc.id
                            ? t('shipmentDetail.opening')
                            : `${Math.round((doc.file_size || 0) / 1024)} KB`}
                        </Text>
                      </View>
                      <Ionicons name="open-outline" size={16} color={AUTH_COLORS.secondaryText} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteDocBtn}
                      onPress={() => handleDeleteDocument(doc)}
                      disabled={deletingDocumentId === doc.id}
                      accessibilityLabel="Eliminar documento"
                    >
                      {deletingDocumentId === doc.id ? (
                        <ActivityIndicator size="small" color={AUTH_COLORS.danger} />
                      ) : (
                        <Ionicons name="trash-outline" size={16} color={AUTH_COLORS.danger} />
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyDocsBox}>
                <Ionicons name="document-outline" size={24} color={AUTH_COLORS.secondaryText} />
                <Text style={styles.emptyDocsText}>
                  {t('dashboard.emptyDocuments')}
                </Text>
              </View>
            )}
          </FormSection>

          <View style={styles.deleteFormActionRow}>
            <TouchableOpacity
              style={[styles.deleteFormBtn, saving && styles.buttonDisabled]}
              onPress={handleDelete}
              disabled={saving}
            >
              <Ionicons name="trash-outline" size={16} color={AUTH_COLORS.danger} />
              <Text style={styles.deleteFormBtnText}>{t('editShipment.deleteShipment', { defaultValue: 'Eliminar carga' })}</Text>
            </TouchableOpacity>
          </View>
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

      <TouchableOpacity
        style={[
          styles.saveFab,
          !isDesktop && styles.saveFabMobile,
          saving && styles.buttonDisabled,
        ]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <Ionicons name="save-outline" size={20} color="#ffffff" />
            <Text style={styles.saveFabText}>{t('common.save')}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

type InputFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing?: () => void;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  placeholder?: string;
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

function InputField({ label, value, onChangeText, onSubmitEditing, keyboardType, placeholder }: InputFieldProps) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={AUTH_COLORS.secondaryText}
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
    minHeight: 0,
    backgroundColor: AUTH_COLORS.backgroundBottom,
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
    paddingBottom: 64,
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
    // Deprecated - layout refactored into uniform form
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
  documentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  documentSectionDesc: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
    flex: 1,
    minWidth: 200,
  },
  uploadDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
  },
  uploadDocBtnText: {
    color: AUTH_COLORS.orange,
    fontSize: 12,
    fontWeight: '700',
  },
  documentsWrap: {
    gap: 8,
  },
  documentItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  documentClickArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  documentIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AUTH_COLORS.blueSoft,
  },
  documentMetaWrap: {
    flex: 1,
    minWidth: 0,
  },
  documentTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  documentSize: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 11,
    marginTop: 2,
  },
  deleteDocBtn: {
    padding: 6,
    borderRadius: 8,
  },
  emptyDocsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  emptyDocsText: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
  },
  deleteFormActionRow: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: AUTH_COLORS.line,
    alignItems: 'flex-start',
  },
  deleteFormBtn: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  deleteFormBtnText: {
    color: AUTH_COLORS.danger,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  saveFab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: AUTH_COLORS.orange,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 99,
  },
  saveFabMobile: {
    bottom: AUTH_MOBILE_DOCK_PADDING + 16,
    right: 16,
  },
  saveFabText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
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
