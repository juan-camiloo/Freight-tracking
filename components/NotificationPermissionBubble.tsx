    import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Animated,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { COLORS } from './ui/COLORS';

type NotificationPermissionBubbleProps = {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

export default function NotificationPermissionBubble({
  visible,
  onAccept,
  onDecline,
}: NotificationPermissionBubbleProps) {
  const { t } = useTranslation();
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 6 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    // No hay onPress en el overlay a propósito: no se cierra tocando afuera,
    // solo con Sí/No, tal como lo pediste.
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} pointerEvents="auto" />
      <Animated.View
        style={[
          styles.bubble,
          { opacity, transform: [{ scale }] },
        ]}
      >
        <View style={styles.tail} />

        <View style={styles.iconWrap}>
          <Ionicons name="notifications" size={22} color={COLORS.primaryText} />
        </View>

        <Text style={styles.title}>{t('dashboard.enableNotifications')}</Text>

        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnNo, pressed && styles.btnPressed]}
            onPress={onDecline}
          >
            <Text style={styles.btnNoText}>{t('common.no')}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnYes, pressed && styles.btnPressed]}
            onPress={onAccept}
          >
            <Text style={styles.btnYesText}>{t('common.yes')}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: Platform.OS === 'web' ? 'flex-start' : 'center',
    paddingTop: Platform.OS === 'web' ? 90 : 0,
    zIndex: 9999,
    elevation: 20,
  },
  bubble: {
    width: '86%',
    maxWidth: 360,
    backgroundColor: COLORS.backgroundTop,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.orangeBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  // Colita de burbuja de chat, decorativa (solo visual en web/desktop; en
  // mobile con overlay centrado no estorba)
  tail: {
    position: 'absolute',
    top: -8,
    width: 16,
    height: 16,
    backgroundColor: COLORS.backgroundTop,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: COLORS.orangeBorder,
    transform: [{ rotate: '45deg' }],
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  btnPressed: { opacity: 0.75 },
  btnNo: {
    backgroundColor: 'rgba(245,241,234,0.08)',
    borderColor: 'rgba(245,241,234,0.14)',
  },
  btnNoText: { color: COLORS.surface, fontSize: 14, fontWeight: '700' },
  btnYes: {
    backgroundColor: COLORS.orangeSoft,
    borderColor: COLORS.orangeBorder,
  },
  btnYesText: { color: COLORS.primaryText, fontSize: 14, fontWeight: '800' },
});