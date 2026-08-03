import { NEWS_THEME } from '@/components/news/NEWS_THEME';
import { NewsList } from '@/components/news/NewsList';
import { Ionicons } from '@expo/vector-icons';
import { t } from 'i18next';
import { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

type Anchor = { x: number; y: number; width: number; height: number };

type NewsModalProps = {
    visible: boolean;
    anchor: Anchor;
    onClose: () => void;
};

const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 480;
const GAP = 10; // separación entre el botón y el panel
const MARGIN = 12; // margen mínimo respecto a los bordes de la ventana

export function NewsModal({ visible, anchor, onClose }: NewsModalProps) {
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(progress, {
            toValue: visible ? 1 : 0,
            duration: 160,
            useNativeDriver: Platform.OS !== 'web',
        }).start();
    }, [visible]);

    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    // El panel cuelga hacia abajo desde el botón, alineado a la derecha del botón
    // (como el dropdown de notificaciones de Facebook/YouTube).
    let left = anchor.x + anchor.width - PANEL_WIDTH;
    left = Math.max(MARGIN, Math.min(left, screenWidth - PANEL_WIDTH - MARGIN));

    let top = anchor.y + anchor.height + GAP;
    const fitsBelow = top + PANEL_HEIGHT + MARGIN <= screenHeight;
    if (!fitsBelow) {
        // Si no cabe abajo, lo desplegamos hacia arriba del botón
        top = anchor.y - PANEL_HEIGHT - GAP;
    }

    // Posición de la flechita, relativa al panel, apuntando al centro del botón
    const arrowLeft = Math.min(
        PANEL_WIDTH - 28,
        Math.max(12, anchor.x + anchor.width / 2 - left - 6),
    );

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <View style={StyleSheet.absoluteFill}>
                <Pressable 
                    style={StyleSheet.absoluteFill} 
                    onPress={onClose} 
                    focusable={false}
                    accessible= {false}
                />

                <Animated.View
                    style={[
                        styles.panel,
                        {
                            left,
                            top: fitsBelow ? top : undefined,
                            bottom: fitsBelow ? undefined : screenHeight - top - PANEL_HEIGHT,
                            width: PANEL_WIDTH,
                            height: PANEL_HEIGHT,
                            opacity: progress,
                            transform: [
                                { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [fitsBelow ? -8 : 8, 0] }) },
                            ],
                        },
                    ]}
                >
                    <View style={styles.panelInner}>
                        {fitsBelow && <View style={[styles.arrow, { left: arrowLeft }]} />}

                        <View style={styles.header}>
                            <Text style={styles.title}>{t('news.header')}</Text>
                            <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
                                <Ionicons name="close" size={20} color="#5a5959" />
                            </Pressable>
                        </View>

                        <NewsList style={styles.list} />
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    panel: {
        position: 'absolute',
    },
    panelInner: {
        flex: 1,
        backgroundColor: NEWS_THEME.background,
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 18,
        elevation: 12,
    },
    arrow: {
        position: 'absolute',
        top: -6,
        width: 12,
        height: 12,
        backgroundColor: NEWS_THEME.background,
        transform: [{ rotate: '45deg' }],
        // sombra sutil solo hacia arriba/izquierda para simular la del panel
        shadowColor: '#000',
        shadowOffset: { width: -2, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: NEWS_THEME.divider,
        backgroundColor: NEWS_THEME.background,
        zIndex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: NEWS_THEME.secondaryText,
    },
    closeButton: {
        padding: 4,
    },
    list: {
        flex: 1,
    },
});