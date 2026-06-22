import { ShipmentListItem } from '@/lib/shipmentType';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from './ui/COLORS';
type Props={
    isInternal: boolean;
    selectedShipment: ShipmentListItem;
}
type QuickActionButtonProps = {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
};  
export function QuickActionsPanel({ isInternal, selectedShipment }: Props) {
    const {t} = useTranslation();
    return (
        <View style={[styles.infoCard, styles.shadowCard]}>
            <Text style={styles.infoSectionTitle}>{t('dashboard.quickActions')}</Text>
            <View style={styles.quickActionStack}>
            {isInternal ? (
                <>
                    <QuickActionButton
                        label={t('shipmentDetail.edit')}
                        icon="create-outline"
                        onPress={() => router.push(`/editShipment/${selectedShipment.id}`)}
                    />
                    <QuickActionButton
                        label={t('dashboard.assignShipment')}
                        icon="link-outline"
                        onPress={() =>
                            router.push({
                                pathname: '/assignShipment',
                                params: { shipmentId: selectedShipment.id },
                            } as any)
                        }
                    />
                    <QuickActionButton
                        label={t('dashboard.viewProfiles')}
                        icon="people-outline"
                        onPress={() => router.push('/profiles')}
                    />
                </>
            ):(
                <QuickActionButton
                    label={t('dashboard.fabCreateTicket')}
                    icon="chatbubble-ellipses-outline"
                    onPress={() => router.push('/createTicket')}
                />
            )}
        </View>
    </View>
)}

function QuickActionButton({ label, icon, onPress }: QuickActionButtonProps) {
  return (
    <TouchableOpacity style={styles.quickActionButton} onPress={onPress}>
      <Ionicons name={icon} size={18} color={COLORS.primaryText} />
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({  
    infoCard: { backgroundColor: COLORS.surface, borderRadius: 24, padding: 18, gap: 14 },
    quickActionStack: { gap: 10 },
    shadowCard: { shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 1, shadowRadius: 22, elevation: 8 },
    infoSectionTitle: { color: COLORS.primaryText, fontSize: 16, fontWeight: '800' },
    quickActionButton: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.line },
    quickActionLabel: { flex: 1, color: COLORS.primaryText, fontSize: 14, fontWeight: '700' },
});