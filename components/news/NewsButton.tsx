import { NewsModal } from '@/components/news/NewsModal';
import { COLORS } from '@/components/ui/COLORS';
import { useResponsive } from '@/hooks/useResponsive';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Anchor = { x: number; y: number; width: number; height: number };

export function NewsTrigger() {
    const { t } = useTranslation();
    const { isDesktop } = useResponsive();
    const [newsModalVisible, setNewsModalVisible] = useState(false);
    const [anchor, setAnchor] = useState<Anchor | null>(null);
    const triggerRef = useRef<View>(null);

    const handleOpenNews = () => {
        if (isDesktop) {
            // measureInWindow da coordenadas absolutas en pantalla,
            // necesarias porque el popover se renderiza en un Modal (otra capa).
            triggerRef.current?.measureInWindow((x, y, width, height) => {
                setAnchor({ x, y, width, height });
                setNewsModalVisible(true);
            });
        } else {
            router.push('/newsScreen');
        }
    };

    return (
        <>
            <TouchableOpacity
                ref={triggerRef}
                style={styles.iconAction}
                onPress={handleOpenNews}
            >
                <Ionicons name="megaphone-outline" size={18} color={COLORS.surface} />
                <Text style={styles.iconActionText}>{t('news.header', { defaultValue: 'Novedades' })}</Text>
            </TouchableOpacity>

            {isDesktop && anchor && (
                <NewsModal
                    visible={newsModalVisible}
                    anchor={anchor}
                    onClose={() => setNewsModalVisible(false)}
                />
            )}
        </>
    );
}

const styles = StyleSheet.create({
    iconAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(245, 241, 234, 0.08)',
    },
    iconActionText: {
        color: COLORS.surface,
        fontSize: 12,
        fontWeight: '700',
    },
});