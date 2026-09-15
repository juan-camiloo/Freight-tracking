// app/(auth)/companies/index.tsx
// Pantalla de listado de todas las empresas del sistema (solo internos).

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
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
import { useNativeNotification } from "../../../components/ui/NativeNotification";
import Header from "../../../components/Header";
import { useResponsive } from "../../../hooks/useResponsive";
import { supabase } from "../../../lib/URLs";

export type Company = {
    id: string;
    name: string;
    created_at: string;
    member_count?: number;
    shipment_count?: number;
};

export default function CompaniesScreen() {
    const { t } = useTranslation();
    const notification = useNativeNotification();
    const { height, isDesktop } = useResponsive();

    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");

    const loadCompanies = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("companies")
                .select("id, name, created_at")
                .neq("status", "inactive")
                .order("name", { ascending: true });

            if (error) throw error;
            setCompanies((data as Company[]) ?? []);
        } catch {
            notification.error(t("companies.loadError"));
        } finally {
            setLoading(false);
        }
    }, [notification, t]);

    useEffect(() => {
        void loadCompanies();
    }, [loadCompanies]);

    const backFunction = () => {
        if (router.canGoBack()) router.back();
        else router.replace("/");
    };

    const visible = query.trim()
        ? companies.filter(c =>
            c.name.toLowerCase().includes(query.trim().toLowerCase())
          )
        : companies;

    return (
        <View style={styles.container}>
            <AuthScreenBackground />
            <Header
                isDesktop={isDesktop}
                title={t("companies.header")}
                showSearch={false}
                onGoBack={backFunction}
            />

            <View
                style={[
                    styles.content,
                    !isDesktop && styles.contentMobile,
                    isDesktop && styles.contentDesktop,
                ]}
            >
                <AuthSearchBar
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t("companies.searchPlaceholder")}
                    searching={loading}
                />

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={AUTH_COLORS.orange} />
                    </View>
                ) : (
                    <FlatList
                        data={visible}
                        keyExtractor={item => item.id}
                        contentContainerStyle={[
                            styles.list,
                            !isDesktop && { paddingBottom: AUTH_MOBILE_DOCK_PADDING },
                        ]}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Ionicons
                                    name="business-outline"
                                    size={32}
                                    color={AUTH_COLORS.secondaryText}
                                />
                                <Text style={styles.emptyText}>{t("companies.empty")}</Text>
                            </View>
                        }
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.card, AUTH_SHADOW]}
                                onPress={() => router.push(`/companies/${item.id}` as any)}
                            >
                                <View style={styles.cardBadge}>
                                    <Ionicons
                                        name="business-outline"
                                        size={22}
                                        color={AUTH_COLORS.orange}
                                    />
                                </View>
                                <View style={styles.cardCopy}>
                                    <Text style={styles.cardName} numberOfLines={1}>
                                        {item.name}
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward-outline"
                                    size={18}
                                    color={AUTH_COLORS.secondaryText}
                                />
                            </TouchableOpacity>
                        )}
                    />
                )}
            </View>

            <TouchableOpacity
                style={[styles.fab, !isDesktop && styles.fabMobile]}
                onPress={() => router.push("/companies/create" as any)}
            >
                <Ionicons name="add-outline" size={22} color={AUTH_COLORS.white} />
                <Text style={styles.fabText}>{t("companies.create")}</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        minHeight: 0,
        backgroundColor: AUTH_COLORS.backgroundBottom,
    },
    content: { flex: 1, minHeight: 0, gap: 14 },
    contentDesktop: { paddingHorizontal: 28, paddingTop: 20 },
    contentMobile: { paddingHorizontal: 16, paddingTop: 16 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    list: { gap: 12, paddingBottom: 64 },
    card: {
        backgroundColor: AUTH_COLORS.surface,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: AUTH_COLORS.line,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
    },
    cardBadge: {
        width: 46,
        height: 46,
        borderRadius: 15,
        backgroundColor: AUTH_COLORS.orangeSoft,
        borderWidth: 1,
        borderColor: AUTH_COLORS.orangeBorder,
        alignItems: "center",
        justifyContent: "center",
    },
    cardCopy: { flex: 1, minWidth: 0 },
    cardName: {
        color: AUTH_COLORS.primaryText,
        fontSize: 16,
        fontWeight: "800",
    },
    emptyState: { marginTop: 48, alignItems: "center", gap: 12 },
    emptyText: {
        color: AUTH_COLORS.secondaryText,
        fontSize: 15,
        textAlign: "center",
    },
    fab: {
        position: "absolute",
        right: 20,
        bottom: 28,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: AUTH_COLORS.orange,
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderRadius: 999,
        shadowColor: AUTH_COLORS.shadow,
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 5,
    },
    fabMobile: { bottom: AUTH_MOBILE_DOCK_PADDING + 12 },
    fabText: { color: AUTH_COLORS.white, fontSize: 14, fontWeight: "700" },
});
