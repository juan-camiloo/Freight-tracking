// app/(auth)/companies/create.tsx
// Pantalla para crear una nueva empresa (solo internos).

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
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
import Header from "../../../components/Header";
import { AUTH_MOBILE_DOCK_PADDING, toggleLanguage } from "../../../components/auth/AuthNavigation";
import { useNativeNotification } from "../../../components/ui/NativeNotification";
import { useResponsive } from "../../../hooks/useResponsive";
import { supabase } from "../../../lib/URLs";

export default function CreateCompanyScreen() {
    const { t } = useTranslation();
    const notification = useNativeNotification();
    const { height, isDesktop } = useResponsive();

    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);

    const backFunction = () => {
        if (router.canGoBack()) router.back();
        else router.replace("/companies" as any);
    };

    const handleCreate = async () => {
        const cleanName = name.trim();
        if (!cleanName) {
            notification.error(t("companies.nameRequired"));
            return;
        }

        try {
            setSaving(true);
            const { data, error } = await supabase
                .from("companies")
                .insert({ name: cleanName })
                .select("id")
                .single();

            if (error) throw error;

            notification.success(t("companies.createSuccess"));
            // Navegar al detalle de la empresa recien creada
            router.replace(`/companies/${data.id}` as any);
        } catch {
            notification.error(t("companies.createError"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={styles.container}>
            <AuthScreenBackground />
            <Header
                isDesktop={isDesktop}
                title={t("companies.createHeader")}
                showSearch={false}
                onGoBack={backFunction}
                onToggleLanguage={toggleLanguage}
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
                <View style={[styles.card, AUTH_SHADOW]}>
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>{t("companies.nameLabel")}</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder={t("companies.namePlaceholder")}
                            placeholderTextColor={AUTH_COLORS.secondaryText}
                            autoFocus
                            returnKeyType="done"
                            onSubmitEditing={handleCreate}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.button, saving && styles.buttonDisabled]}
                        onPress={handleCreate}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color={AUTH_COLORS.primaryText} />
                        ) : (
                            <Ionicons name="business-outline" size={18} color={AUTH_COLORS.primaryText} />
                        )}
                        <Text style={styles.buttonText}>
                            {saving ? t("common.saving") : t("companies.createButton")}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        minHeight: 0,
        backgroundColor: AUTH_COLORS.backgroundBottom,
    },
    scroll: { flex: 1, minHeight: 0 },
    content: { gap: 18, paddingBottom: 28 },
    contentDesktop: { paddingHorizontal: 28, paddingTop: 24, paddingBottom: 64 },
    contentMobile: { paddingHorizontal: 16, paddingTop: 18 },
    contentWithDock: { paddingBottom: AUTH_MOBILE_DOCK_PADDING },
    card: {
        backgroundColor: AUTH_COLORS.surface,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: AUTH_COLORS.line,
        padding: 20,
        gap: 18,
    },
    fieldGroup: { gap: 8 },
    label: {
        color: AUTH_COLORS.secondaryText,
        fontSize: 12,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: AUTH_COLORS.surfaceAlt,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: AUTH_COLORS.line,
        paddingHorizontal: 14,
        paddingVertical: 14,
        color: AUTH_COLORS.primaryText,
        fontSize: 16,
        fontWeight: "600",
    },
    button: {
        minHeight: 52,
        borderRadius: 16,
        backgroundColor: AUTH_COLORS.orangeSoft,
        borderWidth: 1,
        borderColor: AUTH_COLORS.orangeBorder,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: {
        color: AUTH_COLORS.primaryText,
        fontSize: 15,
        fontWeight: "700",
    },
});
