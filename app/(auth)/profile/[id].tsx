// Archivo: app/(auth)/profile/[id].tsx
// Descripcion: Pantalla de detalle de perfil. Muestra datos basicos y permite navegar a asignacion de carga.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    AUTH_COLORS,
    AUTH_SHADOW,
    AuthHeader,
    AuthHeaderAction,
    AuthScreenBackground,
} from '../../../components/auth/AuthChrome';
import { AUTH_MOBILE_DOCK_PADDING } from '../../../components/auth/AuthNavigation';
import { ShipmentTransportBadge } from '../../../components/auth/ShipmentTransportIcon';
import { useNativeNotification } from '../../../components/ui/NativeNotification';
import { useResponsive } from '../../../hooks/useResponsive';
import { supabase } from '../../../lib/URLs';

type Profile = {
  id: string;
  email: string;
  is_internal: boolean;
  nickname: string;
};

type AssignedShipment = {
  id: string;
  do_number: string;
  origin: string;
  destination: string;
  shipment_type?: string | null;
  current_status?: string | null;
  current_location?: string | null;
  air_waybill?: string | null;
  container_number?: string | null;
  eta?: string | null;
  created_at?: string | null;
};

export default function ProfileDetail() {
  const { t } = useTranslation();
  const notification = useNativeNotification();
  const { id } = useLocalSearchParams();
  const { height, isDesktop } = useResponsive();
  const profileId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';

  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignedShipments, setAssignedShipments] = useState<AssignedShipment[]>([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadProfileDetails();
  }, [id]);

  const loadProfileDetails = async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/login');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      if (!profileData.is_internal && profileId) {
        await loadAssignedShipments(profileId);
      } else {
        setAssignedShipments([]);
      }
    } catch {
      notification.error(t('profileDetail.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const loadAssignedShipments = async (clientId: string) => {
    try {
      setShipmentsLoading(true);

      const { data: relationData, error: relationError } = await supabase
        .from('profile_shipment')
        .select('shipment_id')
        .eq('client_id', clientId);

      if (relationError) throw relationError;

      const shipmentIds = (relationData ?? [])
        .map((row: { shipment_id: string }) => row.shipment_id)
        .filter(Boolean);

      if (!shipmentIds.length) {
        setAssignedShipments([]);
        return;
      }

      const { data: shipmentsData, error: shipmentsError } = await supabase
        .from('shipments')
        .select('id, do_number, origin, destination, shipment_type, current_status, current_location, air_waybill, container_number, eta, created_at')
        .in('id', shipmentIds)
        .order('created_at', { ascending: false });

      if (shipmentsError) throw shipmentsError;
      setAssignedShipments((shipmentsData as AssignedShipment[]) ?? []);
    } catch {
      setAssignedShipments([]);
    } finally {
      setShipmentsLoading(false);
    }
  };

  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/profiles');
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

  if (!profile) {
    return (
      <View style={[styles.center, styles.container]}>
        <AuthScreenBackground />
        <Text style={styles.emptyText}>{t('profileDetail.notFound')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { minHeight: height }]}>
      <AuthScreenBackground />
      <AuthHeader
        title={t('profileDetail.headerTitle')}
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
        <View style={[styles.heroCard, styles.shadowCard]}>
          <View style={styles.heroBadge}>
            <Ionicons
              name={profile.is_internal ? 'shield-checkmark-outline' : 'person-outline'}
              size={26}
              color={profile.is_internal ? AUTH_COLORS.green : AUTH_COLORS.blue}
            />
          </View>
          <Text style={styles.heroTitle}>{profile.nickname || t('profiles.unnamedProfile')}</Text>
          <Text style={styles.heroSubtitle}>{profile.email}</Text>

          <View style={[styles.rolePill, profile.is_internal ? styles.rolePillInternal : styles.rolePillExternal]}>
            <Text style={[styles.rolePillText, profile.is_internal ? styles.rolePillTextInternal : styles.rolePillTextExternal]}>
              {profile.is_internal ? t('profiles.internalRole') : t('profiles.externalRole')}
            </Text>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={[styles.section, styles.shadowCard]}>
            <Text style={styles.sectionTitle}>{t('profileDetail.sectionInfo')}</Text>
            <InfoRow label={t('profileDetail.email')} value={profile.email || ''} />
            <InfoRow label={t('profileDetail.alias')} value={profile.nickname || ''} />
          </View>

          {!profile.is_internal ? (
            <>
              <View style={[styles.section, styles.shadowCard]}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('profileDetail.sectionShipments')}</Text>
                  {shipmentsLoading ? <ActivityIndicator size="small" color={AUTH_COLORS.orange} /> : null}
                </View>

                {assignedShipments.length ? (
                  <ScrollView
                    style={styles.assignedShipmentScroll}
                    contentContainerStyle={styles.assignedShipmentList}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                  >
                    {assignedShipments.map((shipment) => (
                      <TouchableOpacity
                        key={shipment.id}
                        style={styles.shipmentCard}
                        onPress={() => router.push(`/shipment/${shipment.id}`)}
                      >
                        <ShipmentTransportBadge
                          shipment={shipment}
                          shipmentType={shipment.shipment_type}
                          color={AUTH_COLORS.primaryText}
                          size={18}
                          containerStyle={styles.shipmentIcon}
                        />
                        <View style={styles.shipmentCopy}>
                          <Text style={styles.shipmentTitle} numberOfLines={1}>{shipment.do_number}</Text>
                          <Text style={styles.shipmentRoute} numberOfLines={2}>
                            {shipment.origin} {'->'} {shipment.destination}
                          </Text>
                          {shipment.current_status || shipment.current_location ? (
                            <Text style={styles.shipmentMeta} numberOfLines={1}>
                              {[shipment.current_status, shipment.current_location].filter(Boolean).join(' · ')}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons name="chevron-forward-outline" size={18} color={AUTH_COLORS.secondaryText} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.sectionCopy}>
                    {shipmentsLoading ? t('profileDetail.shipmentsLoading') : t('profileDetail.shipmentsEmpty')}
                  </Text>
                )}
              </View>

              <View style={[styles.section, styles.shadowCard]}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() =>
                    router.push({
                      pathname: '/assignShipment',
                      params: { clientId: profileId },
                    } as any)
                  }
                  disabled={!profileId}
                >
                  <Ionicons name="link-outline" size={18} color={AUTH_COLORS.primaryText} />
                  <Text style={styles.primaryButtonText}>{t('dashboard.assignShipment')}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
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
  emptyText: {
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
    paddingHorizontal: 16,
    paddingTop: 18,
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
    alignItems: 'center',
  },
  heroBadge: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  heroSubtitle: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  rolePill: {
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  rolePillInternal: {
    backgroundColor: AUTH_COLORS.greenSoft,
  },
  rolePillExternal: {
    backgroundColor: AUTH_COLORS.blueSoft,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rolePillTextInternal: {
    color: AUTH_COLORS.green,
  },
  rolePillTextExternal: {
    color: AUTH_COLORS.blue,
  },
  grid: {
    gap: 18,
  },
  section: {
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    padding: 18,
    gap: 14,
  },
  sectionTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionCopy: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 14,
    lineHeight: 20,
  },
  assignedShipmentScroll: {
    flexGrow: 0,
    maxHeight: 340,
  },
  assignedShipmentList: {
    gap: 10,
    paddingRight: 4,
  },
  shipmentCard: {
    minHeight: 78,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shipmentIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: AUTH_COLORS.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shipmentCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  shipmentTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 16,
    fontWeight: '800',
  },
  shipmentRoute: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  shipmentMeta: {
    color: AUTH_COLORS.blue,
    fontSize: 12,
    fontWeight: '700',
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
  primaryButton: {
    minHeight: 52,
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
  primaryButtonText: {
    color: AUTH_COLORS.primaryText,
    fontSize: 14,
    fontWeight: '700',
  },
});
