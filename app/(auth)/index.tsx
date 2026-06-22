// Archivo: app/(auth)/index.tsx

import { RouteProgress } from '@/components/common/Progressbar';
import { QuickActionsPanel } from '@/components/QuickActionsPanel';
import { useSelectedShipments } from '@/hooks/useSelectedShipments';
import i18n, { setAppLanguage } from '@/i18n';
import * as types from '@/lib/shipmentType';
import { formatDateDisplay, formatDateTimeDisplay } from '@/utils/dateFormatting';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { AUTH_MOBILE_DOCK_PADDING } from '../../components/auth/AuthNavigation';
import { ShipmentTransportBadge } from '../../components/auth/ShipmentTransportIcon';
import Header from '../../components/Header';
import { ShipmentFiltersPanel } from '../../components/ShipmentFiltesPanel';
import { ShipmentSwitchCard } from '../../components/ShipmentSwitchCard';
import { COLORS } from '../../components/ui/COLORS';
import { useDashboardShipments } from '../../hooks/useDashboardShipments';
import { useResponsive } from '../../hooks/useResponsive';
import { useSelectedShipmentDocuments } from '../../hooks/useSelectedShipmentDocuments';
import { useShipmentFilters } from '../../hooks/useShipmentFilters';
import { useWebNotifications } from '../../hooks/useWebNotifications';
import { supabase } from '../../lib/URLs';
export default function Dashboard() {
  const { t } = useTranslation();
  const { isDesktop, height, width } = useResponsive();
  const desktopListMaxHeight = Math.max(320, Math.min(560, height - 240));
  const {
    searchQuery,
    setSearchQuery,
    baseVisibleShipments,
    loading,
    searching,
    userId,
    isInternal,
    searchShipment,
  } = useDashboardShipments();
  const {
    filters,
    filtersOpen,
    visibleShipments,
    activeFilterCount,
    updateFilter,
    resetFilters,
    toggleFiltersOpen,
  } = useShipmentFilters(baseVisibleShipments);
  const { 
    selectedShipmentId, 
    selectedShipment,
    selectShipment
  } = useSelectedShipments(visibleShipments);
  const { 
    documents, 
    detailLoading 
  } = useSelectedShipmentDocuments({
    selectedShipmentId, 
    isInternal, 
    userId
  });

  const { webNotificationPermission, 
    handleEnableWebNotifications 
  } = useWebNotifications();
  const toggleLanguage = async () => {
    const next = i18n.language === 'es' ? 'en' : 'es';
    await setAppLanguage(next as 'es' | 'en');
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };
  
  const statusTone = getStatusTone(selectedShipment?.current_status);
  const shipmentTypeLabel = getShipmentTypeLabel(selectedShipment, t);
  const desktopMeta = buildShipmentMeta(selectedShipment, shipmentTypeLabel, t);
  const canRequestWebNotifications =
    Platform.OS === 'web' && Boolean(userId) && webNotificationPermission === 'default';
    
  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.orange} />
      </View>
    );
  }
  console.log('DEBUG isDesktop:', isDesktop, 'width:', width);

  return (
    <View style={[styles.container, { minHeight: height }]}>
      <View style={styles.backgroundBase} />
      <View style={styles.backgroundGlowOne} />
      <View style={styles.backgroundGlowTwo} />
      <Header
        isDesktop={isDesktop}
        searchQuery={searchQuery}
        searching={searching}
        isInternal={isInternal}
        selectedShipment={selectedShipment}
        selectedShipmentId={selectedShipment?.id}
        canRequestWebNotifications={canRequestWebNotifications}
        onSearchChange={setSearchQuery} 
        onSubmitSearch={searchShipment}
        onEnableNotifications={handleEnableWebNotifications}
        onToggleLanguage={toggleLanguage}
        onLogout={handleLogout}
        showNews={true}
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
        <ShipmentFiltersPanel
          filters={filters}
          filtersOpen={filtersOpen}
          activeFilterCount={activeFilterCount}
          totalCount={baseVisibleShipments.length}
          visibleCount={visibleShipments.length}
          isDesktop={isDesktop}
          t={t}
          onToggleOpen={toggleFiltersOpen}
          onChangeFilter={updateFilter}
          onResetFilters={resetFilters}
        />

        {!visibleShipments.length ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={34} color={COLORS.secondaryText} />
            <Text style={styles.emptyTitle}>
              {activeFilterCount
                ? t('dashboard.filters.emptyTitle', { defaultValue: 'No hay cargas con estos filtros' })
                : searchQuery.trim()
                  ? t('dashboard.noShipmentsFound')
                  : t('dashboard.noShipmentsAvailable')}
            </Text>
            <Text style={styles.emptySubtitle}>{t('dashboard.emptyStateSubtitle')}</Text>
            {activeFilterCount ? (
              <TouchableOpacity style={styles.emptyResetButton} onPress={resetFilters}>
                <Ionicons name="refresh-outline" size={16} color={COLORS.primaryText} />
                <Text style={styles.emptyResetText}>
                  {t('dashboard.filters.clear', { defaultValue: 'Limpiar filtros' })}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <>
            {!isDesktop ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.shipmentRail, { flexGrow: 1 }]}
              >
                {visibleShipments.map((item) => {
                  return (
                    <ShipmentSwitchCard
                      key={item.id}
                      shipment={item}
                      selected={item.id === selectedShipment?.id}
                      desktop={isDesktop}
                      onPress={() => selectShipment(item.id)}
                    />
                  );
                })}
              </ScrollView>
            ) : null}

            {selectedShipment ? (
              isDesktop ? (
                <View style={styles.desktopGrid}>
                  <View style={styles.desktopListColumn}>
                    <View style={styles.shadowCard}>
                      <ScrollView
                        style={[styles.desktopShipmentScroll, { maxHeight: desktopListMaxHeight }]}
                        contentContainerStyle={styles.desktopShipmentList}
                        showsVerticalScrollIndicator={false}
                      >
                        {visibleShipments.map((item) => {
                          return (
                            <ShipmentSwitchCard
                              key={item.id}
                              shipment={item}
                              selected={item.id === selectedShipment?.id}
                              desktop={isDesktop}
                              onPress={() => selectShipment(item.id)}
                            />
                          );
                        })}
                      </ScrollView>
                    </View>
                  </View>

                  <View style={styles.desktopMainColumn}>
                    <View style={[styles.desktopHeroCard, styles.shadowCard]}>
                      <View style={styles.desktopHeroTop}>
                        <View style={styles.desktopHeroCopy}>
                          <Text style={styles.desktopHeroTitle}>{selectedShipment.do_number}</Text>
                          <Text style={styles.desktopHeroMeta}>{desktopMeta}</Text>
                          <Text style={styles.desktopHeroMeta}>
                            {selectedShipment.updated_by
                              ?  `${t('common.updatedBy')} ${selectedShipment.updated_by}`
                              :  `${t('common.createdBy')} ${selectedShipment.created_by?? '---'}`
                            }
                          </Text>
                        </View>
                        <View style={styles.heroTopActions}>
                          <View style={[styles.statusPill, { backgroundColor: statusTone.pillBackground }]}>
                            <Text style={[styles.statusPillText, { color: statusTone.pillText }]}>
                              {selectedShipment.current_status || t('dashboard.pendingLabel')}
                            </Text>
                          </View>
                          <ShipmentTransportBadge
                            shipment={selectedShipment}
                            shipmentType={selectedShipment.shipment_type}
                            color={COLORS.primaryText}
                            size={20}
                            containerStyle={styles.heroTransportBadge}
                          />
                        </View>
                      </View>

                      <View style={styles.desktopRouteCard}>
                        <View style={styles.desktopRouteLabels}>
                          <View>
                            <Text style={styles.routeCode}>{selectedShipment.origin}</Text>
                          </View>
                          <View style={styles.routeEndBlock}>
                            <Text style={styles.routeCode}>{selectedShipment.destination}</Text>
                          </View>
                        </View>
                        <RouteProgress
                          toneColor={statusTone.progress}
                          shipment={selectedShipment}
                        />
                      </View>
                    </View>
                    <QuickActionsPanel 
                      isInternal={isInternal} 
                      selectedShipment={selectedShipment} 
                    />
                  </View>

                  <View style={styles.desktopSideColumn}>
                    <View style={[styles.infoCard, styles.shadowCard]}>
                      <Text style={styles.infoSectionTitle}>{t('shipmentDetail.header')}</Text>
                      <InfoLine label={t('shipmentDetail.labels.carrier')} value={selectedShipment.carrier || t('dashboard.notAvailable')} />
                      <InfoLine label={t('shipmentDetail.labels.flight')} value={selectedShipment.flight_vessel || t('dashboard.notAvailable')} />
                      <InfoLine label={t('shipmentDetail.labels.eta')} value={formatDateTimeDisplay(selectedShipment.eta, i18n.language === 'es' ? 'es-CO' : 'en-US')} />
                      <InfoLine label={t('shipmentDetail.labels.ata')} value={selectedShipment.ata ? formatDateTimeDisplay(selectedShipment.ata, i18n.language === 'es' ? 'es-CO' : 'en-US') : t('dashboard.notAvailable')} />
                      <InfoLine label={t('shipmentDetail.labels.incoterm')} value={selectedShipment.incoterm || t('dashboard.notAvailable')} />
                    </View>

                    <View style={[styles.infoCard, styles.shadowCard]}>
                      <View style={styles.sectionHeader}>
                        <Text style={styles.infoSectionTitle}>{t('shipmentDetail.sectionDocuments')}</Text>
                        {detailLoading ? <ActivityIndicator size="small" color={COLORS.orange} /> : null}
                      </View>
                      {documents.length ? (
                        <View style={styles.documentList}>
                          {documents.slice(0, 4).map((document) => (
                            <View key={document.id} style={styles.documentRow}>
                              <View style={styles.documentIconWrap}>
                                <Ionicons name="document-text-outline" size={18} color={COLORS.blue} />
                              </View>
                              <View style={styles.documentCopy}>
                                <Text style={styles.documentName} numberOfLines={1}>{document.file_name}</Text>
                                <Text style={styles.documentMeta}>{formatDocumentSize(document.file_size)}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.emptyCardText}>{t('dashboard.emptyDocuments')}</Text>
                      )}
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.mobileStack}>
                  <View style={[styles.mobileHeroCard, styles.shadowCard]}>
                    <View style={styles.mobileHeroTop}>
                      <View style={styles.mobileHeroCopy}>
                        <Text style={styles.mobileHeroTitle}>{selectedShipment.do_number}</Text>
                        <Text style={styles.mobileHeroMeta}>
                          {shipmentTypeLabel || t('dashboard.pendingLabel')}
                          {selectedShipment.incoterm ? ` · ${selectedShipment.incoterm}` : ''}
                        </Text> 
                        <Text style = {styles.mobileHeroMeta}>
                          {selectedShipment.updated_by
                            ?  `${t('common.updatedBy')} ${selectedShipment.updated_by}`
                            :  `${t('common.createdBy')} ${selectedShipment.created_by?? '---'}`
                          }
                        </Text>
                      </View>

                      <View style={[styles.heroTopActions, styles.heroTopActionsMobile]}>
                        <View style={[styles.statusPill, { backgroundColor: statusTone.pillBackground }]}>
                          <Text style={[styles.statusPillText, { color: statusTone.pillText }]}>
                            {selectedShipment.current_status || t('dashboard.pendingLabel')}
                          </Text>
                        </View>
                        <ShipmentTransportBadge
                          shipment={selectedShipment}
                          shipmentType={selectedShipment.shipment_type}
                          color={COLORS.primaryText}
                          size={20}
                          containerStyle={styles.heroTransportBadge}
                        />
                      </View>
                    </View>

                    <View style={styles.mobileRouteCard}>
                      <View style={styles.mobileRouteLabels}>
                        <View style={styles.mobileRouteBlock}>
                          <Text style={styles.routeCode}>{selectedShipment.origin}</Text>
                          <Text style={styles.routeDate}>{formatDateDisplay(selectedShipment.atd ?? selectedShipment.etd, i18n.language === 'es' ? 'es-CO' : 'en-US')}</Text>
                        </View>
                        <View style={[styles.mobileRouteBlock, styles.mobileRouteBlockEnd]}>
                          <Text style={styles.routeCode}>{selectedShipment.destination}</Text>
                          <Text style={styles.routeDate}>{formatDateDisplay(selectedShipment.ata ?? selectedShipment.eta, i18n.language === 'es' ? 'es-CO' : 'en-US')}</Text>
                        </View>
                      </View>
                      <RouteProgress
                        toneColor={statusTone.progress}
                        shipment={selectedShipment}
                      />
                    </View>
                  </View>

                  {documents.length ? (
                    <View style={[styles.sectionCard, styles.shadowCard]}>
                      <Text style={styles.sectionTitle}>{t('shipmentDetail.sectionDocuments')}</Text>
                      <View style={styles.documentList}>
                        {documents.slice(0, 3).map((document) => (
                          <View key={document.id} style={styles.documentRow}>
                            <View style={styles.documentIconWrap}>
                              <Ionicons name="document-text-outline" size={18} color={COLORS.blue} />
                            </View>
                            <View style={styles.documentCopy}>
                              <Text style={styles.documentName} numberOfLines={1}>{document.file_name}</Text>
                              <Text style={styles.documentMeta}>{formatDocumentSize(document.file_size)}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              )
            ) : null}
          </>
        )}
      </ScrollView>

    </View>
  );
}

type InfoLineProps = { label: string; value: string };

function InfoLine({ label, value }: InfoLineProps) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLineLabel}>{label}</Text>
      <Text style={styles.infoLineValue}>{value}</Text>
    </View>
  );
}





