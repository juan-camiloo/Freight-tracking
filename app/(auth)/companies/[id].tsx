import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import {
    AUTH_COLORS,
    AUTH_SHADOW,
    AuthScreenBackground,
} from "../../../components/auth/AuthChrome";
import { AUTH_MOBILE_DOCK_PADDING } from "../../../components/auth/AuthNavigation";
import { AuthSearchBar } from "../../../components/auth/AuthSearchBar";
import Header from "../../../components/Header";
import { useNativeNotification } from "../../../components/ui/NativeNotification";
import { FONT_SIZE, FONT_WEIGHT } from "../../../components/ui/TYPOGRAPHY";
import { useResponsive } from "../../../hooks/useResponsive";
import { getShipmentStatusLabel } from "../../../lib/shipmentType";
import { supabase } from "../../../lib/URLs";

type Company = { id: string; name: string; created_at: string };
type Member = { id: string; email: string | null; nickname: string | null; is_internal: boolean };
type Shipment = { id: string; do_number: string; origin: string; destination: string; current_status: string | null };
type AvailableProfile = { id: string; email: string | null; nickname: string | null };

export default function CompanyDetailScreen() {
    const { t } = useTranslation();
    const notification = useNativeNotification();
    const { id } = useLocalSearchParams();
    const { height, isDesktop } = useResponsive();
    const companyId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";

    const [company, setCompany] = useState<Company | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [loading, setLoading] = useState(true);

    // Estado para edición de nombre de empresa
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState("");
    const [savingName, setSavingName] = useState(false);

    // Estado para agregar miembro y buscador
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [availableProfiles, setAvailableProfiles] = useState<AvailableProfile[]>([]);
    const [loadingProfiles, setLoadingProfiles] = useState(false);
    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const [addingMemberId, setAddingMemberId] = useState<string | null>(null);

    // Estado para desasignar carga y eliminar empresa
    const [unassigningShipmentId, setUnassigningShipmentId] = useState<string | null>(null);
    const [deletingCompany, setDeletingCompany] = useState(false);

    const backFunction = () => {
        if (router.canGoBack()) router.back();
        else router.replace("/companies" as any);
    };

    const loadAll = useCallback(async () => {
        try {
            setLoading(true);

            const [companyRes, membersRes, shipmentsRes] = await Promise.all([
                supabase.from("companies").select("id, name, created_at").eq("id", companyId).single(),
                supabase.from("profiles").select("id, email, nickname, is_internal").eq("company_id", companyId),
                supabase
                    .from("company_shipment")
                    .select("shipments(id, do_number, origin, destination, current_status)")
                    .eq("company_id", companyId),
            ]);

            if (companyRes.error) throw companyRes.error;
            setCompany(companyRes.data);
            setNameDraft(companyRes.data.name);
            setMembers((membersRes.data as Member[]) ?? []);

            const rawShipments = (shipmentsRes.data ?? [])
                .map((row: any) => row.shipments)
                .filter(Boolean) as Shipment[];
            setShipments(rawShipments);
        } catch {
            notification.error(t("companies.loadError"));
        } finally {
            setLoading(false);
        }
    }, [companyId, notification, t]);

    useEffect(() => { void loadAll(); }, [loadAll]);

    // Filtrado en vivo de perfiles en el modal
    const filteredAvailableProfiles = useMemo(() => {
        const clean = memberSearchQuery.trim().toLowerCase();
        if (!clean) return availableProfiles;
        return availableProfiles.filter(p =>
            (p.nickname?.toLowerCase().includes(clean)) ||
            (p.email?.toLowerCase().includes(clean)) ||
            p.id.toLowerCase().includes(clean)
        );
    }, [availableProfiles, memberSearchQuery]);

    // Guardar nombre de empresa
    const handleSaveName = async () => {
        const trimmed = nameDraft.trim();
        if (!trimmed) {
            notification.error(t("companies.nameRequired"));
            return;
        }

        setSavingName(true);
        try {
            const { error } = await supabase
                .from("companies")
                .update({ name: trimmed })
                .eq("id", companyId);

            if (error) throw error;

            setCompany(prev => prev ? { ...prev, name: trimmed } : null);
            setEditingName(false);
            notification.success(t("companies.nameUpdated"));
        } catch {
            notification.error(t("companies.updateError"));
        } finally {
            setSavingName(false);
        }
    };

    // Cargar perfiles disponibles para asociar
    const handleOpenAddMemberModal = async () => {
        setMemberSearchQuery("");
        setShowAddMemberModal(true);
        setLoadingProfiles(true);
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("id, email, nickname")
                .or(`company_id.is.null,company_id.neq.${companyId}`)
                .order("nickname", { ascending: true })
                .limit(100);

            if (error) throw error;
            setAvailableProfiles(data ?? []);
        } catch {
            notification.error(t("companies.loadProfilesError"));
        } finally {
            setLoadingProfiles(false);
        }
    };

    // Vincular miembro a la empresa
    const handleAddMember = async (profileId: string) => {
        setAddingMemberId(profileId);
        try {
            const { error } = await supabase
                .from("profiles")
                .update({ company_id: companyId })
                .eq("id", profileId);

            if (error) throw error;

            notification.success(t("companies.memberAdded"));
            setShowAddMemberModal(false);
            void loadAll();
        } catch {
            notification.error(t("companies.addMemberError"));
        } finally {
            setAddingMemberId(null);
        }
    };

    // Desvincular miembro de la empresa
    const handleRemoveMember = async (member: Member) => {
        const memberName = member.nickname || member.email || t("profiles.unnamedProfile");
        const confirmed = await notification.confirm({
            title: t("companies.removeMemberTitle"),
            message: t("companies.removeMemberConfirm", { name: memberName }),
            confirmLabel: t("common.delete"),
            cancelLabel: t("common.cancel"),
            destructive: true,
        });

        if (!confirmed) return;

        try {
            const { error } = await supabase
                .from("profiles")
                .update({ company_id: null })
                .eq("id", member.id);

            if (error) throw error;

            notification.success(t("companies.memberRemoved"));
            setMembers(prev => prev.filter(m => m.id !== member.id));
        } catch {
            notification.error(t("companies.removeMemberError"));
        }
    };

    // Desasignar carga de la empresa
    const handleUnassignShipment = async (s: Shipment) => {
        const confirmed = await notification.confirm({
            title: t("companies.unassignShipmentTitle", { defaultValue: "Desasignar carga" }),
            message: t("companies.unassignShipmentConfirm", {
                doNumber: s.do_number,
                defaultValue: `¿Deseas desasignar la carga ${s.do_number} de esta empresa?`,
            }),
            confirmLabel: t("common.delete", { defaultValue: "Desasignar" }),
            cancelLabel: t("common.cancel", { defaultValue: "Cancelar" }),
            destructive: true,
        });

        if (!confirmed) return;

        setUnassigningShipmentId(s.id);
        try {
            const { error } = await supabase
                .from("company_shipment")
                .delete()
                .eq("company_id", companyId)
                .eq("shipment_id", s.id);

            if (error) throw error;

            notification.success(t("companies.shipmentUnassigned", { defaultValue: "Carga desasignada correctamente" }));
            setShipments(prev => prev.filter(item => item.id !== s.id));
        } catch {
            notification.error(t("companies.unassignShipmentError", { defaultValue: "No se pudo desasignar la carga" }));
        } finally {
            setUnassigningShipmentId(null);
        }
    };

    // Mover empresa a la papelera
    const handleDeleteCompany = async () => {
        if (!company) return;
        const confirmed = await notification.confirm({
            title: t("companies.deleteCompanyTitle", { defaultValue: "Enviar a papelera" }),
            message: t("companies.deleteCompanyConfirm", {
                name: company.name,
                defaultValue: `¿Estás seguro de mover la empresa "${company.name}" a la papelera del sistema?`,
            }),
            confirmLabel: t("common.delete", { defaultValue: "Mover a papelera" }),
            cancelLabel: t("common.cancel", { defaultValue: "Cancelar" }),
            destructive: true,
        });

        if (!confirmed) return;

        setDeletingCompany(true);
        try {
            const { error } = await supabase
                .from("companies")
                .update({ status: "inactive" })
                .eq("id", companyId);

            if (error) throw error;

            notification.success(t("companies.deleteSuccess", { defaultValue: "Empresa movida a la papelera" }));
            router.replace("/companies" as any);
        } catch {
            notification.error(t("companies.deleteError", { defaultValue: "No se pudo mover la empresa a la papelera" }));
            setDeletingCompany(false);
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

    if (!company) {
        return (
            <View style={[styles.center, styles.container]}>
                <AuthScreenBackground />
                <Text style={styles.emptyText}>{t("companies.notFound")}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <AuthScreenBackground />
            <Header
                isDesktop={isDesktop}
                title={company.name}
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
            >
                {/* Sección 1: Datos y edición de nombre */}
                <View style={[styles.section, AUTH_SHADOW]}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{t("companies.infoTitle")}</Text>
                        <View style={styles.sectionHeaderActions}>
                            {!editingName && (
                                <TouchableOpacity style={styles.containerActionButton} onPress={() => setEditingName(true)}>
                                    <Ionicons name="create-outline" size={16} color={AUTH_COLORS.orange} />
                                    <Text style={styles.containerActionButtonText}>{t("common.edit")}</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={styles.dangerActionButton}
                                onPress={handleDeleteCompany}
                                disabled={deletingCompany}
                            >
                                {deletingCompany ? (
                                    <ActivityIndicator size="small" color={AUTH_COLORS.danger} />
                                ) : (
                                    <>
                                        <Ionicons name="trash-outline" size={15} color={AUTH_COLORS.danger} />
                                        <Text style={styles.dangerActionButtonText}>{t("common.delete")}</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {editingName ? (
                        <View style={styles.editNameWrap}>
                            <TextInput
                                style={styles.nameInput}
                                value={nameDraft}
                                onChangeText={setNameDraft}
                                placeholder={t("companies.namePlaceholder")}
                                placeholderTextColor={AUTH_COLORS.secondaryText}
                                autoFocus
                            />
                            <View style={styles.editActionRow}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => { setEditingName(false); setNameDraft(company.name); }}
                                    disabled={savingName}
                                >
                                    <Text style={styles.cancelButtonText}>{t("common.cancel")}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.saveButton}
                                    onPress={handleSaveName}
                                    disabled={savingName}
                                >
                                    {savingName ? (
                                        <ActivityIndicator size="small" color={AUTH_COLORS.primaryText} />
                                    ) : (
                                        <Text style={styles.saveButtonText}>{t("common.save")}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.companyInfoRow}>
                            <View style={styles.companyIconWrap}>
                                <Ionicons name="business-outline" size={24} color={AUTH_COLORS.orange} />
                            </View>
                            <View style={styles.companyTextWrap}>
                                <Text style={styles.companyNameText}>{company.name}</Text>
                                <Text style={styles.companyMetaText}>
                                    {members.length} {t("companies.membersCount")} · {shipments.length} {t("companies.shipmentsCount")}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Sección 2: Miembros */}
                <View style={[styles.section, AUTH_SHADOW]}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.titleWithCount}>
                            <Text style={styles.sectionTitle}>{t("companies.membersTitle")}</Text>
                            <View style={styles.badgeCount}>
                                <Text style={styles.badgeCountText}>{members.length}</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.containerActionButton} onPress={handleOpenAddMemberModal}>
                            <Ionicons name="person-add-outline" size={16} color={AUTH_COLORS.orange} />
                            <Text style={styles.containerActionButtonText}>{t("companies.addMember")}</Text>
                        </TouchableOpacity>
                    </View>

                    {members.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Ionicons name="people-outline" size={28} color={AUTH_COLORS.secondaryText} />
                            <Text style={styles.emptyText}>{t("companies.noMembers")}</Text>
                        </View>
                    ) : (
                        members.map(m => (
                            <View key={m.id} style={styles.memberRow}>
                                <TouchableOpacity
                                    style={styles.memberClickArea}
                                    onPress={() => router.push(`/profile/${m.id}` as any)}
                                >
                                    <View style={styles.memberBadge}>
                                        <Ionicons name="person-outline" size={16} color={AUTH_COLORS.blue} />
                                    </View>
                                    <View style={styles.memberCopy}>
                                        <Text style={styles.memberName} numberOfLines={1}>
                                            {m.nickname || m.email || t("profiles.unnamedProfile")}
                                        </Text>
                                        {m.email ? <Text style={styles.memberEmail} numberOfLines={1}>{m.email}</Text> : null}
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.removeMemberButton}
                                    onPress={() => handleRemoveMember(m)}
                                    accessibilityLabel="Desvincular miembro"
                                >
                                    <Ionicons name="close-circle-outline" size={20} color={AUTH_COLORS.danger} />
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>

                {/* Sección 3: Cargas asignadas */}
                <View style={[styles.section, AUTH_SHADOW]}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.titleWithCount}>
                            <Text style={styles.sectionTitle}>{t("companies.shipmentsTitle")}</Text>
                            <View style={styles.badgeCount}>
                                <Text style={styles.badgeCountText}>{shipments.length}</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.containerActionButton}
                            onPress={() => router.push({ pathname: "/assignShipment", params: { companyId } } as any)}
                        >
                            <Ionicons name="link-outline" size={16} color={AUTH_COLORS.orange} />
                            <Text style={styles.containerActionButtonText}>{t("companies.assignShipment")}</Text>
                        </TouchableOpacity>
                    </View>
                    {shipments.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Ionicons name="cube-outline" size={28} color={AUTH_COLORS.secondaryText} />
                            <Text style={styles.emptyText}>{t("companies.noShipments")}</Text>
                        </View>
                    ) : (
                        shipments.map(s => (
                            <View key={s.id} style={styles.shipmentRow}>
                                <TouchableOpacity
                                    style={styles.shipmentClickArea}
                                    onPress={() => router.push(`/shipment/${s.id}` as any)}
                                >
                                    <View style={styles.shipmentCopy}>
                                        <Text style={styles.shipmentDo} numberOfLines={1}>{s.do_number}</Text>
                                        <Text style={styles.shipmentRoute} numberOfLines={1}>{s.origin} → {s.destination}</Text>
                                        {s.current_status ? <Text style={styles.shipmentStatus} numberOfLines={1}>{getShipmentStatusLabel(s.current_status, t)}</Text> : null}
                                    </View>
                                    <Ionicons name="chevron-forward-outline" size={16} color={AUTH_COLORS.secondaryText} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.updateDeleteBtn}
                                    onPress={() => void handleUnassignShipment(s)}
                                    disabled={unassigningShipmentId === s.id}
                                    accessibilityLabel={t("companies.unassignShipment", { defaultValue: "Desasignar carga" })}
                                >
                                    {unassigningShipmentId === s.id ? (
                                        <ActivityIndicator size="small" color={AUTH_COLORS.danger} />
                                    ) : (
                                        <Ionicons name="trash-outline" size={15} color={AUTH_COLORS.danger} />
                                    )}
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Modal para asociar nuevo miembro con buscador en vivo */}
            <Modal
                visible={showAddMemberModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowAddMemberModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, isDesktop && styles.modalCardDesktop]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t("companies.selectMember")}</Text>
                            <TouchableOpacity onPress={() => setShowAddMemberModal(false)}>
                                <Ionicons name="close" size={22} color={AUTH_COLORS.primaryText} />
                            </TouchableOpacity>
                        </View>

                        {/* Buscador de perfiles */}
                        <AuthSearchBar
                            value={memberSearchQuery}
                            onChangeText={setMemberSearchQuery}
                            placeholder={t("companies.searchMembersPlaceholder")}
                            searching={loadingProfiles}
                        />

                        {loadingProfiles ? (
                            <View style={styles.modalCenter}>
                                <ActivityIndicator size="small" color={AUTH_COLORS.orange} />
                            </View>
                        ) : filteredAvailableProfiles.length === 0 ? (
                            <View style={styles.modalEmpty}>
                                <Text style={styles.emptyText}>
                                    {memberSearchQuery.trim()
                                        ? t("assignShipment.noProfilesFound")
                                        : t("companies.noAvailableProfiles")}
                                </Text>
                            </View>
                        ) : (
                            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                                {filteredAvailableProfiles.map(p => (
                                    <TouchableOpacity
                                        key={p.id}
                                        style={styles.modalProfileRow}
                                        onPress={() => handleAddMember(p.id)}
                                        disabled={addingMemberId === p.id}
                                    >
                                        <View style={styles.memberBadge}>
                                            <Ionicons name="person-outline" size={16} color={AUTH_COLORS.blue} />
                                        </View>
                                        <View style={styles.memberCopy}>
                                            <Text style={styles.memberName}>{p.nickname || p.email || t("profiles.unnamedProfile")}</Text>
                                            {p.email ? <Text style={styles.memberEmail}>{p.email}</Text> : null}
                                        </View>
                                        {addingMemberId === p.id ? (
                                            <ActivityIndicator size="small" color={AUTH_COLORS.orange} />
                                        ) : (
                                            <Ionicons name="add-circle-outline" size={22} color={AUTH_COLORS.orange} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, minHeight: 0, backgroundColor: AUTH_COLORS.backgroundBottom },
    center: { justifyContent: "center", alignItems: "center" },
    scroll: { flex: 1, minHeight: 0 },
    content: { gap: 18, paddingBottom: 28 },
    contentDesktop: { paddingHorizontal: 28, paddingTop: 24, paddingBottom: 64 },
    contentMobile: { paddingHorizontal: 16, paddingTop: 18 },
    contentWithDock: { paddingBottom: AUTH_MOBILE_DOCK_PADDING },
    section: { backgroundColor: AUTH_COLORS.surface, borderRadius: 24, borderWidth: 1, borderColor: AUTH_COLORS.line, padding: 18, gap: 14 },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    sectionHeaderActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    titleWithCount: { flexDirection: "row", alignItems: "center", gap: 8 },
    sectionTitle: { color: AUTH_COLORS.primaryText, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
    badgeCount: { backgroundColor: AUTH_COLORS.surfaceAlt, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: AUTH_COLORS.line },
    badgeCountText: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
    containerActionButton: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: AUTH_COLORS.surfaceAlt, borderWidth: 1, borderColor: AUTH_COLORS.orangeBorder },
    containerActionButtonText: { color: AUTH_COLORS.orange, fontSize: FONT_SIZE.xs + 1, fontWeight: FONT_WEIGHT.bold },
    dangerActionButton: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: AUTH_COLORS.surfaceAlt, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
    dangerActionButtonText: { color: AUTH_COLORS.danger, fontSize: FONT_SIZE.xs + 1, fontWeight: FONT_WEIGHT.bold },
    editNameWrap: { gap: 10, marginTop: 4 },
    nameInput: { minHeight: 44, borderRadius: 12, paddingHorizontal: 14, backgroundColor: AUTH_COLORS.surfaceAlt, borderWidth: 1, borderColor: AUTH_COLORS.orangeBorder, color: AUTH_COLORS.primaryText, fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.medium },
    editActionRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
    cancelButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: AUTH_COLORS.surfaceAlt },
    cancelButtonText: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
    saveButton: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10, backgroundColor: AUTH_COLORS.orangeSoft, borderWidth: 1, borderColor: AUTH_COLORS.orangeBorder },
    saveButtonText: { color: AUTH_COLORS.primaryText, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
    companyInfoRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
    companyIconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: AUTH_COLORS.orangeSoft, borderWidth: 1, borderColor: AUTH_COLORS.orangeBorder, alignItems: "center", justifyContent: "center" },
    companyTextWrap: { flex: 1, gap: 3 },
    companyNameText: { color: AUTH_COLORS.primaryText, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
    companyMetaText: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.xs + 1 },
    memberRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, borderRadius: 14, backgroundColor: AUTH_COLORS.surfaceAlt, borderWidth: 1, borderColor: AUTH_COLORS.line },
    memberClickArea: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
    memberBadge: { width: 34, height: 34, borderRadius: 11, backgroundColor: AUTH_COLORS.blueSoft, alignItems: "center", justifyContent: "center" },
    memberCopy: { flex: 1, minWidth: 0 },
    memberName: { color: AUTH_COLORS.primaryText, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
    memberEmail: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.xs, marginTop: 2 },
    removeMemberButton: { padding: 6 },
    shipmentRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, backgroundColor: AUTH_COLORS.surfaceAlt, borderWidth: 1, borderColor: AUTH_COLORS.line },
    shipmentClickArea: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
    updateDeleteBtn: { padding: 4, borderRadius: 6, alignItems: "center", justifyContent: "center" },
    shipmentCopy: { flex: 1, minWidth: 0, gap: 2 },
    shipmentDo: { color: AUTH_COLORS.primaryText, fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold },
    shipmentRoute: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.xs, lineHeight: 18 },
    shipmentStatus: { color: AUTH_COLORS.blue, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
    emptyCard: { alignItems: "center", gap: 8, paddingVertical: 18 },
    emptyText: { color: AUTH_COLORS.secondaryText, fontSize: FONT_SIZE.sm, textAlign: "center" },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 18 },
    modalCard: { width: "100%", maxHeight: 520, backgroundColor: AUTH_COLORS.surface, borderRadius: 24, padding: 20, gap: 14, borderWidth: 1, borderColor: AUTH_COLORS.line },
    modalCardDesktop: { maxWidth: 480 },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    modalTitle: { color: AUTH_COLORS.primaryText, fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold },
    modalCenter: { paddingVertical: 32, alignItems: "center" },
    modalEmpty: { paddingVertical: 24, alignItems: "center" },
    modalScroll: { maxHeight: 300 },
    modalProfileRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 12, backgroundColor: AUTH_COLORS.surfaceAlt, marginBottom: 8 },
});
