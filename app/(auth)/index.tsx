// Archivo: app/(auth)/index.tsx
// Dashboard principal de "Cómo va mi carga" con diseño responsivo armonizado y proporcional.

import { RouteProgress } from '@/components/common/Progressbar';
import { useSelectedShipments } from '@/hooks/useSelectedShipments';
import i18n, { setAppLanguage } from '@/i18n';
import * as types from '@/lib/shipmentType';
import { formatDateDisplay, formatDateTimeDisplay } from '@/utils/dateFormatting';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { AUTH_COLORS } from '../../components/auth/AuthChrome';
import { AUTH_MOBILE_DOCK_PADDING } from '../../components/auth/AuthNavigation';
import { ShipmentTransportBadge } from '../../components/auth/ShipmentTransportIcon';
import Header from '../../components/Header';
import { ShipmentFiltersPanel } from '../../components/ShipmentFiltesPanel';
import { ShipmentSwitchCard } from '../../components/ShipmentSwitchCard';
import { FONT_SIZE, FONT_WEIGHT } from '../../components/ui/TYPOGRAPHY';
import { useDashboardShipments } from '../../hooks/useDashboardShipments';
import { useResponsive } from '../../hooks/useResponsive';
import {
  useSelectedShipmentDocuments,
  type DashboardUpdate,
} from '../../hooks/useSelectedShipmentDocuments';
import { useShipmentFilters } from '../../hooks/useShipmentFilters';
import { useWebNotifications } from '../../hooks/useWebNotifications';
import { supabase } from '../../lib/URLs';

