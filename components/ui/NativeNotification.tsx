import { Ionicons } from '@expo/vector-icons';
import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import { AUTH_COLORS, AUTH_SHADOW } from '../auth/AuthChrome';

type NotificationTone = 'success' | 'error' | 'warning' | 'info';

type NotifyOptions = {
  type?: NotificationTone;
  title?: string;
  message: string;
  duration?: number;
};

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
};

type ActiveNotification = Required<Pick<NotifyOptions, 'type' | 'message'>> &
  Pick<NotifyOptions, 'title'> & {
    id: number;
  };

type PendingConfirmation = ConfirmOptions & {
  resolve: (confirmed: boolean) => void;
};

type NotificationContextValue = {
  notify: (options: NotifyOptions) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const TONE_CONFIG: Record<
  NotificationTone,
  {
    icon: keyof typeof Ionicons.glyphMap;
    background: string;
    border: string;
    iconBackground: string;
    iconColor: string;
    text: string;
  }
> = {
  success: {
    icon: 'checkmark-circle-outline',
    background: '#F1F8F2',
    border: AUTH_COLORS.green,
    iconBackground: AUTH_COLORS.greenSoft,
    iconColor: AUTH_COLORS.green,
    text: AUTH_COLORS.primaryText,
  },
  error: {
    icon: 'alert-circle-outline',
    background: '#FFF4F4',
    border: AUTH_COLORS.danger,
    iconBackground: AUTH_COLORS.dangerSoft,
    iconColor: AUTH_COLORS.danger,
    text: AUTH_COLORS.primaryText,
  },
  warning: {
    icon: 'warning-outline',
    background: '#FFF7E8',
    border: AUTH_COLORS.orange,
    iconBackground: '#FBE2B9',
    iconColor: AUTH_COLORS.orange,
    text: AUTH_COLORS.primaryText,
  },
  info: {
    icon: 'information-circle-outline',
    background: '#F1F6FD',
    border: AUTH_COLORS.blue,
    iconBackground: AUTH_COLORS.blueSoft,
    iconColor: AUTH_COLORS.blue,
    text: AUTH_COLORS.primaryText,
  },
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isDesktop } = useResponsive(760);
  const [activeNotification, setActiveNotification] = useState<ActiveNotification | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearNotificationTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const notify = useCallback(
    ({ type = 'info', title, message, duration = 3600 }: NotifyOptions) => {
      clearNotificationTimer();
      const id = Date.now();
      setActiveNotification({ id, type, title, message });

      if (duration > 0) {
        timeoutRef.current = setTimeout(() => {
          setActiveNotification((current) => (current?.id === id ? null : current));
          timeoutRef.current = null;
        }, duration);
      }
    },
    [clearNotificationTimer],
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPendingConfirmation({ ...options, resolve });
    });
  }, []);

  const resolveConfirmation = useCallback(
    (confirmed: boolean) => {
      pendingConfirmation?.resolve(confirmed);
      setPendingConfirmation(null);
    },
    [pendingConfirmation],
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      notify,
      success: (message, title) => notify({ type: 'success', title, message }),
      error: (message, title) => notify({ type: 'error', title, message }),
      warning: (message, title) => notify({ type: 'warning', title, message }),
      info: (message, title) => notify({ type: 'info', title, message }),
      confirm,
    }),
    [confirm, notify],
  );

  const tone = activeNotification ? TONE_CONFIG[activeNotification.type] : null;

  return (
    <NotificationContext.Provider value={value}>
      <View style={styles.root}>
        {children}

        <View pointerEvents="box-none" style={styles.overlay}>
          {activeNotification && tone ? (
            <Pressable
              accessibilityLiveRegion="polite"
              onPress={() => {
                clearNotificationTimer();
                setActiveNotification(null);
              }}
              style={[
                styles.toast,
                AUTH_SHADOW,
                isDesktop ? styles.toastDesktop : styles.toastMobile,
                {
                  backgroundColor: tone.background,
                  borderColor: tone.border,
                },
              ]}
            >
              <View style={[styles.toastIcon, { backgroundColor: tone.iconBackground }]}>
                <Ionicons name={tone.icon} size={20} color={tone.iconColor} />
              </View>
              <View style={styles.toastCopy}>
                {activeNotification.title ? (
                  <Text style={[styles.toastTitle, { color: tone.text }]} numberOfLines={2}>
                    {activeNotification.title}
                  </Text>
                ) : null}
                <Text style={[styles.toastMessage, { color: tone.text }]} numberOfLines={4}>
                  {activeNotification.message}
                </Text>
              </View>
            </Pressable>
          ) : null}
        </View>

        <Modal
          transparent
          visible={Boolean(pendingConfirmation)}
          animationType="fade"
          onRequestClose={() => resolveConfirmation(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.confirmCard, AUTH_SHADOW, isDesktop && styles.confirmCardDesktop]}>
              <View
                style={[
                  styles.confirmIcon,
                  pendingConfirmation?.destructive ? styles.confirmIconDanger : styles.confirmIconInfo,
                ]}
              >
                <Ionicons
                  name={pendingConfirmation?.destructive ? 'trash-outline' : 'help-circle-outline'}
                  size={24}
                  color={pendingConfirmation?.destructive ? AUTH_COLORS.danger : AUTH_COLORS.blue}
                />
              </View>
              <Text style={styles.confirmTitle}>{pendingConfirmation?.title}</Text>
              <Text style={styles.confirmMessage}>{pendingConfirmation?.message}</Text>

              <View style={[styles.confirmActions, !isDesktop && styles.confirmActionsMobile]}>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.confirmButtonCancel]}
                  onPress={() => resolveConfirmation(false)}
                >
                  <Text style={styles.confirmButtonCancelText}>{pendingConfirmation?.cancelLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    pendingConfirmation?.destructive ? styles.confirmButtonDanger : styles.confirmButtonPrimary,
                  ]}
                  onPress={() => resolveConfirmation(true)}
                >
                  <Text
                    style={[
                      styles.confirmButtonPrimaryText,
                      pendingConfirmation?.destructive && styles.confirmButtonDangerText,
                    ]}
                  >
                    {pendingConfirmation?.confirmLabel}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </NotificationContext.Provider>
  );
}

