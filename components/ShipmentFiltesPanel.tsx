import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getActiveFilterSummary } from '../features/dashboard/filters';
import * as types from '../lib/shipmentType';
import { COLORS } from './ui/COLORS';

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
  const resultLabel = t('dashboard.filters.resultCount', {
    defaultValue: '{{visible}} de {{total}}',
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
    { value: 'created', label: t('dashboard.filters.createdAt', { defaultValue: 'Creación' }), icon: 'calendar-outline' },
    { value: 'do', label: 'DO', icon: 'file-tray-full-outline' },
    { value: 'status', label: t('dashboard.filters.statusDate', { defaultValue: 'Status' }), icon: 'pulse-outline' },
    { value: 'eta', label: 'ETA', icon: 'flag-outline' },
    { value: 'etd', label: 'ETD', icon: 'navigate-outline' },
    { value: 'free_days', label: t('dashboard.filters.freeDays', { defaultValue: 'Días libres' }), icon: 'hourglass-outline' },
  ];
  const statusOptions: { value: types.StatusGroupFilter; label: string }[] = [
    { value: 'all', label: t('dashboard.filters.all', { defaultValue: 'Todos' }) },
    { value: 'pending', label: t('dashboard.filters.pending', { defaultValue: 'Pendiente' }) },
    { value: 'inTransit', label: t('dashboard.filters.inTransit', { defaultValue: 'En tránsito' }) },
    { value: 'customs', label: t('dashboard.filters.customs', { defaultValue: 'Aduana' }) },
    { value: 'delivered', label: t('dashboard.filters.delivered', { defaultValue: 'Entregado' }) },
    { value: 'withoutStatus', label: t('dashboard.filters.withoutStatus', { defaultValue: 'Sin estado' }) },
  ];
  const milestoneOptions: { value: types.MilestoneFilter; label: string }[] = [
    { value: 'all', label: t('dashboard.filters.all', { defaultValue: 'Todos' }) },
    { value: 'withoutEta', label: t('dashboard.filters.withoutEta', { defaultValue: 'Sin ETA' }) },
    { value: 'withAtd', label: t('dashboard.filters.withAtd', { defaultValue: 'Con ATD' }) },
    { value: 'withAta', label: t('dashboard.filters.withAta', { defaultValue: 'Con ATA' }) },
    { value: 'overdueEta', label: t('dashboard.filters.overdueEta', { defaultValue: 'ETA vencida' }) },
  ];
  const directionLabel = filters.sortDirection === 'asc'
    ? t('dashboard.filters.ascending', { defaultValue: 'Asc' })
    : t('dashboard.filters.descending', { defaultValue: 'Desc' });
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
                  ? t('dashboard.filters.hide', { defaultValue: 'Ocultar' })
                  : activeFilterCount
                    ? t('dashboard.filters.edit', { defaultValue: 'Editar filtros' })
                    : t('dashboard.filters.title', { defaultValue: 'Filtros' })}
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
                {t('dashboard.filters.sortBy', { defaultValue: 'Orden' })}
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
                  {t('dashboard.filters.clear', { defaultValue: 'Limpiar' })}
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
            <FilterSection title={t('dashboard.filters.transport', { defaultValue: 'Vía' })}>
              <FilterChipRow>
                <FilterChip
                  label={t('dashboard.filters.all', { defaultValue: 'Todos' })}
                  active={filters.shipmentType === 'all'}
                  onPress={() => onChangeFilter('shipmentType', 'all')}
                />
                <FilterChip
                  icon="airplane-outline"
                  label={t('shipmentForm.options.shipmentType.air', { defaultValue: 'Aéreo' })}
                  active={filters.shipmentType === 'air'}
                  onPress={() => onChangeFilter('shipmentType', 'air')}
                />
                <FilterChip
                  icon="boat-outline"
                  label={t('shipmentForm.options.shipmentType.maritime', { defaultValue: 'Marítimo' })}
                  active={filters.shipmentType === 'maritime'}
                  onPress={() => onChangeFilter('shipmentType', 'maritime')}
                />
                <FilterChip
                  icon="car-outline"
                  label={t('shipmentForm.options.shipmentType.land', { defaultValue: 'Terrestre' })}
                  active={filters.shipmentType === 'land'}
                  onPress={() => onChangeFilter('shipmentType', 'land')}
                />
              </FilterChipRow>
            </FilterSection>

            <FilterSection title={t('dashboard.filters.status', { defaultValue: 'Estado' })}>
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

            <FilterSection title={t('dashboard.filters.milestones', { defaultValue: 'Hitos' })}>
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
          </View>

          <FilterSection title={t('dashboard.filters.dateRanges', { defaultValue: 'Fechas' })}>
            <View style={[styles.filtersInputGrid, isDesktop && styles.filtersInputGridDesktop]}>
              <FilterTextInput label="Creado desde" value={filters.createdFrom} onChangeText={(value) => onChangeFilter('createdFrom', value)} placeholder="YYYY-MM-DD" />
              <FilterTextInput label="Creado hasta" value={filters.createdTo} onChangeText={(value) => onChangeFilter('createdTo', value)} placeholder="YYYY-MM-DD" />
              <FilterTextInput label="Status desde" value={filters.statusFrom} onChangeText={(value) => onChangeFilter('statusFrom', value)} placeholder="YYYY-MM-DD" />
              <FilterTextInput label="Status hasta" value={filters.statusTo} onChangeText={(value) => onChangeFilter('statusTo', value)} placeholder="YYYY-MM-DD" />
              <FilterTextInput label="ETD desde" value={filters.etdFrom} onChangeText={(value) => onChangeFilter('etdFrom', value)} placeholder="YYYY-MM-DD" />
              <FilterTextInput label="ETD hasta" value={filters.etdTo} onChangeText={(value) => onChangeFilter('etdTo', value)} placeholder="YYYY-MM-DD" />
              <FilterTextInput label="ATA desde" value={filters.ataFrom} onChangeText={(value) => onChangeFilter('ataFrom', value)} placeholder="YYYY-MM-DD" />
              <FilterTextInput label="ATA hasta" value={filters.ataTo} onChangeText={(value) => onChangeFilter('ataTo', value)} placeholder="YYYY-MM-DD" />
              <FilterTextInput label="Cutoff desde" value={filters.cutoffFrom} onChangeText={(value) => onChangeFilter('cutoffFrom', value)} placeholder="YYYY-MM-DD" />
              <FilterTextInput label="Cutoff hasta" value={filters.cutoffTo} onChangeText={(value) => onChangeFilter('cutoffTo', value)} placeholder="YYYY-MM-DD" />
            </View>
          </FilterSection>

          <FilterSection title={t('dashboard.filters.operations', { defaultValue: 'Operación' })}>
            <View style={[styles.filtersInputGrid, isDesktop && styles.filtersInputGridDesktop]}>
              <FilterTextInput label="Estado exacto" value={filters.statusText} onChangeText={(value) => onChangeFilter('statusText', value)} placeholder="Pendiente, aduana..." />
              <FilterTextInput label="Origen" value={filters.origin} onChangeText={(value) => onChangeFilter('origin', value)} placeholder="MIA" />
              <FilterTextInput label="Destino" value={filters.destination} onChangeText={(value) => onChangeFilter('destination', value)} placeholder="BOG" />
              <FilterTextInput label="Ubicación" value={filters.location} onChangeText={(value) => onChangeFilter('location', value)} placeholder="Puerto, ciudad..." />
              <FilterTextInput label="Parte" value={filters.party} onChangeText={(value) => onChangeFilter('party', value)} placeholder="Exportador o consignatario" />
              <FilterTextInput label="Naviera/Aerolínea" value={filters.carrier} onChangeText={(value) => onChangeFilter('carrier', value)} placeholder="Carrier, vuelo, AWB..." />
              <FilterTextInput label="Incoterm" value={filters.incoterm} onChangeText={(value) => onChangeFilter('incoterm', value)} placeholder="FOB, CIF..." />
              <FilterTextInput label="Tipo carga" value={filters.cargoType} onChangeText={(value) => onChangeFilter('cargoType', value)} placeholder="General, peligrosa..." />
              <FilterTextInput label="Reserva" value={filters.bookingStatus} onChangeText={(value) => onChangeFilter('bookingStatus', value)} placeholder="Confirmada..." />
              <FilterTextInput label="Inspección" value={filters.inspectionStatus} onChangeText={(value) => onChangeFilter('inspectionStatus', value)} placeholder="Documental..." />
              <FilterTextInput label="Días libres mín." value={filters.freeDaysMin} onChangeText={(value) => onChangeFilter('freeDaysMin', value)} placeholder="0" keyboardType="numeric" />
              <FilterTextInput label="Días libres máx." value={filters.freeDaysMax} onChangeText={(value) => onChangeFilter('freeDaysMax', value)} placeholder="30" keyboardType="numeric" />
            </View>
          </FilterSection>
        </View>
      ) : null}
    </View>
  );
}

