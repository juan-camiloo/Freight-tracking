import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import { notifyShipmentEvent } from '../../lib/shipmentNotifications';
import { getShipmentStatusLabel } from '../../lib/shipmentType';
import { listProfilesFunctionUrl, supabase, supabaseAnonKey } from '../../lib/URLs';
import Header from '../Header';
import { useNativeNotification } from '../ui/NativeNotification';
import {
  AUTH_COLORS,
  AUTH_SHADOW,
  AuthScreenBackground
} from './AuthChrome';
import { AUTH_MOBILE_DOCK_PADDING } from './AuthNavigation';
import { AuthSearchBar } from './AuthSearchBar';
import { ShipmentTransportBadge } from './ShipmentTransportIcon';

// ProfileOption se conserva para retrocompatibilidad con flujos existentes.
type ProfileOption = {
  id: string;
  email: string | null;
  is_internal: boolean;
  nickname?: string | null;
};

// CompanyOption: nueva entidad principal de asignacion por empresa/grupo.
type CompanyOption = {
  id: string;
  name: string;
};

type ShipmentOption = {
  id: string;
  do_number: string;
  origin: string;
  destination: string;
  current_status?: string | null;
  eta?: string | null;
  shipment_type?: string | null;
  created_at?: string | null;
};

type ShipmentAssignmentWorkspaceProps = {
  /** @deprecated Usar initialCompanyId. Se mantiene para retrocompatibilidad. */
  initialClientId?: string | null;
  initialShipmentId?: string | null;
  /** ID de empresa preseleccionada (nuevo flujo). */
  initialCompanyId?: string | null;
};