export function useNativeNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNativeNotification must be used inside NotificationProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  toast: {
    position: 'absolute',
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toastDesktop: {
    top: 24,
    right: 24,
    width: 390,
    maxWidth: '42%',
  },
  toastMobile: {
    top: 18,
    left: 14,
    right: 14,
  },
  toastIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastCopy: {
    flex: 1,
    minWidth: 0,
  },
  toastTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.52)',
  },
  confirmCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 24,
    padding: 22,
    backgroundColor: AUTH_COLORS.surface,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  confirmCardDesktop: {
    padding: 26,
  },
  confirmIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  confirmIconDanger: {
    backgroundColor: AUTH_COLORS.dangerSoft,
  },
  confirmIconInfo: {
    backgroundColor: AUTH_COLORS.blueSoft,
  },
  confirmTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 20,
    fontWeight: '800',
  },
  confirmMessage: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 22,
  },
  confirmActionsMobile: {
    flexDirection: 'column-reverse',
  },
  confirmButton: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  confirmButtonCancel: {
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderColor: AUTH_COLORS.line,
  },
  confirmButtonPrimary: {
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderColor: AUTH_COLORS.orangeBorder,
  },
  confirmButtonDanger: {
    backgroundColor: AUTH_COLORS.danger,
    borderColor: AUTH_COLORS.danger,
  },
  confirmButtonCancelText: {
    color: AUTH_COLORS.primaryText,
    fontSize: 14,
    fontWeight: '800',
  },
  confirmButtonPrimaryText: {
    color: AUTH_COLORS.primaryText,
    fontSize: 14,
    fontWeight: '800',
  },
  confirmButtonDangerText: {
    color: AUTH_COLORS.white,
  },
});