type FilterChipRowProps = {
  children: ReactNode;
};

function FilterChipRow({ children }: FilterChipRowProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
      {children}
    </ScrollView>
  );
}

type FilterChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: ComponentProps<typeof Ionicons>['name'];
  compact?: boolean;
};

function FilterChip({ label, active, onPress, icon, compact }: FilterChipProps) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, compact && styles.filterChipCompact, active && styles.filterChipActive]}
      onPress={onPress}
    >
      {icon ? <Ionicons name={icon} size={14} color={active ? COLORS.primaryText : COLORS.surface} /> : null}
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

type FilterTextInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric';
};

function FilterTextInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: FilterTextInputProps) {
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


type FilterSectionProps = {
  title: string;
  children: ReactNode;
};

function FilterSection({ title, children }: FilterSectionProps) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
    filtersCard: { 
        backgroundColor: COLORS.surface, 
        borderRadius: 22, 
        borderWidth: 1, 
        borderColor: COLORS.line, 
        padding: 12, 
        gap: 12 
    },
    filterSectionTitle: { 
        color: COLORS.secondaryText, 
        fontSize: 11, 
        fontWeight: '900', 
        textTransform: 'uppercase' 
    },
    filterSection: { gap: 8 },
    filterInputWrap: { 
        flexGrow: 1, 
        flexBasis: 170, 
        minWidth: 150, 
        gap: 5 
    },
    filterInputLabel: { 
        color: COLORS.secondaryText, 
        fontSize: 11, 
        fontWeight: '800' 
    },
    filterInput: { 
        minHeight: 42, 
        borderRadius: 12, 
        paddingHorizontal: 12, 
        backgroundColor: COLORS.surfaceAlt, 
        borderWidth: 1, 
        borderColor: COLORS.line, 
        color: COLORS.primaryText, 
        fontSize: 13, 
        fontWeight: '700' 
    },
    filtersInputGridDesktop: { 
        flexDirection: 'row', 
        flexWrap: 'wrap' 
    },
    filtersToolbar: { gap: 10 },
    filtersToolbarTop: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: 10, 
        flexWrap: 'wrap' 
    },
    filtersToolbarLead: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 10, 
        flexWrap: 'wrap', 
        flexShrink: 1 
    },
    filtersMainButton: { 
        minHeight: 40, 
        paddingHorizontal: 12, 
        borderRadius: 14, 
        backgroundColor: COLORS.orangeSoft, 
        borderWidth: 1, 
        borderColor: COLORS.orangeBorder, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: 7 
    },
    filtersMainButtonOpen: { 
        backgroundColor: COLORS.surfaceAlt, 
        borderColor: COLORS.orange 
    },
    filtersMainButtonActive: { borderColor: COLORS.orange },
    filtersMainButtonText: { 
        color: COLORS.primaryText, 
        fontSize: 13, 
        fontWeight: '900' 
    },
    filtersBadge: { 
        minWidth: 22, 
        height: 22, 
        paddingHorizontal: 6, 
        borderRadius: 11, 
        backgroundColor: COLORS.backgroundTop, 
        alignItems: 'center', 
        justifyContent: 'center' 
    },
    filtersBadgeText: { 
        color: COLORS.surface, 
        fontSize: 11, 
        fontWeight: '900' 
    },
    filtersResultText: { 
        color: COLORS.secondaryText, 
        fontSize: 12, 
        fontWeight: '800' 
    },
    filtersToolbarControls: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'flex-end', 
        gap: 8, 
        flexWrap: 'wrap', 
        flexGrow: 1, 
        flexShrink: 1 
    },
    filtersToolbarControlsMobile: { 
        width: '100%', 
        justifyContent: 'flex-start' 
    },
    filtersSortWrap: { 
        minWidth: 0, 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 8, 
        flexShrink: 1 
    },
    filtersSortLabel: { 
        color: COLORS.secondaryText, 
        fontSize: 11, 
        fontWeight: '900', 
        textTransform: 'uppercase' 
    },
    filtersSortScroll: { 
        maxWidth: 460, 
        flexGrow: 0,
        flexShrink: 1 
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
        gap: 6 
    },
    filtersDirectionText: { 
        color: COLORS.primaryText, 
        fontSize: 12, 
        fontWeight: '900' 
    },
    activeFilterSummary: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 6, 
        flexWrap: 'wrap' 
    },
    activeFilterPill: { 
        minHeight: 28, 
        paddingHorizontal: 10, 
        borderRadius: 999, 
        backgroundColor: COLORS.surfaceAlt, 
        borderWidth: 1, 
        borderColor: COLORS.line, 
        justifyContent: 'center' 
    },
    activeFilterPillText: { 
        color: COLORS.primaryText, 
        fontSize: 11, 
        fontWeight: '800' 
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
        gap: 6 
    },
    filtersClearText: { 
        color: COLORS.primaryText, 
        fontSize: 12, 
        fontWeight: '800' 
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
        gap: 6 
    },
    filterChipCompact: { 
        minHeight: 32, 
        paddingHorizontal: 10 
    },
    filterChipActive: { 
        backgroundColor: COLORS.orangeSoft, 
        borderColor: COLORS.orangeBorder 
    },
    filterChipText: { 
        color: COLORS.surface, 
        fontSize: 12, 
        fontWeight: '800' 
    },
    shadowCard: { 
        shadowColor: COLORS.shadow, 
        shadowOffset: { width: 0, height: 10 }, 
        shadowOpacity: 1, 
        shadowRadius: 22, 
        elevation: 8 
    },

    filterChipTextActive: { color: COLORS.primaryText },
    filtersAdvanced: { gap: 14, paddingTop: 4 },
    filtersQuickGrid: { gap: 12 },
    filtersQuickGridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
    filtersInputGrid: { gap: 10 },
})