export default function Dashboard() {
  const { t } = useTranslation();
  const { isDesktop, height } = useResponsive();
  const carouselRef = useRef<ScrollView>(null);

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
    selectShipment,
  } = useSelectedShipments(visibleShipments);

  const {
    documents,
    updates,
    detailLoading,
  } = useSelectedShipmentDocuments({
    selectedShipmentId,
    isInternal,
    userId,
  });

  const { webNotificationPermission, handleEnableWebNotifications } = useWebNotifications();

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
  const canRequestWebNotifications =
    Platform.OS === 'web' && Boolean(userId) && webNotificationPermission === 'default';

  // Índice del carrusel mobile
  const selectedIndex = selectedShipment
    ? visibleShipments.findIndex((s) => s.id === selectedShipment.id)
    : 0;

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={AUTH_COLORS.orange} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
        {/* Panel de filtros */}
        {baseVisibleShipments.length < 2 ? null : (
        <View style={isDesktop ? styles.filtersWrapDesktop : undefined}>
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
        </View>
        )}

        {!visibleShipments.length ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={40} color={AUTH_COLORS.secondaryText} />
            <Text style={styles.emptyTitle}>
              {activeFilterCount
                ? t('dashboard.filters.emptyTitle')
                : searchQuery.trim()
                  ? t('dashboard.noShipmentsFound')
                  : t('dashboard.noShipmentsAvailable')}
            </Text>
            <Text style={styles.emptySubtitle}>{t('dashboard.emptyStateSubtitle')}</Text>
            {activeFilterCount ? (
              <TouchableOpacity style={styles.emptyResetButton} onPress={resetFilters}>
                <Ionicons name="refresh-outline" size={16} color={AUTH_COLORS.primaryText} />
                <Text style={styles.emptyResetText}>
                  {t('dashboard.filters.clear')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <>
            {isDesktop ? (
              /* ── Layout Desktop Proporcional (2 Columnas Maestras) ── */
              <View style={styles.desktopGrid}>
                {/* Columna 1: Selector lateral de cargas */}
                <View style={styles.desktopListColumn}>
                  <View style={styles.listHeaderRow}>
                    <Text style={styles.listHeaderTitle}>
                      {t('dashboard.shipments')}
                    </Text>
                    <View style={styles.badgeCount}>
                      <Text style={styles.badgeCountText}>{visibleShipments.length}</Text>
                    </View>
                  </View>

                  <ScrollView
                    style={[
                      styles.desktopShipmentScroll,
                      { maxHeight: Math.max(480, height - 260) },
                      Platform.OS === 'web'
                        ? ({ scrollbarWidth: 'none', msOverflowStyle: 'none' } as any)
                        : undefined,
                    ]}
                    contentContainerStyle={styles.desktopShipmentList}
                    showsVerticalScrollIndicator={false}
                  >
                    {visibleShipments.map((item) => (
                      <ShipmentSwitchCard
                        key={item.id}
                        shipment={item}
                        selected={item.id === selectedShipment?.id}
                        desktop={true}
                        onPress={() => selectShipment(item.id)}
                      />
                    ))}
                  </ScrollView>
                </View>

                {/* Columna 2: Espacio de trabajo de la carga seleccionada */}
                {selectedShipment ? (
                  <View style={styles.desktopMainColumn}>
                    {/* Hero Card completo con barra de acciones integrada */}
                    <HeroShipmentCard
                      shipment={selectedShipment}
                      shipmentTypeLabel={shipmentTypeLabel}
                      statusTone={statusTone}
                      isInternal={isInternal}
                      isDesktop={true}
                      t={t}
                    />

                    {/* Subgrid inferior simétrico de 2 columnas de igual ancho */}
                    <View style={styles.modularGrid}>
                      <RecentUpdatesCard
                        updates={updates}
                        loading={detailLoading}
                        shipmentId={selectedShipment.id}
                        t={t}
                      />

                      <ShipmentDocumentsCard
                        documents={documents}
                        loading={detailLoading}
                        shipmentId={selectedShipment.id}
                        t={t}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            ) : (
              /* ── Layout Mobile ── */
              <View style={styles.mobileStack}>
                {/* Carrusel superior de selector de cargas */}
                <View>
                  <View style={styles.carouselHeader}>
                    <Text style={styles.carouselSelectedLabel} numberOfLines={1}>
                      {selectedShipment?.do_number ?? '—'}
                    </Text>
                    <Text style={styles.carouselCounter}>
                      {selectedIndex + 1}/{visibleShipments.length}
                    </Text>
                  </View>

                  <ScrollView
                    ref={carouselRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.shipmentRail}
                    snapToInterval={188}
                    decelerationRate="fast"
                    onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                      const idx = Math.round(e.nativeEvent.contentOffset.x / 188);
                      if (visibleShipments[idx]) {
                        selectShipment(visibleShipments[idx].id);
                      }
                    }}
                  >
                    {visibleShipments.map((item) => (
                      <ShipmentSwitchCard
                        key={item.id}
                        shipment={item}
                        selected={item.id === selectedShipment?.id}
                        desktop={false}
                        onPress={() => selectShipment(item.id)}
                      />
                    ))}
                  </ScrollView>
                </View>

                {selectedShipment ? (
                  <>
                    <HeroShipmentCard
                      shipment={selectedShipment}
                      shipmentTypeLabel={shipmentTypeLabel}
                      statusTone={statusTone}
                      isInternal={isInternal}
                      isDesktop={false}
                      t={t}
                    />

                    <RecentUpdatesCard
                      updates={updates}
                      loading={detailLoading}
                      shipmentId={selectedShipment.id}
                      t={t}
                    />

                    <ShipmentDocumentsCard
                      documents={documents}
                      loading={detailLoading}
                      shipmentId={selectedShipment.id}
                      t={t}
                    />
                  </>
                ) : null}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
// Componente: HeroShipmentCard Unificado
// ─────────────────────────────────────────────

type HeroShipmentCardProps = {
  shipment: types.ShipmentListItem;
  shipmentTypeLabel: string;
  statusTone: ToneResult;
  isInternal: boolean;
  isDesktop: boolean;
  t: ReturnType<typeof useTranslation>['t'];
};

const isUuid = (val: string | null | undefined): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
};

const sanitizeAuthor = (name: string | null | undefined, fallback = 'Equipo Ingelox'): string => {
  if (!name || isUuid(name)) return fallback;
  return name;
};

function HeroShipmentCard({
  shipment,
  shipmentTypeLabel,
  statusTone,
  isInternal,
  t,
}: HeroShipmentCardProps) {
  const locale = i18n.language === 'es' ? 'es-CO' : 'en-US';

  return (
    <View style={[styles.heroCard, styles.shadowCard]}>
      {/* 1. Cabecera con DO, Badges y Toolbar de Acciones Rápidas */}
      <View style={styles.heroTopRow}>
        <View style={styles.heroIdentityWrap}>
          <View style={styles.heroTitleRow}>
            <Text style={styles.heroDoTitle}>{shipment.do_number}</Text>
            <ShipmentTransportBadge
              shipment={shipment}
              shipmentType={shipment.shipment_type}
              color={AUTH_COLORS.primaryText}
              size={16}
              containerStyle={styles.heroTransportBadge}
            />
            <View style={[styles.statusPill, { backgroundColor: statusTone.pillBackground }]}>
              <Text style={[styles.statusPillText, { color: statusTone.pillText }]}>
                {types.getShipmentStatusLabel(shipment.current_status, t)}
              </Text>
            </View>
          </View>

          <Text style={styles.heroRouteSub}>
            {shipment.origin} → {shipment.destination}
            {shipmentTypeLabel ? ` · ${shipmentTypeLabel}` : ''}
            {shipment.incoterm ? ` · ${shipment.incoterm}` : ''}
          </Text>

          <Text style={styles.heroAuditSub}>
            {shipment.updated_by
              ? `${t('shipmentDetail.updatedBy')} ${sanitizeAuthor(shipment.updated_by)}${(shipment as any).updated_at ? ` · ${formatDateDisplay((shipment as any).updated_at, locale)}` : ''}`
              : `${t('shipmentDetail.createdBy')} ${sanitizeAuthor(shipment.created_by)}${shipment.created_at ? ` · ${formatDateDisplay(shipment.created_at, locale)}` : ''}`}
          </Text>
        </View>

        {/* Toolbar Horizontal de Acciones Contextuales */}
        <View style={styles.heroActionToolbar}>
          {isInternal && (
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => router.push(`/editShipment/${shipment.id}` as any)}
            >
              <Ionicons name="create-outline" size={16} color={AUTH_COLORS.primaryText} />
              <Text style={styles.toolbarButtonText}>{t('shipmentDetail.edit')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.toolbarButton, styles.toolbarButtonHighlight]}
            onPress={() => router.push(`/shipment/${shipment.id}` as any)}
          >
            <Ionicons name="open-outline" size={16} color={AUTH_COLORS.primaryText} />
            <Text style={styles.toolbarButtonText}>{t('dashboard.openDetail')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Barra de Ruta y Progreso */}
      <View style={styles.heroRouteBox}>
        <View style={styles.routeHeaderRow}>
          <View style={styles.routeCol}>
            <Text style={styles.routeCityLabel}>{shipment.origin || '—'}</Text>
            <Text style={styles.routeDateSub}>
              {formatDateDisplay(shipment.atd || shipment.etd, locale)}
            </Text>
          </View>
          <View style={[styles.routeCol, { alignItems: 'flex-end' }]}>
            <Text style={styles.routeCityLabel}>{shipment.destination || '—'}</Text>
            <Text style={styles.routeDateSub}>
              {formatDateDisplay(shipment.ata || shipment.eta, locale)}
            </Text>
          </View>
        </View>

        <RouteProgress toneColor={statusTone.progress} shipment={shipment} />
      </View>

      {/* 3. Quick Specs Grid (Datos clave en ficha compacta) */}
      <View style={styles.specsGrid}>
        <SpecItem
          icon="airplane-outline"
          label={
            shipment.shipment_type === 'maritime'
              ? t('shipmentForm.labels.carrierMaritime')
              : shipment.shipment_type === 'air'
                ? t('shipmentForm.labels.carrierAir')
                : shipment.shipment_type === 'land'
                  ? t('shipmentForm.labels.carrierLand')
                  : t('shipmentDetail.labels.carrier')
          }
          value={shipment.carrier}
        />
        <SpecItem
          icon="navigate-outline"
          label={t('shipmentDetail.labels.flight')}
          value={shipment.flight_vessel}
        />
        <SpecItem
          icon="calendar-outline"
          label={t('shipmentDetail.labels.eta')}
          value={formatDateTimeDisplay(shipment.eta, locale)}
        />
        <SpecItem
          icon="checkmark-circle-outline"
          label={t('shipmentDetail.labels.ata')}
          value={shipment.ata ? formatDateTimeDisplay(shipment.ata, locale) : undefined}
        />
        <SpecItem
          icon="pricetag-outline"
          label={t('shipmentDetail.labels.incoterm')}
          value={shipment.incoterm}
        />
        <SpecItem
          icon="time-outline"
          label={t('shipmentDetail.labels.freeDays')}
          value={shipment.free_days != null ? `${shipment.free_days} d` : undefined}
        />
      </View>
    </View>
  );
}

function SpecItem({ icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.specChip}>
      <Ionicons name={icon} size={14} color={AUTH_COLORS.secondaryText} />
      <Text style={styles.specLabel}>{label}:</Text>
      <Text style={styles.specValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────
// Componente: RecentUpdatesCard (Novedades)
// ─────────────────────────────────────────────

function RecentUpdatesCard({
  updates,
  loading,
  shipmentId,
  t,
}: {
  updates: DashboardUpdate[];
  loading: boolean;
  shipmentId: string;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const locale = i18n.language === 'es' ? 'es-CO' : 'en-US';
  const visibleUpdates = updates.filter(
    (item): item is typeof item & { observation: string } =>
      typeof item.observation === 'string' && item.observation.trim().length > 0,
  );

  return (
    <View style={[styles.modularCard, styles.shadowCard]}>
      <View style={styles.modularCardHeader}>
        <View style={styles.cardHeaderTitleRow}>
          <Ionicons name="notifications-outline" size={18} color={AUTH_COLORS.orange} />
          <Text style={styles.modularCardTitle}>
            {t('shipmentDetail.sectionUpdates')}
          </Text>
          {visibleUpdates.length > 0 ? (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>{visibleUpdates.length}</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity onPress={() => router.push(`/shipment/${shipmentId}` as any)}>
          <Text style={styles.cardHeaderLink}>
            {t('common.viewAll')} →
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.cardCenterLoading}>
          <ActivityIndicator size="small" color={AUTH_COLORS.orange} />
        </View>
      ) : visibleUpdates.length === 0 ? (
        <View style={styles.emptyCardBox}>
          <Ionicons name="notifications-outline" size={32} color={AUTH_COLORS.line} />
          <Text style={styles.emptyCardText}>
            {t('dashboard.emptyUpdates')}
          </Text>
        </View>
      ) : (
        <View style={styles.updatesListWrap}>
          {visibleUpdates.slice(0, 3).map((item) => (
            <View key={item.id} style={styles.updateRowItem}>
              <View style={styles.updateItemHeader}>
                <Text style={styles.updateDateText}>
                  {formatDateTimeDisplay(item.created_at, locale)}
                </Text>
                {item.author_name ? (
                  <Text style={styles.updateAuthorText} numberOfLines={1}>
                    {item.author_name}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.updateObsText} numberOfLines={2}>
                {item.observation?.trim()}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// Componente: ShipmentDocumentsCard (Documentos)
// ─────────────────────────────────────────────

function ShipmentDocumentsCard({
  documents,
  loading,
  shipmentId,
  t,
}: {
  documents: types.DocumentRecord[];
  loading: boolean;
  shipmentId: string;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  return (
    <View style={[styles.modularCard, styles.shadowCard]}>
      <View style={styles.modularCardHeader}>
        <View style={styles.cardHeaderTitleRow}>
          <Ionicons name="document-text-outline" size={18} color={AUTH_COLORS.blue} />
          <Text style={styles.modularCardTitle}>
            {t('shipmentDetail.sectionDocuments')}
          </Text>
          {documents.length > 0 ? (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>{documents.length}</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity onPress={() => router.push(`/shipment/${shipmentId}` as any)}>
          <Text style={styles.cardHeaderLink}>
            {t('common.viewAll')} →
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.cardCenterLoading}>
          <ActivityIndicator size="small" color={AUTH_COLORS.orange} />
        </View>
      ) : documents.length === 0 ? (
        <View style={styles.emptyCardBox}>
          <Ionicons name="document-outline" size={32} color={AUTH_COLORS.line} />
          <Text style={styles.emptyCardText}>
            {t('dashboard.emptyDocuments')}
          </Text>
        </View>
      ) : (
        <View style={styles.documentsListWrap}>
          {documents.slice(0, 4).map((doc) => (
            <TouchableOpacity
              key={doc.id}
              style={styles.documentRowItem}
              onPress={() => router.push(`/shipment/${shipmentId}` as any)}
            >
              <View style={styles.docIconBox}>
                <Ionicons name="document-outline" size={16} color={AUTH_COLORS.blue} />
              </View>
              <View style={styles.docCopyBox}>
                <Text style={styles.docNameText} numberOfLines={1}>
                  {doc.file_name}
                </Text> 
                <Text style={styles.docMetaText}>{formatDocumentSize(doc.file_size)}</Text>
              </View>
              <Ionicons name="open-outline" size={16} color={AUTH_COLORS.secondaryText} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// Helpers de tono y metadatos
// ─────────────────────────────────────────────

type ToneKey = 'green' | 'blue' | 'orange';
type ToneResult = { pillBackground: string; pillText: string; progress: string };

const STATUS_TONE_CONFIG: Record<ToneKey, ToneResult> = {
  green: { pillBackground: 'rgba(52, 199, 89, 0.16)', pillText: '#4cd964', progress: '#34c759' },
  blue: { pillBackground: AUTH_COLORS.blueSoft, pillText: AUTH_COLORS.blue, progress: AUTH_COLORS.blue },
  orange: { pillBackground: AUTH_COLORS.orangeSoft, pillText: AUTH_COLORS.orangeText, progress: AUTH_COLORS.orange },
};

const STATUS_TONE_MAP: { pattern: RegExp; tone: ToneKey }[] = [
  { pattern: /entreg|recibid|origin|arrived|delivered|arrival_confirmation/i, tone: 'green' },
  { pattern: /transit|pending|waiting|program|tránsit|on.way|departure/i, tone: 'blue' },
];

function getStatusTone(status: string | null | undefined): ToneResult {
  const s = status ?? '';
  for (const { pattern, tone } of STATUS_TONE_MAP) {
    if (pattern.test(s)) return STATUS_TONE_CONFIG[tone];
  }
  return STATUS_TONE_CONFIG.orange;
}

function getShipmentTypeLabel(
  shipment: types.ShipmentListItem | null | undefined,
  t: ReturnType<typeof useTranslation>['t'],
) {
  const inferredType = types.inferShipmentType(shipment ?? {});
  const labelKey = types.getShipmentTypeLabelKey(inferredType || shipment?.shipment_type || '');
  return labelKey ? t(labelKey) : (shipment?.shipment_type ?? '');
}

function formatDocumentSize(fileSize: number) {
  if (!fileSize) return '0 KB';
  return `${(fileSize / 1024).toFixed(1)} KB`;
}

// ─────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────

const DESKTOP_MAX_WIDTH = 1440;
const CARD_RADIUS = 24;
const SECTION_GAP = 18;

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, backgroundColor: AUTH_COLORS.backgroundBottom },
  backgroundBase: { ...StyleSheet.absoluteFillObject, backgroundColor: AUTH_COLORS.backgroundBottom },
  backgroundGlowOne: { position: 'absolute', top: -120, left: -50, width: 260, height: 260, borderRadius: 999, backgroundColor: 'rgba(199, 138, 75, 0.18)' },
  backgroundGlowTwo: { position: 'absolute', top: 40, right: -70, width: 280, height: 280, borderRadius: 999, backgroundColor: 'rgba(79, 104, 142, 0.18)' },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: AUTH_COLORS.backgroundBottom },

  scroll: { flex: 1, minHeight: 0 },
  content: { gap: SECTION_GAP },
  contentDesktop: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 64, alignSelf: 'center', width: '100%', maxWidth: DESKTOP_MAX_WIDTH },
  contentMobile: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 28 },
  contentWithDock: { paddingBottom: AUTH_MOBILE_DOCK_PADDING },

  filtersWrapDesktop: { width: '100%' },

  // Empty State
  emptyState: { marginTop: 24, paddingVertical: 40, paddingHorizontal: 24, borderRadius: CARD_RADIUS, backgroundColor: AUTH_COLORS.surfaceSoft, alignItems: 'center', gap: 12 },
  emptyTitle: { color: AUTH_COLORS.primaryText, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  emptySubtitle: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },
  emptyResetButton: { minHeight: 40, paddingHorizontal: 16, borderRadius: 14, backgroundColor: AUTH_COLORS.orangeSoft, borderWidth: 1, borderColor: AUTH_COLORS.orangeBorder, flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyResetText: { color: AUTH_COLORS.primaryText, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },

  // Desktop Grid (2 Columnas Maestras)
  desktopGrid: { flexDirection: 'row', gap: SECTION_GAP, alignItems: 'flex-start' },
  desktopListColumn: { width: 280, flexShrink: 0, gap: 10 },
  listHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  listHeaderTitle: { color: AUTH_COLORS.surface, fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold },
  badgeCount: { backgroundColor: AUTH_COLORS.surfaceAlt, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: AUTH_COLORS.line },
  badgeCountText: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  desktopShipmentScroll: { flexGrow: 0 },
  desktopShipmentList: { gap: 10, paddingRight: 4 },
  desktopMainColumn: { flex: 1, minWidth: 0, gap: SECTION_GAP },

  // Modular Grid (Subgrid 50% / 50%)
  modularGrid: { flexDirection: 'row', gap: SECTION_GAP, alignItems: 'stretch' },
  modularCard: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: CARD_RADIUS,
    padding: 18,
    gap: 14,
    minHeight: 200,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
  },
  modularCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: AUTH_COLORS.line },
  cardHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modularCardTitle: { color: AUTH_COLORS.primaryText, fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold },
  cardHeaderLink: { color: AUTH_COLORS.orange, fontSize: FONT_SIZE.xs + 1, fontWeight: FONT_WEIGHT.bold },
  cardCenterLoading: { flex: 1, paddingVertical: 28, alignItems: 'center', justifyContent: 'center' },
  emptyCardBox: { flex: 1, minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  emptyCardText: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.xs + 1, textAlign: 'center', lineHeight: 18, maxWidth: 280 },

  // Updates list
  updatesListWrap: { flex: 1, gap: 10 },
  updateRowItem: { padding: 10, borderRadius: 14, backgroundColor: AUTH_COLORS.surfaceAlt, borderWidth: 1, borderColor: AUTH_COLORS.line, gap: 4 },
  updateItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  updateDateText: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.xs - 1, fontWeight: FONT_WEIGHT.bold },
  updateAuthorText: { color: AUTH_COLORS.orange, fontSize: FONT_SIZE.xs - 1, fontWeight: FONT_WEIGHT.bold },
  updateStatusText: { color: AUTH_COLORS.primaryText, fontSize: FONT_SIZE.xs + 1, fontWeight: FONT_WEIGHT.bold },
  updateObsText: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.xs, lineHeight: 16 },

  // Documents list
  documentsListWrap: { gap: 8 },
  documentRowItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: AUTH_COLORS.surfaceAlt, borderWidth: 1, borderColor: AUTH_COLORS.line },
  docIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: AUTH_COLORS.blueSoft },
  docCopyBox: { flex: 1, minWidth: 0 },
  docNameText: { color: AUTH_COLORS.primaryText, fontSize: FONT_SIZE.xs + 1, fontWeight: FONT_WEIGHT.bold },
  docMetaText: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.xs - 1, marginTop: 1 },

  // Hero Card
  heroCard: { backgroundColor: AUTH_COLORS.surface, borderRadius: CARD_RADIUS, padding: 22, gap: 18, borderWidth: 1, borderColor: AUTH_COLORS.line },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  heroIdentityWrap: { flex: 1, minWidth: 260, gap: 4 },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  heroDoTitle: { color: AUTH_COLORS.primaryText, fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold, lineHeight: 30 },
  heroTransportBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: AUTH_COLORS.orangeSoft, borderWidth: 1, borderColor: AUTH_COLORS.orangeBorder },
  statusPill: { height: 28, paddingHorizontal: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statusPillText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, lineHeight: 16 },
  heroRouteSub: { color: AUTH_COLORS.primaryText, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium, marginTop: 2 },
  heroAuditSub: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.xs },

  // Hero Action Toolbar
  heroActionToolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  toolbarButton: { height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 12, backgroundColor: AUTH_COLORS.surfaceAlt, borderWidth: 1, borderColor: AUTH_COLORS.line },
  toolbarButtonHighlight: { backgroundColor: AUTH_COLORS.orangeSoft, borderColor: AUTH_COLORS.orangeBorder },
  toolbarButtonText: { color: AUTH_COLORS.primaryText, fontSize: FONT_SIZE.xs + 1, fontWeight: FONT_WEIGHT.bold, lineHeight: 18 },

  // Route Box
  heroRouteBox: { padding: 16, borderRadius: 18, backgroundColor: AUTH_COLORS.backgroundTop, gap: 12 },
  routeHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  routeCol: { flex: 1 },
  routeCityLabel: { color: AUTH_COLORS.surface, fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold },
  routeDateSub: { color: 'rgba(245, 241, 234, 0.68)', fontSize: FONT_SIZE.xs, marginTop: 2 },

  // Specs Grid
  specsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: AUTH_COLORS.surfaceAlt, borderWidth: 1, borderColor: AUTH_COLORS.line },
  specLabel: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium },
  specValue: { color: AUTH_COLORS.primaryText, fontSize: FONT_SIZE.xs + 1, fontWeight: FONT_WEIGHT.bold },

  // Mobile Stack
  mobileStack: { gap: 14 },
  carouselHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  carouselSelectedLabel: { flex: 1, color: AUTH_COLORS.surface, fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold },
  carouselCounter: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.medium },
  shipmentRail: { gap: 12, paddingRight: 12 },

  shadowCard: { shadowColor: AUTH_COLORS.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 6 },
});