function getShipmentTypeLabel(
  shipment: types.ShipmentListItem | null | undefined,
  t: ReturnType<typeof useTranslation>['t'],
) {
  const inferredType = types.inferShipmentType(shipment ?? {});
  const labelKey = types.getShipmentTypeLabelKey(inferredType || shipment?.shipment_type || '');
  return labelKey ? t(labelKey, { defaultValue: shipment?.shipment_type ?? '' }) : (shipment?.shipment_type ?? '');
}
const string_ = "Hola"
console.log (typeof string_)
function buildShipmentMeta(
  shipment: types.ShipmentListItem | null,
  shipmentTypeLabel: string,
  t: ReturnType<typeof useTranslation>['t'],
) {
  if (!shipment) return '';
  const parts = [formatDateTimeDisplay(shipment.created_at, i18n.language === 'es' ? 'es-CO' : 'en-US')];
  if (shipmentTypeLabel) parts.push(shipmentTypeLabel);
  if (shipment.incoterm) parts.push(shipment.incoterm);
  if (!shipmentTypeLabel && !shipment.incoterm) parts.push(t('dashboard.pendingLabel'));
  return parts.filter(Boolean).join(' · ');
}


function getStatusTone(status: string | null | undefined) {
  const s = (status ?? '').toLowerCase();
  if (s.includes('entreg') || s.includes('recibid') || s.includes('origin')) {
    return { pillBackground: COLORS.greenSoft, pillText: COLORS.green, progress: COLORS.green };
  }
  if (s.includes('pending') || s.includes('waiting') || s.includes('program')) {
    return { pillBackground: COLORS.blueSoft, pillText: COLORS.blue, progress: COLORS.blue };
  }
  return { pillBackground: COLORS.orangeSoft, pillText: COLORS.orange, progress: COLORS.orange };
}

