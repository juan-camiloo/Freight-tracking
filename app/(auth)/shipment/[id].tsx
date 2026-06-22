// Archivo: app/(auth)/shipment/[id].tsx
// Descripcion: Pantalla de detalle de carga. Muestra informacion, historial, documentos y permite subir/abrir documentos.

import { AUTH_MOBILE_DOCK_PADDING } from '@/components/auth/AuthNavigation';
import { ShipmentTransportBadge } from '@/components/auth/ShipmentTransportIcon';
import { useNativeNotification } from '@/components/ui/NativeNotification';
import * as types from '@/lib/shipmentType';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AUTH_COLORS, AUTH_SHADOW, AuthHeader, AuthHeaderAction, AuthScreenBackground } from '../../../components/auth/AuthChrome';
import { RouteProgress } from '../../../components/common/Progressbar';
import { useResponsive } from '../../../hooks/useResponsive';
import { supabase } from '../../../lib/URLs';
import { formatDateDisplay, formatDateTimeDisplay } from '../../../utils/dateFormatting';
type Shipment = {
  id: string;
  do_number: string;
  shipment_type: string;
  origin: string;
  destination: string;
  etd: string | null;
  eta: string | null;
  atd?: string | null;
  ata?: string | null;
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

type DocumentRecord = {
  id: string;
  shipment_id: string;
  file_name: string;
  file_size: number;
  file_path?: string | null;
  storage_path?: string | null;
};

export default function ShipmentDetail() {
  const { t, i18n } = useTranslation();
  const notification = useNativeNotification();
  const { id } = useLocalSearchParams();
  const { height, isDesktop } = useResponsive();

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [updates, setUpdates] = useState<ShipmentUpdate[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const [deletingShipment, setDeletingShipment] = useState(false);
  const [isInternal, setIsInternal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    void loadShipmentDetails();
  }, [id]);

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
    } catch {
      notification.error(t('shipmentDetail.loadError'));
    } finally {
      setLoading(false);
    }
  };
  const handleDeactive = async () => {
    if (!isInternal) {
      notification.error(t('shipmentDetail.internalDeleteOnly'));
      return;
    }

    const shipmentId = String(id ?? '');
    if (!shipmentId) {
      notification.error(t('shipmentDetail.invalidShipmentId'));
      return;
    }

    const confirmed = await notification.confirm({
      title: t('common.delete'),
      message: t('shipmentDetail.deleteConfirm'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });

    if (!confirmed) return;

    setDeletingShipment(true);
    try {
      const { error: deactiveError } = await supabase
        .from('shipments')
        .update({ status: 'inactive' })
        .eq('id', shipmentId);

      if (deactiveError) {
        throw deactiveError;
      }

      notification.success(t('shipmentDetail.deactivatedOk'));
      router.replace('/');
    } catch {
      notification.error(t('shipmentDetail.deactivateError'));
    } finally {
      setDeletingShipment(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!isInternal) {
      notification.error(t('shipmentDetail.internalUploadOnly'));
      return;
    }

    const shipmentId = String(id ?? '');
    if (!shipmentId) {
      notification.error(t('shipmentDetail.invalidShipmentId'));
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
          await supabase.storage.from('documents').remove([uploaded.path]);
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

      notification.success(t('shipmentDetail.uploadOk'));
    } catch (error) {
      notification.error(error instanceof Error ? error.message : t('shipmentDetail.uploadError'));
    } finally {
      setUploadingDocument(false);
    }
  };

  const resolveStoragePath = (doc: DocumentRecord) => {
    return doc.storage_path ?? doc.file_path ?? null;
  };

  const handleOpenDocument = async (doc: DocumentRecord) => {
    try {
      setOpeningDocumentId(doc.id);
      const path = await resolveStoragePath(doc);

      if (!path) {
        notification.error(t('shipmentDetail.documentPathError'));
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
      notification.error(error instanceof Error ? error.message : t('shipmentDetail.openError'));
    } finally {
      setOpeningDocumentId(null);
    }
  };

  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, styles.container]}>
        <AuthScreenBackground />
        <ActivityIndicator size="large" color={AUTH_COLORS.orange} />
      </View>
    );
  }

  if (!shipment) {
    return (
      <View style={[styles.center, styles.container]}>
        <AuthScreenBackground />
        <Text style={styles.emptyScreenText}>{t('shipmentDetail.notFound')}</Text>
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

  const shipmentTypeLabelKey = types.getShipmentTypeLabelKey(shipment.shipment_type);
  const shipmentTypeLabel = shipmentTypeLabelKey
    ? t(shipmentTypeLabelKey, { defaultValue: shipment.shipment_type ?? '' })
    : shipment.shipment_type ?? '';
  const cargoTypeValue = shipment.cargo_type?.toLowerCase() ?? '';
  const cargoTypeLabel = cargoTypeValue
    ? t(`shipmentForm.options.cargoType.${cargoTypeValue}`, { defaultValue: shipment.cargo_type ?? '' })
    : '';
  const statusTone = getStatusTone(shipment.current_status);

  return (
    <View style={[styles.container, { minHeight: height }]}>
      <AuthScreenBackground />
      <AuthHeader
        title={t('shipmentDetail.headerTitle')}
        isDesktop={isDesktop}
        actions={<AuthHeaderAction label={t('common.back')} icon="arrow-back-outline" onPress={backFunction} />}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          isDesktop ? styles.contentDesktop : styles.contentMobile,
          !isDesktop && styles.contentWithDock,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroCard, styles.shadowCard, !isDesktop && styles.heroCardMobile]}>
          <View style={[styles.heroTop, !isDesktop && styles.heroTopMobile]}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{shipment.do_number}</Text>
              <Text style={styles.heroMeta}>
                {[shipmentTypeLabel, shipment.incoterm].filter(Boolean).join(' · ') || t('shipmentDetail.sectionInfo')}
              </Text>
            </View>
            <View style={[styles.heroTopActions, !isDesktop && styles.heroTopActionsMobile]}>
              <View style={[styles.statusPill, { backgroundColor: statusTone.pillBackground }]}>
                <Text style={[styles.statusPillText, { color: statusTone.pillText }]}>
                  {shipment.current_status || t('dashboard.pendingLabel')}
                </Text>
              </View>
              <ShipmentTransportBadge
                shipment={shipment}
                shipmentType={shipment.shipment_type}
                color={AUTH_COLORS.primaryText}
                size={20}
                containerStyle={styles.heroTransportBadge}
              />
            </View>
          </View>

          <View style={styles.routeCard}>
            <View style={styles.routeLabels}>
              <View>
                <Text style={styles.routeCode}>{shipment.origin}</Text>
                <Text style={styles.routeDate}>{formatDateDisplay(shipment.atd ?? shipment.etd, i18n.language === 'es' ? 'es-CO' : 'en-US')}</Text>
              </View>
              <View style={styles.routeEndBlock}>
                <Text style={styles.routeCode}>{shipment.destination}</Text>
                <Text style={styles.routeDate}>{formatDateDisplay(shipment.ata ?? shipment.eta, i18n.language === 'es' ? 'es-CO' : 'en-US')}</Text>
              </View>
            </View>
            <RouteProgress toneColor={statusTone.progress} shipment={shipment} />
          </View>

          {isInternal ? (
            <View style={[styles.actionRow, !isDesktop && styles.actionRowMobile]}>
              <QuickActionButton
                label={t('shipmentDetail.edit')}
                icon="create-outline"
                onPress={() => router.push(`/editShipment/${id}`)}
                fullWidth={!isDesktop}
              />
              <QuickActionButton
                label={uploadingDocument ? t('shipmentDetail.uploading') : t('shipmentDetail.uploadDocument')}
                icon="cloud-upload-outline"
                onPress={handleUploadDocument}
                disabled={uploadingDocument}
                fullWidth={!isDesktop}
              />
              <QuickActionButton
                label={deletingShipment ? t('shipmentDetail.deleting') : t('shipmentDetail.deleteShipment')}
                icon="trash-outline"
                onPress={handleDeactive}
                disabled={deletingShipment}
                danger
                fullWidth={!isDesktop}
              />
            </View>
          ) : null}
        </View>

        <View style={[styles.grid, isDesktop && styles.gridDesktop]}>
          <View style={styles.mainColumn}>
            <View style={[styles.sectionCard, styles.shadowCard]}>
              <Text style={styles.sectionTitle}>{t('shipmentDetail.sectionInfo')}</Text>
              <InfoRow label={t('shipmentDetail.labels.doNumber')} value={shipment.do_number} />
              <InfoRow label={t('shipmentDetail.labels.via')} value={shipmentTypeLabel} />
              <InfoRow label={t('shipmentDetail.labels.origin')} value={shipment.origin} />
              <InfoRow label={t('shipmentDetail.labels.destination')} value={shipment.destination} />
              <InfoRow label={t('shipmentDetail.labels.etd')} value={shipment.etd || ''} />
              {shipment.atd ? (
                <InfoRow label={t('shipmentDetail.labels.atd')} value={formatDateTimeDisplay(shipment.atd, i18n.language === 'es' ? 'es-CO' : 'en-US')} />
              ) : null}
              <InfoRow label={t('shipmentDetail.labels.eta')} value={shipment.eta || ''} />
              {shipment.ata ? (
                <InfoRow label={t('shipmentDetail.labels.ata')} value={formatDateTimeDisplay(shipment.ata, i18n.language === 'es' ? 'es-CO' : 'en-US')} />
              ) : null}
              {documentaryCutoff ? (
                <InfoRow label={t('shipmentDetail.labels.documentaryCutoff')} value={documentaryCutoff} />
              ) : null}
              {shipment.incoterm ? <InfoRow label={t('shipmentDetail.labels.incoterm')} value={shipment.incoterm} /> : null}
              {cargoTypeLabel ? <InfoRow label={t('shipmentDetail.labels.cargoType')} value={cargoTypeLabel} /> : null}
              {shipment.free_days !== null && shipment.free_days !== undefined ? (
                <InfoRow label={t('shipmentDetail.labels.freeDays')} value={String(shipment.free_days)} />
              ) : null}
              {showBookingStatus ? (
                <InfoRow label={t('shipmentDetail.labels.bookingStatus')} value={bookingStatusLabel} />
              ) : null}
              {showInspectionStatus ? (
                <InfoRow label={t('shipmentDetail.labels.inspectionStatus')} value={inspectionStatusLabel} />
              ) : null}
              <InfoRow label={t('shipmentDetail.labels.status')} value={shipment.current_status || ''} />
              <InfoRow label={t('shipmentDetail.labels.location')} value={shipment.current_location || ''} />
              <InfoRow label={t('shipmentDetail.labels.exporter')} value={shipment.exporter || ''} />
              <InfoRow label={t('shipmentDetail.labels.consignee')} value={shipment.consignee || ''} />
              {shipment.air_waybill ? <InfoRow label={t('shipmentDetail.labels.awb')} value={shipment.air_waybill} /> : null}
              {shipment.flight_vessel ? <InfoRow label={t('shipmentDetail.labels.flight')} value={shipment.flight_vessel} /> : null}
              {shipment.container_number ? <InfoRow label={t('shipmentDetail.labels.container')} value={shipment.container_number} /> : null}
              {shipment.carrier ? <InfoRow label={t('shipmentDetail.labels.carrier')} value={shipment.carrier} /> : null}
            </View>

            <View style={[styles.sectionCard, styles.shadowCard]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('shipmentDetail.sectionUpdates')}</Text>
              </View>
              {visibleUpdates.length > 0 ? (
                <View style={styles.updateList}>
                  {visibleUpdates.map((update) => (
                    <View key={update.id} style={styles.updateCard}>
                      <Text style={styles.updateDate}>{formatDateTimeDisplay(update.created_at, i18n.language === 'es' ? 'es-CO' : 'en-US')}</Text>
                      {update.status ? <Text style={styles.updateStatus}>{update.status}</Text> : null}
                      {update.location ? <Text style={styles.updateMeta}>{update.location}</Text> : null}
                      {update.observation ? <Text style={styles.updateObservation}>{update.observation}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyCardText}>{t('dashboard.emptyUpdates', { defaultValue: 'Aun no hay novedades registradas.' })}</Text>
              )}
            </View>
          </View>

          <View style={styles.sideColumn}>
            <View style={[styles.sectionCard, styles.shadowCard]}>
              <Text style={styles.sectionTitle}>{t('shipmentDetail.sectionDocuments')}</Text>
              {documents.length > 0 ? (
                <View style={styles.documentList}>
                  {documents.map((doc) => (
                    <TouchableOpacity
                      key={doc.id}
                      style={styles.documentRow}
                      onPress={() => handleOpenDocument(doc)}
                      disabled={openingDocumentId === doc.id}
                    >
                      <View style={styles.documentIconWrap}>
                        <Ionicons name="document-text-outline" size={18} color={AUTH_COLORS.blue} />
                      </View>
                      <View style={styles.documentCopy}>
                        <Text style={styles.documentName} numberOfLines={1}>
                          {doc.file_name}
                        </Text>
                        <Text style={styles.documentMeta}>
                          {openingDocumentId === doc.id
                            ? t('shipmentDetail.opening')
                            : formatDocumentSize(doc.file_size)}
                        </Text>
                      </View>
                      <Ionicons name="open-outline" size={18} color={AUTH_COLORS.secondaryText} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyCardText}>{t('dashboard.emptyDocuments')}</Text>
              )}
            </View>

            <View style={[styles.sectionCard, styles.shadowCard]}>
              <Text style={styles.sectionTitle}>{t('shipmentDetail.sectionSummary')}</Text>
              <SummaryLine
                label={t('shipmentDetail.labels.bookingStatus')}
                value={bookingStatusLabel || t('dashboard.notAvailable')}
              />
              <SummaryLine
                label={t('shipmentDetail.labels.inspectionStatus')}
                value={inspectionStatusLabel || t('dashboard.notAvailable')}
              />
              <SummaryLine
                label={t('shipmentDetail.labels.cargoType')}
                value={cargoTypeLabel || t('dashboard.notAvailable')}
              />
            </View>
          </View>
        </View>
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
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

type SummaryLineProps = {
  label: string;
  value: string;
};

function SummaryLine({ label, value }: SummaryLineProps) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

type QuickActionButtonProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  fullWidth?: boolean;
};

function QuickActionButton({ label, icon, onPress, disabled = false, danger = false, fullWidth = false }: QuickActionButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.quickActionButton,
        fullWidth && styles.quickActionButtonFullWidth,
        danger && styles.quickActionButtonDanger,
        disabled && styles.quickActionDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={18} color={danger ? AUTH_COLORS.danger : AUTH_COLORS.primaryText} />
      <Text style={[styles.quickActionLabel, danger && styles.quickActionLabelDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

function getStatusTone(status: string | null | undefined) {
  const s = (status ?? '').toLowerCase();
  if (s.includes('entreg') || s.includes('recibid') || s.includes('origin')) {
    return { pillBackground: AUTH_COLORS.greenSoft, pillText: AUTH_COLORS.green, progress: AUTH_COLORS.green };
  }
  if (s.includes('pending') || s.includes('waiting') || s.includes('program')) {
    return { pillBackground: AUTH_COLORS.blueSoft, pillText: AUTH_COLORS.blue, progress: AUTH_COLORS.blue };
  }
  return { pillBackground: AUTH_COLORS.orangeSoft, pillText: AUTH_COLORS.orange, progress: AUTH_COLORS.orange };
}

// date formatting moved to utils/dateFormatting

function formatDocumentSize(fileSize: number) {
  if (!fileSize) return '0 KB';
  return `${(fileSize / 1024).toFixed(1)} KB`;
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
  emptyScreenText: {
    color: AUTH_COLORS.surface,
    fontSize: 15,
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroTopMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 34,
    fontWeight: '800',
  },
  heroMeta: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 14,
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  heroTopActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  heroTopActionsMobile: {
    justifyContent: 'flex-start',
    flexShrink: 1,
  },
  heroTransportBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
  },
  routeCard: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: AUTH_COLORS.backgroundTop,
    gap: 18,
  },
  routeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  routeEndBlock: {
    alignItems: 'flex-end',
  },
  routeCode: {
    color: AUTH_COLORS.surface,
    fontSize: 15,
    fontWeight: '800',
  },
  routeDate: {
    color: 'rgba(245, 241, 234, 0.68)',
    fontSize: 12,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionRowMobile: {
    flexDirection: 'column',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  quickActionButtonFullWidth: {
    alignSelf: 'stretch',
  },
  quickActionButtonDanger: {
    backgroundColor: AUTH_COLORS.dangerSoft,
    borderColor: 'rgba(161, 71, 79, 0.2)',
  },
  quickActionDisabled: {
    opacity: 0.6,
  },
  quickActionLabel: {
    color: AUTH_COLORS.primaryText,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  quickActionLabelDanger: {
    color: AUTH_COLORS.danger,
  },
  grid: {
    gap: 18,
  },
  gridDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mainColumn: {
    flex: 1.4,
    gap: 18,
  },
  sideColumn: {
    flex: 1,
    gap: 18,
  },
  sectionCard: {
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 24,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 18,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: AUTH_COLORS.line,
  },
  infoLabel: {
    flex: 1,
    color: AUTH_COLORS.secondaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    flex: 1,
    color: AUTH_COLORS.primaryText,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  updateList: {
    gap: 12,
  },
  updateCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    gap: 6,
  },
  updateDate: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  updateStatus: {
    color: AUTH_COLORS.primaryText,
    fontSize: 14,
    fontWeight: '800',
  },
  updateMeta: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
  },
  updateObservation: {
    color: AUTH_COLORS.primaryText,
    fontSize: 13,
    lineHeight: 19,
  },
  documentList: {
    gap: 12,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  documentIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AUTH_COLORS.blueSoft,
  },
  documentCopy: {
    flex: 1,
  },
  documentName: {
    color: AUTH_COLORS.primaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  documentMeta: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  summaryLine: {
    gap: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: AUTH_COLORS.line,
  },
  summaryLabel: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryValue: {
    color: AUTH_COLORS.primaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCardText: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 14,
    lineHeight: 20,
  },
});