const isAbortError = (error: unknown) =>
  error instanceof Error &&
  (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted'));

const getProfileLabel: any = (profile: ProfileOption | null, fallback: string) =>
  profile?.nickname?.trim() || profile?.email?.trim() || fallback;

export function ShipmentAssignmentWorkspace({
  initialClientId,
  initialShipmentId,
  initialCompanyId,
}: ShipmentAssignmentWorkspaceProps) {
  const { t } = useTranslation();
  const notification = useNativeNotification();
  const { height, isDesktop } = useResponsive();
  const clientListMaxHeight = isDesktop ? Math.max(280, Math.min(520, height - 390)) : 300;
  const shipmentListMaxHeight = isDesktop ? Math.max(360, Math.min(620, height - 390)) : 380;

  // ── Estado Empresas (nuevo flujo primario) ──────────────────────────────
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companyQuery, setCompanyQuery] = useState('');
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(
    () => new Set(initialCompanyId ? [initialCompanyId] : []),
  );

  // ── Estado Perfiles (flujo legacy — conservado para retrocompatibilidad) ─
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profileQuery, setProfileQuery] = useState('');
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(
    () => new Set(initialClientId ? [initialClientId] : []),
  );

  // ── Estado Cargas ────────────────────────────────────────────────────────
  const [shipments, setShipments] = useState<ShipmentOption[]>([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(true);
  const [shipmentQuery, setShipmentQuery] = useState('');
  const [searchingShipments, setSearchingShipments] = useState(false);

  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  // Clave = companyId o clientId (uuid); valor = set de shipment_ids asignados
  const [assignedShipmentIdsByKey, setAssignedShipmentIdsByKey] = useState<Record<string, Set<string>>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);

  // ── Memos: Empresas ──────────────────────────────────────────────────────
  const selectedCompanyIdsList = useMemo(() => Array.from(selectedCompanyIds), [selectedCompanyIds]);
  const selectedCompanies = useMemo(
    () => companies.filter(c => selectedCompanyIds.has(c.id)),
    [companies, selectedCompanyIds],
  );
  const visibleCompanies = useMemo(() => {
    const clean = companyQuery.trim().toLowerCase();
    return [...companies]
      .filter(c => !clean || c.name.toLowerCase().includes(clean))
      .sort((a, b) => {
        if (selectedCompanyIds.has(a.id) && !selectedCompanyIds.has(b.id)) return -1;
        if (!selectedCompanyIds.has(a.id) && selectedCompanyIds.has(b.id)) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [companies, companyQuery, selectedCompanyIds]);

  // ── Memos: Perfiles legacy ───────────────────────────────────────────────
  const selectedProfileIdsList = useMemo(() => Array.from(selectedProfileIds), [selectedProfileIds]);
  const selectedProfiles = useMemo(
    () => profiles.filter(p => selectedProfileIds.has(p.id)),
    [profiles, selectedProfileIds],
  );
  const clientProfiles = useMemo(() => profiles.filter(p => !p.is_internal), [profiles]);
  const visibleProfiles = useMemo(() => {
    const clean = profileQuery.trim().toLowerCase();
    const filtered = clean
      ? clientProfiles.filter(p => {
          const name = p.nickname?.toLowerCase() ?? '';
          const email = p.email?.toLowerCase() ?? '';
          return name.includes(clean) || email.includes(clean);
        })
      : clientProfiles;
    return [...filtered].sort((a, b) => {
      if (selectedProfileIds.has(a.id) && !selectedProfileIds.has(b.id)) return -1;
      if (!selectedProfileIds.has(a.id) && selectedProfileIds.has(b.id)) return 1;
      return getProfileLabel(a, '').localeCompare(getProfileLabel(b, ''));
    });
  }, [clientProfiles, profileQuery, selectedProfileIds]);

  // ── Memos: Cargas ────────────────────────────────────────────────────────
  // assignedShipmentIds unifica cargas asignadas por empresa + perfil legacy
  const assignedShipmentIds = useMemo(() => {
    const ids = new Set<string>();
    selectedCompanyIdsList.forEach(id => assignedShipmentIdsByKey[id]?.forEach(sid => ids.add(sid)));
    selectedProfileIdsList.forEach(id => assignedShipmentIdsByKey[id]?.forEach(sid => ids.add(sid)));
    return ids;
  }, [assignedShipmentIdsByKey, selectedCompanyIdsList, selectedProfileIdsList]);

  const visibleShipments = useMemo(
    () => [...shipments].sort((a, b) => {
      if (a.id === initialShipmentId) return -1;
      if (b.id === initialShipmentId) return 1;
      const aA = assignedShipmentIds.has(a.id);
      const bA = assignedShipmentIds.has(b.id);
      if (aA !== bA) return aA ? 1 : -1;
      return (b.created_at ?? '').localeCompare(a.created_at ?? '');
    }),
    [assignedShipmentIds, initialShipmentId, shipments],
  );

  const selectedCompaniesLabel =
    selectedCompanies.length === 1
      ? selectedCompanies[0].name
      : selectedCompanies.length > 1
        ? t('assignShipment.selectedClientsCount', { count: selectedCompanies.length })
        : null;

  const selectedProfilesLabel =
    selectedProfiles.length === 1
      ? getProfileLabel(selectedProfiles[0], t('profiles.unnamedProfile'))
      : t('assignShipment.selectedClientsCount', { count: selectedProfiles.length });

  // ── Helpers ──────────────────────────────────────────────────────────────
  const resolveErrorMessage = useCallback(async (response: Response, fallbackMessage: string) => {
    try {
      const text = await response.text();
      if (!text) return fallbackMessage;
      try {
        const payload = JSON.parse(text);
        if (typeof payload?.error_key === 'string') return t(payload.error_key, payload.error_params ?? {});
        if (typeof payload?.reason_key === 'string') return t(payload.reason_key, payload.reason_params ?? {});
        if (typeof payload?.error === 'string') return payload.error;
        if (typeof payload?.reason === 'string') return payload.reason;
      } catch {
        return text;
      }
    } catch { /* ignore */ }
    return fallbackMessage;
  }, [t]);

  // ── Cargas de datos ──────────────────────────────────────────────────────
  const loadCompanies = useCallback(async () => {
    try {
      setCompaniesLoading(true);
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .order('name', { ascending: true });
      if (error) throw error;
      setCompanies((data as CompanyOption[]) ?? []);
    } catch {
      notification.error(t('companies.loadError'));
    } finally {
      setCompaniesLoading(false);
    }
  }, [notification, t]);

  const loadProfiles = useCallback(async () => {
    try {
      setProfilesLoading(true);
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) { notification.error(t('profiles.noSession')); return; }
      const response = await fetch(listProfilesFunctionUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, apikey: supabaseAnonKey, 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const msg = await resolveErrorMessage(response, t('profiles.loadError'));
        throw new Error(msg);
      }
      setProfiles((await response.json()) as ProfileOption[] ?? []);
    } catch (error) {
      if (isAbortError(error)) return;
      notification.error(error instanceof Error ? error.message : t('assignShipment.loadProfilesError'));
    } finally {
      setProfilesLoading(false);
    }
  }, [notification, resolveErrorMessage, t]);

  const loadShipments = useCallback(async (cleanQuery: string) => {
    try {
      cleanQuery ? setSearchingShipments(true) : setShipmentsLoading(true);
      let q = supabase
        .from('shipments')
        .select('id, do_number, origin, destination, current_status, eta, shipment_type, created_at')
        .eq('status', 'active').order('created_at', { ascending: false }).limit(30);
      if (cleanQuery) q = q.or(`do_number.ilike.%${cleanQuery}%,origin.ilike.%${cleanQuery}%,destination.ilike.%${cleanQuery}%`);
      const { data, error } = await q;
      if (error) throw error;
      setShipments((data as ShipmentOption[]) ?? []);
    } catch (error) {
      if (isAbortError(error)) return;
      notification.error(t('assignShipment.loadShipmentsError'));
    } finally {
      setShipmentsLoading(false);
      setSearchingShipments(false);
    }
  }, [notification, t]);

  // Carga asignaciones retrocompatible: consulta company_shipment Y profile_shipment
  const loadAssignedShipments = useCallback(async (companyIds: string[], clientIds: string[]) => {
    try {
      setAssignmentsLoading(true);
      const next: Record<string, Set<string>> = {};

      // Nuevo: por empresa
      if (companyIds.length) {
        const { data } = await supabase
          .from('company_shipment')
          .select('company_id, shipment_id')
          .in('company_id', companyIds);
        companyIds.forEach(id => { next[id] = new Set(); });
        (data ?? []).forEach((row: { company_id: string; shipment_id: string }) => {
          if (!next[row.company_id]) next[row.company_id] = new Set();
          next[row.company_id].add(row.shipment_id);
        });
      }

      // Legacy: por perfil
      if (clientIds.length) {
        const { data } = await supabase
          .from('profile_shipment')
          .select('client_id, shipment_id')
          .in('client_id', clientIds);
        clientIds.forEach(id => { next[id] = new Set(); });
        (data ?? []).forEach((row: { client_id: string; shipment_id: string }) => {
          if (!next[row.client_id]) next[row.client_id] = new Set();
          next[row.client_id].add(row.shipment_id);
        });
      }
      setAssignedShipmentIdsByKey(next);
    } catch (error) {
      if (isAbortError(error)) return;
      setAssignedShipmentIdsByKey({});
    } finally {
      setAssignmentsLoading(false);
    }
  }, []);

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => { void loadCompanies(); }, [loadCompanies]);
  useEffect(() => { void loadProfiles(); }, [loadProfiles]);
  useEffect(() => {
    if (initialCompanyId) setSelectedCompanyIds(prev => { const n = new Set(prev); n.add(initialCompanyId); return n; });
  }, [initialCompanyId]);
  useEffect(() => {
    if (initialClientId) setSelectedProfileIds(prev => { const n = new Set(prev); n.add(initialClientId); return n; });
  }, [initialClientId]);
  useEffect(() => {
    const t = setTimeout(() => void loadShipments(shipmentQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [loadShipments, shipmentQuery]);
  useEffect(() => {
    if (!selectedCompanyIdsList.length && !selectedProfileIdsList.length) {
      setAssignedShipmentIdsByKey({});
      return;
    }
    void loadAssignedShipments(selectedCompanyIdsList, selectedProfileIdsList);
  }, [loadAssignedShipments, selectedCompanyIdsList, selectedProfileIdsList]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const toggleCompanySelection = (companyId: string) => {
    setSelectedCompanyIds(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) next.delete(companyId); else next.add(companyId);
      return next;
    });
  };

  const toggleProfileSelection = (profileId: string) => {
    setSelectedProfileIds(prev => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId); else next.add(profileId);
      return next;
    });
  };

  const handleAssign = async (shipment: ShipmentOption) => {
    const hasCompanies = selectedCompanyIdsList.length > 0;
    const hasProfiles = selectedProfileIdsList.length > 0;

    if (!hasCompanies && !hasProfiles) {
      notification.error(t('assignShipment.selectClientRequired'));
      return;
    }

    try {
      setAssigningId(shipment.id);

      // Asignacion por empresa (nuevo)
      const companiesToAssign = selectedCompanyIdsList.filter(
        id => !assignedShipmentIdsByKey[id]?.has(shipment.id),
      );
      if (companiesToAssign.length) {
        const { error } = await supabase
          .from('company_shipment')
          .upsert(
            companiesToAssign.map(company_id => ({ company_id, shipment_id: shipment.id })),
            { onConflict: 'company_id,shipment_id' },
          );
        if (error) throw error;
        setAssignedShipmentIdsByKey(prev => {
          const next = { ...prev };
          companiesToAssign.forEach(id => {
            const cur = new Set(next[id] ?? []);
            cur.add(shipment.id);
            next[id] = cur;
          });
          return next;
        });
      }

      // Asignacion por perfil legacy
      const targetProfiles = selectedProfiles.filter(
        p => !assignedShipmentIdsByKey[p.id]?.has(shipment.id),
      );
      if (targetProfiles.length) {
        const { error } = await supabase
          .from('profile_shipment')
          .upsert(
            targetProfiles.map(p => ({ client_id: p.id, shipment_id: shipment.id })),
            { onConflict: 'client_id,shipment_id' },
          );
        if (error) throw error;
        setAssignedShipmentIdsByKey(prev => {
          const next = { ...prev };
          targetProfiles.forEach(p => {
            const cur = new Set(next[p.id] ?? []);
            cur.add(shipment.id);
            next[p.id] = cur;
          });
          return next;
        });
      }

      // Notificacion: notifica a los miembros de las empresas asignadas + perfiles directos
      const targetUserIdsForNotif = targetProfiles.map(p => p.id);
      void notifyShipmentEvent({
        eventType: 'assigned',
        shipmentId: shipment.id,
        targetUserIds: targetUserIdsForNotif,
        doNumber: shipment.do_number,
      }).catch(e => console.error('Error notificando asignacion de carga:', e));

      const assignedLabel = selectedCompaniesLabel
        ?? (targetProfiles.length === 1
          ? getProfileLabel(targetProfiles[0], t('profiles.unnamedProfile'))
          : t('assignShipment.selectedClientsCount', { count: targetProfiles.length }));

      notification.success(
        t('assignShipment.assignedOk', { doNumber: shipment.do_number, profileName: assignedLabel }),
      );
    } catch (error) {
      console.error('Error asignando carga:', error);
      notification.error(t('assignShipment.assignError'));
    } finally {
      setAssigningId(null);
    }
  };

  const backFunction = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // ── Render ───────────────────────────────────────────────────────────────
  // Panel izquierdo: muestra empresas primero; los perfiles legacy se muestran debajo si hay alguno seleccionado
  const activeEntityLabel = selectedCompaniesLabel
    ?? (selectedProfiles.length ? selectedProfilesLabel : null);

  return (
    <View style={[styles.container, { minHeight: height }]}>
      <AuthScreenBackground />
      <Header
        isDesktop={isDesktop}
        title={t('dashboard.assignShipment')}
        showSearch={false}
        onGoBack={backFunction}
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
        {/* Resumen de seleccion */}
        <View style={[styles.summaryCard, styles.shadowCard]}>
          <View style={styles.summaryItem}>
            <View style={styles.summaryIcon}>
              <Ionicons name="business-outline" size={18} color={AUTH_COLORS.blue} />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>{t('assignShipment.selectedClients')}</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {activeEntityLabel ?? t('assignShipment.noClientSelected')}
              </Text>
            </View>
          </View>

          <View style={styles.summaryItem}>
            <View style={styles.summaryIcon}>
              {assignmentsLoading ? (
                <ActivityIndicator size="small" color={AUTH_COLORS.orange} />
              ) : (
                <Ionicons name="checkmark-done-outline" size={18} color={AUTH_COLORS.green} />
              )}
            </View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>{t('assignShipment.assignedToClient')}</Text>
              <Text style={styles.summaryValue}>{assignedShipmentIds.size}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.workspace, isDesktop && styles.workspaceDesktop]}>
          {/* Panel izquierdo: Empresas */}
          <View style={[styles.section, styles.shadowCard, isDesktop && styles.clientColumn]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('companies.header')}</Text>
              {companiesLoading ? <ActivityIndicator size="small" color={AUTH_COLORS.orange} /> : null}
            </View>

            <AuthSearchBar
              value={companyQuery}
              onChangeText={setCompanyQuery}
              placeholder={t('companies.searchPlaceholder')}
              searching={companiesLoading}
            />

            <ScrollView
              style={[styles.innerListScroll, { maxHeight: clientListMaxHeight }]}
              contentContainerStyle={styles.listStack}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {visibleCompanies.map(company => {
                const active = selectedCompanyIds.has(company.id);
                return (
                  <TouchableOpacity
                    key={company.id}
                    style={[styles.profileOption, active && styles.profileOptionActive]}
                    onPress={() => toggleCompanySelection(company.id)}
                  >
                    <View style={styles.optionBadge}>
                      <Ionicons name="business-outline" size={18} color={AUTH_COLORS.blue} />
                    </View>
                    <View style={styles.optionCopy}>
                      <Text style={styles.optionTitle} numberOfLines={1}>{company.name}</Text>
                    </View>
                    {active ? <Ionicons name="checkmark-circle" size={20} color={AUTH_COLORS.orange} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {!companiesLoading && !visibleCompanies.length ? (
              <View style={styles.emptyState}>
                <Ionicons name="business-outline" size={24} color={AUTH_COLORS.secondaryText} />
                <Text style={styles.emptyText}>
                  {companyQuery.trim() ? t('companies.noCompaniesFound') : t('companies.empty')}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Panel derecho: Cargas */}
          <View style={[styles.section, styles.shadowCard, styles.shipmentColumn]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{t('assignShipment.stepShipment')}</Text>
              </View>
              {shipmentsLoading ? <ActivityIndicator size="small" color={AUTH_COLORS.orange} /> : null}
            </View>

            <AuthSearchBar
              value={shipmentQuery}
              onChangeText={setShipmentQuery}
              placeholder={t('assignShipment.searchPlaceholder')}
              searching={searchingShipments}
            />

            <ScrollView
              style={[styles.innerListScroll, { maxHeight: shipmentListMaxHeight }]}
              contentContainerStyle={styles.shipmentList}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {visibleShipments.map(shipment => {
                const assignedCount =
                  selectedCompanyIdsList.filter(id => assignedShipmentIdsByKey[id]?.has(shipment.id)).length +
                  selectedProfileIdsList.filter(id => assignedShipmentIdsByKey[id]?.has(shipment.id)).length;
                const totalSelected = selectedCompanyIdsList.length + selectedProfileIdsList.length;
                const assigned = totalSelected > 0 && assignedCount === totalSelected;
                const partiallyAssigned = assignedCount > 0 && !assigned;
                const assigning = assigningId === shipment.id;
                const buttonDisabled = totalSelected === 0 || assigned || assigning;
                const highlighted = shipment.id === initialShipmentId;

                return (
                  <View
                    key={shipment.id}
                    style={[
                      styles.shipmentCard,
                      assigned && styles.shipmentCardAssigned,
                      highlighted && styles.shipmentCardHighlighted,
                    ]}
                  >
                    <View style={styles.shipmentInfo}>
                      <View style={styles.shipmentTitleRow}>
                        <Text style={styles.shipmentTitle} numberOfLines={1}>{shipment.do_number}</Text>
                        {assigned ? (
                          <View style={styles.assignedPill}>
                            <Text style={styles.assignedPillText}>{t('assignShipment.assigned')}</Text>
                          </View>
                        ) : partiallyAssigned ? (
                          <View style={styles.partialPill}>
                            <Text style={styles.partialPillText}>{t('assignShipment.partialAssigned')}</Text>
                          </View>
                        ) : null}
                        <ShipmentTransportBadge
                          shipment={shipment}
                          shipmentType={shipment.shipment_type}
                          color={AUTH_COLORS.primaryText}
                          size={18}
                          containerStyle={styles.shipmentTransportBadge}
                        />
                      </View>
                      <Text style={styles.shipmentRoute} numberOfLines={2}>
                        {shipment.origin} {'→'} {shipment.destination}
                      </Text>
                      <View style={styles.shipmentMetaRow}>
                        {shipment.current_status ? <Text style={styles.shipmentMeta} numberOfLines={1}>{getShipmentStatusLabel(shipment.current_status, t)}</Text> : null}
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[styles.assignButton, buttonDisabled && styles.assignButtonDisabled]}
                      onPress={() => handleAssign(shipment)}
                      disabled={buttonDisabled}
                    >
                      <Ionicons
                        name={assigned ? 'checkmark-outline' : 'link-outline'}
                        size={16}
                        color={AUTH_COLORS.primaryText}
                      />
                      <Text style={styles.assignButtonText}>
                        {assigning
                          ? t('assignShipment.assigning')
                          : assigned
                            ? t('assignShipment.assigned')
                            : totalSelected > 1
                              ? t('assignShipment.assignToSelected')
                              : totalSelected === 1
                                ? t('assignShipment.assign')
                                : t('assignShipment.selectClientShort')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>

            {!shipmentsLoading && !visibleShipments.length ? (
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={24} color={AUTH_COLORS.secondaryText} />
                <Text style={styles.emptyText}>{t('dashboard.shipmentNotFound')}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>      
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AUTH_COLORS.backgroundBottom, overflow: 'hidden' },
  scroll: { flex: 1 },
  content: { gap: 18, paddingBottom: 28 },
  contentDesktop: { paddingHorizontal: 28, paddingTop: 24 },
  contentMobile: { paddingHorizontal: 16, paddingTop: 18 },
  contentWithDock: { paddingBottom: AUTH_MOBILE_DOCK_PADDING },
  shadowCard: AUTH_SHADOW,
  summaryCard: { backgroundColor: AUTH_COLORS.surface, borderRadius: 24, borderWidth: 1, borderColor: AUTH_COLORS.line, padding: 16, gap: 12 },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  summaryIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: AUTH_COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryLabel: { color: AUTH_COLORS.secondaryText, fontSize: 12, fontWeight: '700' },
  summaryValue: { color: AUTH_COLORS.primaryText, fontSize: 16, fontWeight: '800', marginTop: 3 },
  workspace: { gap: 18 },
  workspaceDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  section: { backgroundColor: AUTH_COLORS.surface, borderRadius: 24, borderWidth: 1, borderColor: AUTH_COLORS.line, padding: 16, gap: 14 },
  clientColumn: { width: 380, flexShrink: 0 },
  shipmentColumn: { flex: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  sectionTitle: { color: AUTH_COLORS.primaryText, fontSize: 18, fontWeight: '800' },
  sectionSubtitle: { color: AUTH_COLORS.secondaryText, fontSize: 12, fontWeight: '700', marginTop: 4 },
  listStack: { gap: 10, paddingRight: 4 },
  innerListScroll: { flexGrow: 0 },
  profileOption: { minHeight: 64, borderRadius: 18, borderWidth: 1, borderColor: AUTH_COLORS.line, backgroundColor: AUTH_COLORS.surfaceAlt, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileOptionActive: { borderColor: AUTH_COLORS.orangeBorder, backgroundColor: AUTH_COLORS.orangeSoft },
  optionBadge: { width: 38, height: 38, borderRadius: 13, backgroundColor: AUTH_COLORS.blueSoft, alignItems: 'center', justifyContent: 'center' },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: { color: AUTH_COLORS.primaryText, fontSize: 15, fontWeight: '800' },
  optionSub: { color: AUTH_COLORS.secondaryText, fontSize: 12, marginTop: 3 },
  shipmentList: { gap: 12, paddingRight: 4 },
  shipmentCard: { borderRadius: 18, borderWidth: 1, borderColor: AUTH_COLORS.line, backgroundColor: AUTH_COLORS.surfaceAlt, padding: 14, gap: 12 },
  shipmentCardAssigned: { opacity: 0.72 },
  shipmentCardHighlighted: { borderColor: AUTH_COLORS.orangeBorder },
  shipmentInfo: { gap: 5 },
  shipmentTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  shipmentTitle: { flex: 1, color: AUTH_COLORS.primaryText, fontSize: 18, fontWeight: '800' },
  shipmentRoute: { color: AUTH_COLORS.secondaryText, fontSize: 13, lineHeight: 19 },
  shipmentMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shipmentMeta: { color: AUTH_COLORS.blue, fontSize: 12, fontWeight: '700', backgroundColor: AUTH_COLORS.blueSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  assignedPill: { borderRadius: 999, backgroundColor: AUTH_COLORS.greenSoft, paddingHorizontal: 10, paddingVertical: 6 },
  assignedPillText: { color: AUTH_COLORS.green, fontSize: 12, fontWeight: '800' },
  partialPill: { borderRadius: 999, backgroundColor: AUTH_COLORS.blueSoft, paddingHorizontal: 10, paddingVertical: 6 },
  partialPillText: { color: AUTH_COLORS.blue, fontSize: 12, fontWeight: '800' },
  shipmentTransportBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: AUTH_COLORS.orangeSoft, borderWidth: 1, borderColor: AUTH_COLORS.orangeBorder },
  assignButton: { minHeight: 44, borderRadius: 14, paddingHorizontal: 14, backgroundColor: AUTH_COLORS.orangeSoft, borderWidth: 1, borderColor: AUTH_COLORS.orangeBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  assignButtonDisabled: { opacity: 0.6 },
  assignButtonText: { color: AUTH_COLORS.primaryText, fontSize: 13, fontWeight: '700' },
  emptyState: { borderRadius: 18, borderWidth: 1, borderColor: AUTH_COLORS.line, backgroundColor: AUTH_COLORS.surfaceAlt, padding: 18, alignItems: 'center', gap: 8 },
  emptyText: { color: AUTH_COLORS.secondaryText, fontSize: 14, textAlign: 'center' },

});