function formatDocumentSize(fileSize: number) {
  if (!fileSize) return '0 KB';
  return `${(fileSize / 1024).toFixed(1)} KB`;
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundBottom, overflow: 'hidden' },
  backgroundBase: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.backgroundBottom },
  backgroundGlowOne: { position: 'absolute', top: -120, left: -50, width: 260, height: 260, borderRadius: 999, backgroundColor: 'rgba(199, 138, 75, 0.18)' },
  backgroundGlowTwo: { position: 'absolute', top: 40, right: -70, width: 280, height: 280, borderRadius: 999, backgroundColor: 'rgba(79, 104, 142, 0.18)' },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.backgroundBottom },
  headerActionsMobile: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' },
  scroll: { flex: 1 },
  content: { gap: 18 },
  contentDesktop: { paddingHorizontal: 28, paddingTop: 24, paddingBottom: 28 },
  contentMobile: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 28 },
  contentWithDock: { paddingBottom: AUTH_MOBILE_DOCK_PADDING },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6 },
  statusRowText: { color: COLORS.surface, fontSize: 14 },
  emptyState: { marginTop: 30, paddingVertical: 34, paddingHorizontal: 20, borderRadius: 24, backgroundColor: COLORS.surfaceSoft, alignItems: 'center', gap: 10 },
  emptyTitle: { color: COLORS.primaryText, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptySubtitle: { color: COLORS.secondaryText, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyResetButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: 14, backgroundColor: COLORS.orangeSoft, borderWidth: 1, borderColor: COLORS.orangeBorder, flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyResetText: { color: COLORS.primaryText, fontSize: 13, fontWeight: '800' },
  shipmentRail: { gap: 12, paddingRight: 10 },
  desktopGrid: { flexDirection: 'row', gap: 18, alignItems: 'flex-start' },
  desktopListColumn: { width: 236, flexShrink: 0 },
  desktopShipmentScroll: { flexGrow: 0 },
  desktopShipmentList: { gap: 10 },
  desktopMainColumn: { flex: 1.5, gap: 18 },
  desktopSideColumn: { flex: 1, gap: 18 },
  mobileStack: { gap: 16 },
  desktopHeroCard: { backgroundColor: COLORS.surface, borderRadius: 28, padding: 22, gap: 18 },
  desktopHeroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  desktopHeroCopy: { flex: 1 },
  desktopHeroTitle: { color: COLORS.primaryText, fontSize: 34, fontWeight: '800' },
  desktopHeroMeta: { color: COLORS.secondaryText, fontSize: 14, marginTop: 4 },
  desktopRouteCard: { padding: 18, borderRadius: 22, backgroundColor: COLORS.backgroundTop, gap: 18 },
  desktopRouteLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  routeEndBlock: { alignItems: 'flex-end' },
  mobileHeroCard: { backgroundColor: COLORS.surface, borderRadius: 24, padding: 16, gap: 14 },
  mobileHeroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  mobileHeroCopy: { flex: 1, minWidth: 0 },
  mobileHeroTitle: { color: COLORS.primaryText, fontSize: 28, fontWeight: '800' },
  mobileHeroMeta: { color: COLORS.secondaryText, fontSize: 13, marginTop: 4, flexDirection: 'row', flexWrap: 'wrap' },
  heroTopActions: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 8, flexShrink: 0, flexWrap: 'wrap' },
  heroTopActionsMobile: { flexShrink: 1, justifyContent: 'flex-start' },
  heroTransportBadge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.orangeSoft, borderWidth: 1, borderColor: COLORS.orangeBorder },
  mobileRouteCard: { padding: 14, borderRadius: 20, backgroundColor: COLORS.backgroundTop, gap: 14 },
  mobileRouteLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  mobileRouteBlock: { flex: 1 },
  mobileRouteBlockEnd: { alignItems: 'flex-end' },
  statusPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, alignSelf: 'flex-start' },
  statusPillText: { fontSize: 12, fontWeight: '800' },
  routeCode: { color: COLORS.surface, fontSize: 15, fontWeight: '800' },
  routeDate: { color: 'rgba(245, 241, 234, 0.68)', fontSize: 12, marginTop: 4 },
  sectionCard: { backgroundColor: COLORS.surface, borderRadius: 24, padding: 18, gap: 14 },
  shadowCard: { shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 1, shadowRadius: 22, elevation: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: COLORS.primaryText, fontSize: 18, fontWeight: '800' },
  infoCard: { backgroundColor: COLORS.surface, borderRadius: 24, padding: 18, gap: 14 },
  infoSectionTitle: { color: COLORS.primaryText, fontSize: 16, fontWeight: '800' },
  infoLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  infoLineLabel: { flex: 1, color: COLORS.secondaryText, fontSize: 12, fontWeight: '700' },
  infoLineValue: { flex: 1, color: COLORS.primaryText, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  documentList: { gap: 12 },
  documentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.line },
  documentIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.blueSoft },
  documentCopy: { flex: 1 },
  documentName: { color: COLORS.primaryText, fontSize: 13, fontWeight: '700' },
  documentMeta: { color: COLORS.secondaryText, fontSize: 12, marginTop: 2 },
  emptyCardText: { color: COLORS.secondaryText, fontSize: 14, lineHeight: 20 },
}); 