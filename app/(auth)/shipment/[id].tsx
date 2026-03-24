// Archivo: app/(auth)/shipment/[id].tsx
// Descripcion: Pantalla de detalle de carga. Muestra informacion, historial, documentos y permite subir/abrir documentos.

import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LogoCorner from '../../../components/LogoCorner';
import { supabase } from '../../../lib/supabase';

type Shipment = {
  id: string;
  do_number: string;
  tracking_number?: string | null;
  shipment_type: string;
  origin: string;
  destination: string;
  etd: string | null;
  eta: string | null;
  documentary_cutoff?: string | null;
  incoterm?: string;
  current_status?: string;
  current_location?: string;
  exporter?: string;
  consignee?: string;
  air_waybill?: string;
  flight_vessel?: string;
  container_number?: string;
  carrier?: string;
  status?: string | null;
  booking_status?: string | null;
  inspection_status?: string | null;
  free_days?: number | null;
  cargo_type?: string | null;
  client_id?: string;
};

type ShipmentUpdate = {
  id: string;
  shipment_id: string;
  created_at: string;
  status?: string;
  location?: string;
  observation?: string;
};

type Document = {
  id: string;
  shipment_id: string;
  file_name: string;
  file_size: number;
  file_path?: string | null;
  storage_path?: string | null;
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

export default function ShipmentDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams();
  // Datos principales de la carga.
  const [shipment, setShipment] = useState<Shipment | null>(null);
  // Historial de eventos de la carga.
  const [updates, setUpdates] = useState<ShipmentUpdate[]>([]);
  // Documentos asociados a la carga.
  const [documents, setDocuments] = useState<Document[]>([]);
  // Estado general de carga de la pantalla.
  const [loading, setLoading] = useState(true);
  // Estados de acciones internas.
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const [deletingShipment, setDeletingShipment] = useState(false);
  // Flags de permisos y usuario.
  const [isInternal, setIsInternal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    void loadShipmentDetails();
  }, [id]);

  // Carga permisos, datos principales, historial y documentos.
  const loadShipmentDetails = async () => {
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_internal')
        .eq('id', user.id)
        .single();

      setIsInternal(profile?.is_internal || false);

      const { data: shipmentData, error: shipmentError } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', id)
        .single();

      if (shipmentError) throw shipmentError;
      setShipment(shipmentData);

      const { data: relationData } = await supabase
        .from('profile_shipment')
        .select('client_id')
        .eq('shipment_id', id)
        .eq('client_id', user.id)
        .maybeSingle();

      const assignedToUser = Boolean(relationData);
      console.log('relationData:', relationData, 'userId:', user.id, 'shipmentId:', id);
      if (assignedToUser || profile?.is_internal) {
        const { data: updatesData } = await supabase
          .from('shipment_updates')
          .select('*')
          .eq('shipment_id', id)
          .order('created_at', { ascending: false });

        setUpdates(updatesData || []);

        const { data: docsData } = await supabase
          .from('documents')
          .select('*')
          .eq('shipment_id', id);

        setDocuments(docsData || []);
      }
    } catch (error) {
      console.error('Error cargando detalle de carga:', error);
      Alert.alert(t('common.error'), t('shipmentDetail.loadError'));
    } finally {
      setLoading(false);
    }
  };

  // Desactiva la carga (solo interno).
  const handleDeactive = async () => {
    setDeletingShipment(true);
    if (!isInternal) {
      Alert.alert(t('common.error'), t('shipmentDetail.internalDeleteOnly'));
      setDeletingShipment(false);
      return;
    }

    const shipmentId = String(id ?? '');
    if (!shipmentId) {
      Alert.alert(t('common.error'), t('shipmentDetail.invalidShipmentId'));
      setDeletingShipment(false);
      return;
    }
    try {
      const { error: deactiveError } = await supabase
        .from('shipments')
        .update({ status: 'inactive' })
        .eq('id', shipmentId);

      if (deactiveError) {
        throw deactiveError;
      }

      Alert.alert(t('common.success'), t('shipmentDetail.deactivatedOk'));
      router.replace('/');
    } catch (error) {
      console.error('Error eliminando carga:', error);
      Alert.alert(t('common.error'), t('shipmentDetail.deactivateError'));
    } finally {
      setDeletingShipment(false);
    }
  };

  // Sube documento PDF a Storage y lo registra en DB.
  const handleUploadDocument = async () => {
    if (!isInternal) {
      Alert.alert(t('common.error'), t('shipmentDetail.internalUploadOnly'));
      return;
    }

    const shipmentId = String(id ?? '');
    if (!shipmentId) {
      Alert.alert(t('common.error'), t('shipmentDetail.invalidShipmentId'));
      return;
    }

    try {
      setUploadingDocument(true);

      const picker = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (picker.canceled || !picker.assets?.length) {
        return;
      }

      const asset = picker.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const safeName = (asset.name || t('shipmentDetail.defaultDocumentName')).replace(/[^a-zA-Z0-9._-]/g, '_');
      const objectPath = `${shipmentId}/${Date.now()}_${safeName}`;

      const { data: uploaded, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(objectPath, blob, {
          contentType: asset.mimeType || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError || !uploaded?.path) {
        throw uploadError || new Error(t('shipmentDetail.uploadError'));
      }

      const { data: insertedDoc, error: insertError } = await supabase
  .from('documents')
  .insert({
    shipment_id: shipmentId,
    file_name: asset.name || safeName,
    file_size: asset.size ?? 0,
    file_path: uploaded.path,
    storage_path: uploaded.path,
    uploaded_by: userId,
  })
  .select('*')
  .single();

if (insertError) {
  try {
    await supabase.storage
    .from('documents')
    .remove([uploaded.path]);
  } catch {
    // no-op
  }
  throw insertError;
}

      setDocuments((prev) => [
        ...prev,
        {
          id: insertedDoc?.id ? String(insertedDoc.id) : `${Date.now()}`,
          shipment_id: shipmentId,
          file_name: asset.name || safeName,
          file_size: asset.size ?? 0,
          file_path: uploaded.path,
          storage_path: uploaded.path,
        },
      ]);

      Alert.alert(t('common.success'), t('shipmentDetail.uploadOk'));
    } catch (error) {
      console.error('Error subiendo documento:', error);
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('shipmentDetail.uploadError'));
    } finally {
      setUploadingDocument(false);
    }
  };

  // Resuelve el path real del archivo en Storage.
  const resolveStoragePath = (doc: Document) => {
    return doc.storage_path ?? doc.file_path ?? null;
  };

  // Genera URL firmada y abre el documento.
  const handleOpenDocument = async (doc: Document) => {
    try {
      setOpeningDocumentId(doc.id);
      const path = await resolveStoragePath(doc);

      if (!path) {
        Alert.alert(t('common.error'), t('shipmentDetail.documentPathError'));
        return;
      }

      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(path, 60 * 30);

      if (error || !data?.signedUrl) {
        throw error || new Error(t('shipmentDetail.openError'));
      }

      const canOpen = await Linking.canOpenURL(data.signedUrl);
      if (!canOpen) {
        throw new Error(t('shipmentDetail.cannotOpenDocument'));
      }

      await Linking.openURL(data.signedUrl);
    } catch (error) {
      console.error('Error abriendo documento:', error);
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('shipmentDetail.openError'));
    } finally {
      setOpeningDocumentId(null);
    }
  };

  // Navegacion segura al listado principal.
  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!shipment) {
    return (
      <View style={styles.center}>
        <Text>{t('shipmentDetail.notFound')}</Text>
      </View>
    );
  }

  const visibleUpdates = updates.filter((update) =>
    Boolean(update.status || update.location || update.observation),
  );

  const documentaryCutoff = shipment.documentary_cutoff
    ? Number.isNaN(Date.parse(shipment.documentary_cutoff))
      ? shipment.documentary_cutoff
      : new Date(shipment.documentary_cutoff).toLocaleString()
    : '';

  const bookingStatusValue = shipment.booking_status?.toLowerCase() ?? '';
  const inspectionStatusValue = shipment.inspection_status?.toLowerCase() ?? '';
  const showBookingStatus = Boolean(bookingStatusValue && bookingStatusValue !== 'pending');
  const showInspectionStatus = Boolean(inspectionStatusValue && inspectionStatusValue !== 'none');
  const bookingStatusLabel = showBookingStatus
    ? t(`shipmentForm.options.bookingStatus.${bookingStatusValue}`, { defaultValue: shipment.booking_status ?? '' })
    : '';
  const inspectionStatusLabel = showInspectionStatus
    ? t(`shipmentForm.options.inspectionStatus.${inspectionStatusValue}`, { defaultValue: shipment.inspection_status ?? '' })
    : '';

  const shipmentTypeKeyMap: Record<string, string> = {
    Aereo: 'air',
    Maritimo: 'sea',
    Terrestre: 'land',
  };
  const shipmentTypeKey = shipment.shipment_type ? shipmentTypeKeyMap[shipment.shipment_type] : '';
  const shipmentTypeLabel = shipmentTypeKey
    ? t(`shipmentForm.options.shipmentType.${shipmentTypeKey}`, { defaultValue: shipment.shipment_type })
    : shipment.shipment_type;
  const cargoTypeValue = shipment.cargo_type?.toLowerCase() ?? '';
  const cargoTypeLabel = cargoTypeValue
    ? t(`shipmentForm.options.cargoType.${cargoTypeValue}`, { defaultValue: shipment.cargo_type ?? '' })
    : '';

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
        <Text style={styles.headerTitle}>{t('shipmentDetail.headerTitle')}</Text>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={backFunction}>
            <Text style={styles.topActionText}>{t('common.back')}</Text>
          </TouchableOpacity>
          {isInternal && (
            <>
              <TouchableOpacity onPress={() => router.push(`/editShipment/${id}`)}>
                <Text style={styles.topActionText}>{t('shipmentDetail.edit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeactive} disabled={deletingShipment}>
                <Text
                  style={[
                    styles.topActionText,
                    styles.deleteText,
                    deletingShipment && styles.disabledText,
                  ]}
                >
                  {deletingShipment ? t('shipmentDetail.deleting') : t('shipmentDetail.deleteShipment')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('shipmentDetail.sectionInfo')}</Text>
          <InfoRow label={t('shipmentDetail.labels.doNumber')} value={shipment.do_number} />
          {shipment.tracking_number && (
            <InfoRow label={t('shipmentDetail.labels.trackingNumber')} value={shipment.tracking_number} />
          )}
          <InfoRow label={t('shipmentDetail.labels.via')} value={shipmentTypeLabel} />
          <InfoRow label={t('shipmentDetail.labels.origin')} value={shipment.origin} />
          <InfoRow label={t('shipmentDetail.labels.destination')} value={shipment.destination} />
          <InfoRow label={t('shipmentDetail.labels.etd')} value={shipment.etd || ''} />
          <InfoRow label={t('shipmentDetail.labels.eta')} value={shipment.eta || ''} />
          {documentaryCutoff && (
            <InfoRow label={t('shipmentDetail.labels.documentaryCutoff')} value={documentaryCutoff} />
          )}
          {shipment.incoterm && <InfoRow label={t('shipmentDetail.labels.incoterm')} value={shipment.incoterm} />}
          {cargoTypeLabel && <InfoRow label={t('shipmentDetail.labels.cargoType')} value={cargoTypeLabel} />}
          {shipment.free_days !== null && shipment.free_days !== undefined && (
            <InfoRow label={t('shipmentDetail.labels.freeDays')} value={String(shipment.free_days)} />
          )}
          {showBookingStatus && (
            <InfoRow label={t('shipmentDetail.labels.bookingStatus')} value={bookingStatusLabel} />
          )}
          {showInspectionStatus && (
            <InfoRow label={t('shipmentDetail.labels.inspectionStatus')} value={inspectionStatusLabel} />
          )}
          <InfoRow label={t('shipmentDetail.labels.status')} value={shipment.current_status || ''} />
          <InfoRow label={t('shipmentDetail.labels.location')} value={shipment.current_location || ''} />
          <InfoRow label={t('shipmentDetail.labels.exporter')} value={shipment.exporter || ''} />
          <InfoRow label={t('shipmentDetail.labels.consignee')} value={shipment.consignee || ''} />
          {shipment.air_waybill && <InfoRow label={t('shipmentDetail.labels.awb')} value={shipment.air_waybill} />}
          {shipment.flight_vessel && <InfoRow label={t('shipmentDetail.labels.flight')} value={shipment.flight_vessel} />}
          {shipment.container_number && <InfoRow label={t('shipmentDetail.labels.container')} value={shipment.container_number} />}
          {shipment.carrier && <InfoRow label={t('shipmentDetail.labels.carrier')} value={shipment.carrier} />}
        </View>

        {visibleUpdates.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('shipmentDetail.sectionUpdates')}</Text>
            {visibleUpdates.map((update) => (
              <View key={update.id} style={styles.updateCard}>
                <Text style={styles.updateDate}>{new Date(update.created_at).toLocaleDateString()}</Text>
                {update.status && <Text style={styles.updateStatus}>{update.status}</Text>}
                {update.location && <Text style={styles.updateLocation}>{update.location}</Text>}
                {update.observation && <Text style={styles.updateObs}>{update.observation}</Text>}
              </View>
            ))}
          </View>
        )}

        {documents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('shipmentDetail.sectionDocuments')}</Text>
            {documents.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={styles.docCard}
                onPress={() => handleOpenDocument(doc)}
                disabled={openingDocumentId === doc.id}
              >
                <Text style={styles.docName}>{doc.file_name}</Text>
                <Text style={styles.docSize}>
                  {openingDocumentId === doc.id ? t('shipmentDetail.opening') : `${(doc.file_size / 1024).toFixed(2)} KB`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {isInternal && (
          <>
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.uploadButton, uploadingDocument && styles.uploadButtonDisabled]}
                onPress={handleUploadDocument}
                disabled={uploadingDocument}
              >
                <Text style={styles.uploadButtonText}>
                  {uploadingDocument ? t('shipmentDetail.uploading') : t('shipmentDetail.uploadDocument')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
};

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
  background: { width: '100%', height: '100%' },
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { zIndex: 1, paddingBottom: 20, paddingTop: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  topActions: {
    position: 'absolute',
    right: 16,
    top: 25,
    flexDirection: 'row',
    gap: 8,
  },
  topActionText: { color: '#1B2A3A', fontSize: 16, fontWeight: '600', padding: 6, includeFontPadding: false },
  section: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 15,
    borderRadius: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: { width: 140, fontWeight: '600', color: '#666' },
  infoValue: { flex: 1, color: '#333' },
  updateCard: {
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    marginBottom: 10,
  },
  updateDate: { fontSize: 12, color: '#999', marginBottom: 5 },
  updateStatus: { fontWeight: '600', marginBottom: 3 },
  updateLocation: { color: '#666', marginBottom: 3 },
  updateObs: { color: '#333' },
  docCard: {
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    marginBottom: 8,
  },
  docName: { fontWeight: '600', marginBottom: 4 },
  docSize: { fontSize: 12, color: '#999' },
  uploadButton: {
    backgroundColor: COLORS.blue,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: COLORS.cream,
    fontWeight: '700',
  },
  deleteText: { color: '#9F1D20' },
  disabledText: { opacity: 0.6 },
});
