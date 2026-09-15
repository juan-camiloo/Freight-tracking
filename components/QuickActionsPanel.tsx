import { ShipmentListItem } from '@/lib/shipmentType';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from './ui/COLORS';
import { FONT_SIZE, FONT_WEIGHT } from './ui/TYPOGRAPHY';

type Props = {
    isInternal: boolean;
    selectedShipment: ShipmentListItem;
};

export function QuickActionsPanel({ isInternal, selectedShipment }: Props) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(true);

    const actions = isInternal
        ? [
            {
                key: 'edit',
                label: t('shipmentDetail.edit'),
                icon: 'create-outline' as const,
                onPress: () => router.push(`/editShipment/${selectedShipment.id}`),
            },
            {
                key: 'assign',
                label: t('dashboard.assignShipment'),
                icon: 'link-outline' as const,
                onPress: () =>
                    router.push({
                        pathname: '/assignShipment',
                        params: { shipmentId: selectedShipment.id },
                    } as any),
            },
            {
                key: 'profiles',
                label: t('dashboard.viewProfiles'),
                icon: 'people-outline' as const,
                onPress: () => router.push('/profiles'),
            },
            {
                key: 'ticket',
                label: t('dashboard.fabTickets'),
                icon: 'notifications-outline' as const,
                onPress: () => router.push('/supportInbox'),
                primary: true,
            },
            {
                key: 'trash',
                label: t('dashboard.trash'),
                icon: 'trash-outline' as const,
                onPress: () => router.push('/trash' as any),
            },
        ]
        : [];

    const visibleActions = open ? actions : actions.slice(0, 0);

    return (
        <View style={[styles.shell, styles.shadowCard]}>
            <TouchableOpacity style={styles.toggleRow} onPress={() => setOpen(prev => !prev)}>
                <View style={styles.toggleTextWrap}>
                    <Text style={styles.title}>{t('dashboard.quickActions')}</Text>
                    <Text style={styles.subtitle}>{open ? t('common.close') : t('dashboard.quickActions')}</Text>
                </View>
                <View style={styles.iconWrap}>
                    <Ionicons name={open ? 'chevron-forward' : 'menu-outline'} size={18} color={COLORS.primaryText} />
                </View>
            </TouchableOpacity>

            <View style={styles.actionsWrap}>
                {visibleActions.map(action => (
                    <TouchableOpacity
                        key={action.key}
                        style={styles.actionButton}
                        onPress={action.onPress}
                    >
                        <Ionicons name={action.icon} size={17} color={COLORS.primaryText} />
                        <Text style={styles.actionLabel}>{action.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    shell: {
        backgroundColor: COLORS.surface,
        borderRadius: 22,
        padding: 14,
        gap: 10,
        borderWidth: 1,
        borderColor: COLORS.line,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 2,
    },
    toggleTextWrap: {
        gap: 2,
    },
    title: {
        color: COLORS.primaryText,
        fontSize: FONT_SIZE.base,
        fontWeight: FONT_WEIGHT.bold,
    },
    subtitle: {
        color: COLORS.secondaryText,
        fontSize: FONT_SIZE.xs + 1,
        fontWeight: FONT_WEIGHT.medium,
    },
    iconWrap: {
        width: 34,
        height: 34,
        borderRadius: 999,
        backgroundColor: COLORS.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionsWrap: {
        gap: 8,
    },
    actionButton: {
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: COLORS.surfaceAlt,
        borderWidth: 1,
        borderColor: COLORS.line,
    },
    actionLabel: {
        flex: 1,
        color: COLORS.primaryText,
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
        lineHeight: 18,
    },

    shadowCard: {
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 6,
    },
});
