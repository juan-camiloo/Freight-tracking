import type { ShipmentListItem } from '@/lib/shipmentType';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AuthSearchBar } from './auth/AuthSearchBar';
import LogoCorner from './LogoCorner';
import { NewsTrigger } from './news/NewsButton';
import { COLORS } from './ui/COLORS';

type DashboardHeaderProps = {
  isDesktop: boolean;
  title?: string;
  searchQuery?: string;
  searching?: boolean;
  isInternal?: boolean;
  selectedShipment?: ShipmentListItem;
  selectedShipmentId?: string;
  canRequestWebNotifications?: boolean;
  showSearch?: boolean;
  showActions?: boolean;
  showNotifications?: boolean;
  showGoBack?: boolean;
  showNews?: boolean;
  onSearchChange?: (value: string) => void;
  onGoBack?: () => void;
  onSubmitSearch?: (value: string) => void;
  onEnableNotifications?: () => void;
  onToggleLanguage?: () => void;
  onLogout?: () => void;
};

export default function Header({
  isDesktop,
  title,
  searchQuery = '',
  searching = false,
  isInternal = false,
  selectedShipment,
  selectedShipmentId,
  showSearch = true,
  showActions = true,
  onSearchChange,
  onGoBack,
  onSubmitSearch,
  onToggleLanguage,
  onLogout,
  showNews = false,
}: DashboardHeaderProps) {
    const { t } = useTranslation();
    
    return (
        <View style={[styles.header, isDesktop && styles.headerDesktop]}>
            <View style={[styles.brandBar, isDesktop && styles.brandBarDesktop]}>
            <LogoCorner inline size={isDesktop ? 148 : 96} />
            {isDesktop ?(
            <View style={[styles.brandWrap, { flex: 1, minWidth: 0, flexShrink: 2 }]}>
                <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={styles.brandTitle}>
                        {title || (isInternal ? t('dashboard.headerInternal') : t('dashboard.headerExternal'))}
                    </Text>
                </View>
            </View>
            ): null}
            {showNews ? (
                <NewsTrigger />
            ) : null}
            {isDesktop && showActions ? (
                <View style={styles.headerActions}>
                {onToggleLanguage ? (
                  <TouchableOpacity style={styles.iconAction} onPress={onToggleLanguage}>
                    <Ionicons name="globe-outline" size={18} color={COLORS.surface} />
                    <Text style={styles.iconActionText}>ES/EN</Text>
                  </TouchableOpacity>
                ) : null}
                {onLogout ? (
                  <TouchableOpacity style={styles.iconAction} onPress={onLogout}>
                    <Ionicons name="log-out-outline" size={18} color={COLORS.surface} />
                    <Text style={styles.iconActionText}>{t('common.logout')}</Text>
                  </TouchableOpacity>
                ) : null}
                {onGoBack? (
                    <TouchableOpacity style={styles.iconAction} onPress={onGoBack}>
                        <Ionicons name="arrow-back-outline" size={18} color={COLORS.surface} />
                        <Text style={styles.iconActionText}>{t('common.back')}</Text>
                    </TouchableOpacity>
                ): null}
                </View>
            ) : null}
            </View>
            <View style={styles.headerActions}></View>
            {showSearch ? (
              <View style={[styles.topControls, isDesktop && styles.topControlsDesktop]}>
              <View style={styles.searchArea}>
                  <AuthSearchBar
                  tone="dark"
                  value={searchQuery}
                  onChangeText={onSearchChange || (() => {})}
                  placeholder={t('dashboard.searchPlaceholder')}
                  helperText={t('dashboard.searchHint')}
                  onSubmitEditing={() => {
                      const clean = searchQuery.trim();
                      if (clean && onSubmitSearch) void onSubmitSearch(clean);
                  }}
                  searching={searching}
                  />
              </View>

              <View style={styles.actionsColumn}>
                  {selectedShipment ? (
                  <TouchableOpacity
                      style={styles.primaryHeaderButton}
                      onPress={() => router.push(`/shipment/${selectedShipmentId}`)}
                  >
                      <Ionicons name="open-outline" size={18} color={COLORS.primaryText} />
                      <Text style={styles.primaryHeaderButtonText}>{t('dashboard.openDetail')}</Text>
                  </TouchableOpacity>
                  ) : null}

                  {isInternal ? (
                  <View style={styles.secondaryActionRow}>
                      <TouchableOpacity
                      style={styles.secondaryHeaderButton}
                      onPress={() => router.push('/createShipment')}
                      >
                      <Ionicons name="add-circle-outline" size={16} color={COLORS.surface} />
                      <Text style={styles.secondaryHeaderButtonText}>{t('dashboard.createShipment')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                      style={styles.secondaryHeaderButton}
                      onPress={() => router.push('/supportInbox' as any)}
                      >
                      <Ionicons name="notifications-outline" size={16} color={COLORS.surface} />
                      <Text style={styles.secondaryHeaderButtonText}>{t('dashboard.fabTickets')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                      style={styles.secondaryHeaderButton}
                      onPress={() => router.push('/addUser')}
                      >
                      <Ionicons name="person-add-outline" size={16} color={COLORS.surface} />
                      <Text style={styles.secondaryHeaderButtonText}>{t('dashboard.addUser')}</Text>
                      </TouchableOpacity>
                  </View>
                  ) : (
                  <TouchableOpacity
                      style={styles.secondaryHeaderButton}
                      onPress={() => router.push('/createTicket')}
                  >
                      <Ionicons name="help-circle-outline" size={16} color={COLORS.surface} />
                      <Text style={styles.secondaryHeaderButtonText}>{t('dashboard.fabCreateTicket')}</Text>
                  </TouchableOpacity>
                  )}
              </View>
              </View>
            ) : null}
        </View>
    );
}
const styles = StyleSheet.create({
    header: { 
        paddingTop: 26, 
        paddingHorizontal: 18, 
        paddingBottom: 18, 
        gap: 14, 
        backgroundColor: COLORS.backgroundTop, 
        borderBottomLeftRadius: 26, 
        borderBottomRightRadius: 26 
    },
    headerDesktop: { 
        paddingTop: 28, 
        paddingHorizontal: 28, 
        paddingBottom: 20, 
        borderBottomLeftRadius: 0, 
        borderBottomRightRadius: 0 
    },
    brandBar: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: 16, 
        flexWrap: 'wrap' 
    },
    brandBarDesktop: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between' 
    },
    brandWrap: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 14 
    },
    brandTitle: { 
        color: COLORS.white, 
        fontSize: 20, 
        fontWeight: '800', 
        textAlign: 'center', 
        flexShrink: 1 
    },
    headerActions: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 10, 
        flexWrap: 'wrap' 
    },
    iconAction: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 6, 
        paddingHorizontal: 12, 
        paddingVertical: 8, 
        borderRadius: 999, 
        backgroundColor: 'rgba(245, 241, 234, 0.08)' 
    },
    iconActionText: { 
        color: COLORS.surface, 
        fontSize: 12, 
        fontWeight: '700' 
    },
    topControls: { gap: 12 },
    topControlsDesktop: { flexDirection: 'row', alignItems: 'stretch' },
    searchArea: { flex: 1 },
    actionsColumn: {
        gap: 10,
        justifyContent: 'flex-start',
    },
    headerUtilityGroup: { gap: 10, alignSelf: 'stretch' },
    headerUtilityGroupDesktop: { 
        width: 640, 
        flexShrink: 0 
    },
    notificationHeaderButton: { 
        minHeight: 44, 
        borderRadius: 14, 
        paddingHorizontal: 14, 
        backgroundColor: COLORS.orangeSoft, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: 8, 
        borderWidth: 1, 
        borderColor: COLORS.orangeBorder, 
        alignSelf: 'stretch' 
    },
    notificationHeaderButtonText: { 
        color: COLORS.primaryText, 
        fontSize: 13, 
        fontWeight: '800', 
        textAlign: 'center' 
    },
    secondaryHeaderButtonText: { 
        color: COLORS.surface, 
        fontSize: 13, 
        fontWeight: '700', 
        textAlign: 'center' 
    },
    secondaryHeaderButton: { 
        flex: 1, 
        minWidth: 142, 
        minHeight: 46, 
        borderRadius: 14, 
        paddingHorizontal: 14, 
        backgroundColor: 'rgba(245, 241, 234, 0.1)', 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: 8, 
        borderWidth: 1, 
        borderColor: 'rgba(245, 241, 234, 0.12)' 
    },
    secondaryActionRow: { 
        flexDirection: 'row', 
        gap: 10, 
        flexWrap: 'wrap' 
    },
    primaryHeaderButtonText: { 
        color: COLORS.primaryText, 
        fontSize: 14, 
        fontWeight: '700' 
    },
    primaryHeaderButton: { 
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
        alignSelf: 'stretch' 
    },
})