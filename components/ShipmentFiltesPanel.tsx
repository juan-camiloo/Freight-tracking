import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getActiveFilterSummary } from '../features/dashboard/filters';
import * as types from '../lib/shipmentType';
import { COLORS } from './ui/COLORS';
import { FONT_SIZE, FONT_WEIGHT } from './ui/TYPOGRAPHY';

export function ShipmentFiltersPanel({
  filters,
  filtersOpen,
  activeFilterCount,
  totalCount,
  visibleCount,
  isDesktop,
  t,
  onToggleOpen,
  onChangeFilter,
  onResetFilters,
}: types.ShipmentFiltersPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const resultLabel = t('dashboard.filters.resultCount', {
    visible: visibleCount,
    total: totalCount,
  });
  const activeFilterSummary = getActiveFilterSummary(filters, t);
  const visibleFilterSummary = activeFilterSummary.slice(0, 6);
  const hiddenFilterSummaryCount = activeFilterSummary.length - visibleFilterSummary.length;
  const sortOptions: {
    value: types.SortField;
    label: string;
    icon: ComponentProps<typeof Ionicons>['name'];
  }[] = [
    { value: 'created', label: t('dashboard.filters.createdAt'), icon: 'calendar-outline' },
    { value: 'do', label: 'DO', icon: 'file-tray-full-outline' },
    { value: 'status', label: t('dashboard.filters.statusDate'), icon: 'pulse-outline' },
    { value: 'eta', label: 'ETA', icon: 'flag-outline' },
    { value: 'etd', label: 'ETD', icon: 'navigate-outline' },
    { value: 'free_days', label: t('dashboard.filters.freeDays'), icon: 'hourglass-outline' },
  ];
  const statusOptions: { value: types.StatusGroupFilter; label: string }[] = [
    { value: 'all', label: t('dashboard.filters.all') },
    { value: 'pending', label: t('dashboard.filters.pending') },
    { value: 'inTransit', label: t('dashboard.filters.inTransit') },
    { value: 'customs', label: t('dashboard.filters.customs') },
    { value: 'delivered', label: t('dashboard.filters.delivered') },
    { value: 'withoutStatus', label: t('dashboard.filters.withoutStatus') },
  ];
  const milestoneOptions: { value: types.MilestoneFilter; label: string }[] = [
    { value: 'all', label: t('dashboard.filters.all') },
    { value: 'withoutEta', label: t('dashboard.filters.withoutEta') },
    { value: 'withAtd', label: t('dashboard.filters.withAtd') },
    { value: 'withAta', label: t('dashboard.filters.withAta') },
    { value: 'overdueEta', label: t('dashboard.filters.overdueEta') },
  ];
  const directionLabel = filters.sortDirection === 'asc'
    ? t('dashboard.filters.ascending')
    : t('dashboard.filters.descending');
  const nextDirection = filters.sortDirection === 'asc' ? 'desc' : 'asc';

  return (
    <View style={[styles.filtersCard, styles.shadowCard]}>
      <View style={styles.filtersToolbar}>
        <View style={styles.filtersToolbarTop}>
          <View style={styles.filtersToolbarLead}>
            <TouchableOpacity
              style={[
                styles.filtersMainButton,
                filtersOpen && styles.filtersMainButtonOpen,
                activeFilterCount ? styles.filtersMainButtonActive : null,
              ]}
              onPress={onToggleOpen}
            >
              <Ionicons name="options-outline" size={17} color={COLORS.primaryText} />
              <Text style={styles.filtersMainButtonText}>
                {filtersOpen
                  ? t('dashboard.filters.hide')
                  : activeFilterCount
                    ? t('dashboard.filters.edit')
                    : t('dashboard.filters.title')}
              </Text>
              {activeFilterCount ? (
                <View style={styles.filtersBadge}>
                  <Text style={styles.filtersBadgeText}>{activeFilterCount}</Text>
                </View>
              ) : null}
              <Ionicons
                name={filtersOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={15}
                color={COLORS.primaryText}
              />
            </TouchableOpacity>

            <Text style={styles.filtersResultText}>{resultLabel}</Text>
          </View>

          <View style={[styles.filtersToolbarControls, !isDesktop && styles.filtersToolbarControlsMobile]}>
            <View style={styles.filtersSortWrap}>
              <Text style={styles.filtersSortLabel}>
                {t('dashboard.filters.sortBy')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filtersSortScroll}
                contentContainerStyle={styles.filtersSortChipRow}
              >
                {sortOptions.map((option) => (
                  <FilterChip
                    key={option.value}
                    compact
                    icon={option.icon}
                    label={option.label}
                    active={filters.sortField === option.value}
                    onPress={() => onChangeFilter('sortField', option.value)}
                  />
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={styles.filtersDirectionButton}
              onPress={() => onChangeFilter('sortDirection', nextDirection)}
            >
              <Ionicons
                name={filters.sortDirection === 'asc' ? 'arrow-up-outline' : 'arrow-down-outline'}
                size={15}
                color={COLORS.primaryText}
              />
              <Text style={styles.filtersDirectionText}>{directionLabel}</Text>
            </TouchableOpacity>

            {activeFilterCount ? (
              <TouchableOpacity style={styles.filtersClearButton} onPress={onResetFilters}>
                <Ionicons name="close-circle-outline" size={15} color={COLORS.primaryText} />
                <Text style={styles.filtersClearText}>
                  {t('dashboard.filters.clear')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {visibleFilterSummary.length ? (
          <View style={styles.activeFilterSummary}>
            {visibleFilterSummary.map((label) => (
              <View key={label} style={styles.activeFilterPill}>
                <Text style={styles.activeFilterPillText}>{label}</Text>
              </View>
            ))}
            {hiddenFilterSummaryCount > 0 ? (
              <View style={styles.activeFilterPill}>
                <Text style={styles.activeFilterPillText}>+{hiddenFilterSummaryCount}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {filtersOpen ? (
        <View style={styles.filtersAdvanced}>
          <View style={[styles.filtersQuickGrid, isDesktop && styles.filtersQuickGridDesktop]}>
            <FilterSection title={t('dashboard.filters.transport')}>
              <FilterChipRow>
                <FilterChip
                  label={t('dashboard.filters.all')}
                  active={filters.shipmentType === 'all'}
                  onPress={() => onChangeFilter('shipmentType', 'all')}
                />
                <FilterChip
                  icon="airplane-outline"
                  label={t('shipmentForm.options.shipmentType.air')}
                  active={filters.shipmentType === 'air'}
                  onPress={() => onChangeFilter('shipmentType', 'air')}
                />
                <FilterChip
                  icon="boat-outline"
                  label={t('shipmentForm.options.shipmentType.maritime')}
                  active={filters.shipmentType === 'maritime'}
                  onPress={() => onChangeFilter('shipmentType', 'maritime')}
                />
                <FilterChip
                  icon="car-outline"
                  label={t('shipmentForm.options.shipmentType.land')}
                  active={filters.shipmentType === 'land'}
                  onPress={() => onChangeFilter('shipmentType', 'land')}
                />
              </FilterChipRow>
            </FilterSection>

            <FilterSection title={t('dashboard.filters.status')}>
              <FilterChipRow>
                {statusOptions.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    active={filters.statusGroup === option.value}
                    onPress={() => onChangeFilter('statusGroup', option.value)}
                  />
                ))}
              </FilterChipRow>
            </FilterSection>

            <FilterSection title={t('dashboard.filters.routeAndParties')}>
              <View style={[styles.filtersInputGrid, isDesktop && styles.filtersInputGridDesktop]}>
                <FilterTextInput label={t('dashboard.filters.origin')} value={filters.origin} onChangeText={(value) => onChangeFilter('origin', value)} placeholder="MIA" />
                <FilterTextInput label={t('dashboard.filters.destination')} value={filters.destination} onChangeText={(value) => onChangeFilter('destination', value)} placeholder="BOG" />
              </View>
            </FilterSection>
          </View>

          {/* Botón Desplegable para Filtros Avanzados */}
          <TouchableOpacity
            style={styles.advancedToggleBtn}
            onPress={() => setShowAdvanced((prev) => !prev)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={showAdvanced ? 'chevron-up-circle-outline' : 'chevron-down-circle-outline'}
              size={17}
              color={COLORS.orange}
            />
            <Text style={styles.advancedToggleText}>
              {showAdvanced
                ? (t('dashboard.filters.hideAdvanced') || 'Ocultar filtros avanzados')
                : (t('dashboard.filters.showAdvanced') || 'Filtros avanzados (fechas y detalles)')}
            </Text>
          </TouchableOpacity>

          {showAdvanced ? (
            <>
              <FilterSection title={t('dashboard.filters.milestones')}>
                <FilterChipRow>
                  {milestoneOptions.map((option) => (
                    <FilterChip
                      key={option.value}
                      label={option.label}
                      active={filters.milestone === option.value}
                      onPress={() => onChangeFilter('milestone', option.value)}
                    />
                  ))}
                </FilterChipRow>
              </FilterSection>

              <FilterSection title={t('dashboard.filters.dateRanges')}>
                <View style={[styles.filtersInputGrid, isDesktop && styles.filtersInputGridDesktop]}>
                  <FilterTextInput label={t('dashboard.filters.createdFrom')} value={filters.createdFrom} onChangeText={(value) => onChangeFilter('createdFrom', value)} placeholder={t('dashboard.filters.datePlaceholder')} />
                  <FilterTextInput label={t('dashboard.filters.createdTo')} value={filters.createdTo} onChangeText={(value) => onChangeFilter('createdTo', value)} placeholder={t('dashboard.filters.datePlaceholder')} />
                  <FilterTextInput label={t('dashboard.filters.statusFrom')} value={filters.statusFrom} onChangeText={(value) => onChangeFilter('statusFrom', value)} placeholder={t('dashboard.filters.datePlaceholder')} />
                  <FilterTextInput label={t('dashboard.filters.statusTo')} value={filters.statusTo} onChangeText={(value) => onChangeFilter('statusTo', value)} placeholder={t('dashboard.filters.datePlaceholder')} />
                  <FilterTextInput label={t('dashboard.filters.etdFrom')} value={filters.etdFrom} onChangeText={(value) => onChangeFilter('etdFrom', value)} placeholder={t('dashboard.filters.datePlaceholder')} />
                  <FilterTextInput label={t('dashboard.filters.etdTo')} value={filters.etdTo} onChangeText={(value) => onChangeFilter('etdTo', value)} placeholder={t('dashboard.filters.datePlaceholder')} />
                  <FilterTextInput label={t('dashboard.filters.ataFrom')} value={filters.ataFrom} onChangeText={(value) => onChangeFilter('ataFrom', value)} placeholder={t('dashboard.filters.datePlaceholder')} />
                  <FilterTextInput label={t('dashboard.filters.ataTo')} value={filters.ataTo} onChangeText={(value) => onChangeFilter('ataTo', value)} placeholder={t('dashboard.filters.datePlaceholder')} />
                  <FilterTextInput label={t('dashboard.filters.cutoffFrom')} value={filters.cutoffFrom} onChangeText={(value) => onChangeFilter('cutoffFrom', value)} placeholder={t('dashboard.filters.datePlaceholder')} />
                  <FilterTextInput label={t('dashboard.filters.cutoffTo')} value={filters.cutoffTo} onChangeText={(value) => onChangeFilter('cutoffTo', value)} placeholder={t('dashboard.filters.datePlaceholder')} />
                </View>
              </FilterSection>

              <FilterSection title={t('dashboard.filters.operations')}>
                <View style={[styles.filtersInputGrid, isDesktop && styles.filtersInputGridDesktop]}>
                  <FilterTextInput label={t('dashboard.filters.statusExact')} value={filters.statusText} onChangeText={(value) => onChangeFilter('statusText', value)} placeholder={t('dashboard.filters.statusPlaceholder')} />
                  <FilterTextInput label={t('dashboard.filters.party')} value={filters.party} onChangeText={(value) => onChangeFilter('party', value)} placeholder={t('dashboard.filters.partyPlaceholder')} />
                  <FilterTextInput label={t('dashboard.filters.carrier')} value={filters.carrier} onChangeText={(value) => onChangeFilter('carrier', value)} placeholder={t('dashboard.filters.carrierPlaceholder')} />
                  <FilterTextInput label={t('dashboard.filters.incoterm')} value={filters.incoterm} onChangeText={(value) => onChangeFilter('incoterm', value)} placeholder={t('dashboard.filters.incotermPlaceholder')} />
                  <FilterTextInput label={t('dashboard.filters.cargoType')} value={filters.cargoType} onChangeText={(value) => onChangeFilter('cargoType', value)} placeholder={t('dashboard.filters.cargoTypePlaceholder')} />
                  <FilterTextInput label={t('dashboard.filters.booking')} value={filters.bookingStatus} onChangeText={(value) => onChangeFilter('bookingStatus', value)} placeholder={t('dashboard.filters.bookingPlaceholder')} />
                  <FilterTextInput label={t('dashboard.filters.inspection')} value={filters.inspectionStatus} onChangeText={(value) => onChangeFilter('inspectionStatus', value)} placeholder={t('dashboard.filters.inspectionPlaceholder')} />
                  <FilterTextInput label={t('dashboard.filters.freeDaysMin')} value={filters.freeDaysMin} onChangeText={(value) => onChangeFilter('freeDaysMin', value)} placeholder="0" keyboardType="numeric" />
                  <FilterTextInput label={t('dashboard.filters.freeDaysMax')} value={filters.freeDaysMax} onChangeText={(value) => onChangeFilter('freeDaysMax', value)} placeholder="30" keyboardType="numeric" />
                </View>
              </FilterSection>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function FilterChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterChipRow}
    >
      {children}
    </ScrollView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  icon,
  compact = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: ComponentProps<typeof Ionicons>['name'];
  compact?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        compact && styles.filterChipCompact,
        active && styles.filterChipActive,
      ]}
      onPress={onPress}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={compact ? 13 : 15}
          color={active ? COLORS.primaryText : COLORS.surface}
        />
      ) : null}
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function FilterTextInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.filterInputWrap}>
      <Text style={styles.filterInputLabel}>{label}</Text>
      <TextInput
        style={styles.filterInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.secondaryText}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filtersCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 14,
    gap: 12,
  },
  filtersToolbar: { gap: 10 },
  filtersToolbarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  filtersToolbarLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  filtersMainButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: COLORS.orangeSoft,
    borderWidth: 1,
    borderColor: COLORS.orangeBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  filtersMainButtonOpen: {
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.orange,
  },
  filtersMainButtonActive: { borderColor: COLORS.orange },
  filtersMainButtonText: {
    color: COLORS.primaryText,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
  },
  filtersBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: COLORS.backgroundTop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersBadgeText: {
    color: COLORS.surface,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
  filtersResultText: {
    color: COLORS.secondaryText,
    fontSize: FONT_SIZE.xs + 1,
    fontWeight: FONT_WEIGHT.bold,
  },
  filtersToolbarControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
    flexGrow: 1,
    flexShrink: 1,
  },
  filtersToolbarControlsMobile: {
    width: '100%',
    justifyContent: 'flex-start',
  },
  filtersSortWrap: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  filtersSortLabel: {
    color: COLORS.secondaryText,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filtersSortScroll: {
    maxWidth: 460,
    flexGrow: 0,
    flexShrink: 1,
  },
  filtersSortChipRow: { gap: 6, paddingRight: 2 },
  filtersDirectionButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  filtersDirectionText: {
    color: COLORS.primaryText,
    fontSize: FONT_SIZE.xs + 1,
    fontWeight: FONT_WEIGHT.bold,
  },
  activeFilterSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  activeFilterPill: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.line,
    justifyContent: 'center',
  },
  activeFilterPillText: {
    color: COLORS.primaryText,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
  filtersClearButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  filtersClearText: {
    color: COLORS.primaryText,
    fontSize: FONT_SIZE.xs + 1,
    fontWeight: FONT_WEIGHT.bold,
  },
  filterSection: { gap: 8 },
  filterSectionTitle: {
    color: COLORS.primaryText,
    fontSize: FONT_SIZE.xs + 1,
    fontWeight: FONT_WEIGHT.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterSubsectionTitle: {
    width: '100%',
    color: COLORS.primaryText,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    marginTop: 4,
  },
  filterChipRow: { gap: 8, paddingRight: 8 },
  filterChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: COLORS.backgroundTop,
    borderWidth: 1,
    borderColor: 'rgba(245, 241, 234, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  filterChipCompact: {
    minHeight: 32,
    paddingHorizontal: 10,
  },
  filterChipActive: {
    backgroundColor: COLORS.orangeSoft,
    borderColor: COLORS.orangeBorder,
  },
  filterChipText: {
    color: COLORS.surface,
    fontSize: FONT_SIZE.xs + 1,
    fontWeight: FONT_WEIGHT.bold,
  },
  filterChipTextActive: { color: COLORS.primaryText },
  filtersAdvanced: { gap: 14, paddingTop: 4 },
  filtersQuickGrid: { gap: 12 },
  filtersQuickGridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  filtersInputGrid: { gap: 10 },
  filtersInputGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  filterInputWrap: {
    width: '100%',
    minWidth: 160,
    flexGrow: 1,
    flexBasis: '22%',
    gap: 5,
  },
  filterInputLabel: {
    color: COLORS.secondaryText,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
  },
  filterInput: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 12,
    color: COLORS.primaryText,
    fontSize: FONT_SIZE.sm,
  },
  shadowCard: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 8,
  },
  advancedToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(199, 138, 75, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(199, 138, 75, 0.25)',
    marginVertical: 4,
  },
  advancedToggleText: {
    color: COLORS.orange,
    fontSize: FONT_SIZE.xs + 1,
    fontWeight: FONT_WEIGHT.bold,
  },
});
