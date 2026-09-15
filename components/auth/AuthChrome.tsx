import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS } from '../ui/COLORS';

export const AUTH_COLORS = COLORS;

export const AUTH_SHADOW = {
  shadowColor: COLORS.shadow,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 1,
  shadowRadius: 22,
  elevation: 8,
} as const;

type AuthHeaderProps = {
  title: string;
  actions?: ReactNode;
  isDesktop?: boolean;
  navigation?: ReactNode;
};

type AuthHeaderActionProps = {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'subtle' | 'accent' | 'danger';
};

export function AuthHeader({ title, actions, isDesktop, navigation }: AuthHeaderProps) {
  return (
    <View style={[styles.headerWrap, isDesktop && styles.headerWrapDesktop]}>
      <View style={styles.headerTitleArea}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {navigation ? <View style={styles.headerNavArea}>{navigation}</View> : null}
      {actions ? <View style={styles.headerActionsArea}>{actions}</View> : null}
    </View>
  );
}

export function AuthScreenBackground() {
  return (
    <>
      <View style={styles.backgroundBase} />
      <View style={styles.backgroundGlowOne} />
      <View style={styles.backgroundGlowTwo} />
    </>
  );
}

export function AuthHeaderAction({
  label,
  icon,
  onPress,
  disabled = false,
  variant = 'subtle',
}: AuthHeaderActionProps) {
  const variantStyle =
    variant === 'accent'
      ? styles.headerActionAccent
      : variant === 'danger'
        ? styles.headerActionDanger
        : styles.headerActionSubtle;

  const variantTextStyle =
    variant === 'accent'
      ? styles.headerActionTextAccent
      : variant === 'danger'
        ? styles.headerActionTextDanger
        : styles.headerActionTextSubtle;

  const iconColor =
    variant === 'accent'
      ? AUTH_COLORS.primaryText
      : variant === 'danger'
        ? AUTH_COLORS.dangerSoft
        : AUTH_COLORS.surface;

  return (
    <TouchableOpacity
      style={[styles.headerAction, variantStyle, disabled && styles.headerActionDisabled]}
      onPress={onPress}
      disabled={disabled || !onPress}
    >
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={[styles.headerActionText, variantTextStyle]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backgroundBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: AUTH_COLORS.backgroundBottom,
  },
  backgroundGlowOne: {
    position: 'absolute',
    top: -120,
    left: -50,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(199, 138, 75, 0.18)',
  },
  backgroundGlowTwo: {
    position: 'absolute',
    top: 40,
    right: -70,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 104, 142, 0.18)',
  },

  headerAction: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  headerActionSubtle: {
    backgroundColor: 'rgba(245, 241, 234, 0.08)',
    borderColor: 'rgba(245, 241, 234, 0.12)',
  },
  headerActionAccent: {
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderColor: AUTH_COLORS.orangeBorder,
  },
  headerActionDanger: {
    backgroundColor: 'rgba(161, 71, 79, 0.18)',
    borderColor: 'rgba(245, 217, 219, 0.28)',
  },
  headerActionDisabled: {
    opacity: 0.55,
  },
  headerActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  headerActionTextSubtle: {
    color: AUTH_COLORS.surface,
  },
  headerActionTextAccent: {
    color: AUTH_COLORS.primaryText,
  },
  headerActionTextDanger: {
    color: AUTH_COLORS.dangerSoft,
  },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  headerWrapDesktop: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerTitleArea: {
    flex: 1,
  },
  headerTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 22,
    fontWeight: '800',
  },
  headerDesktopNavArea: {
    paddingHorizontal: 12,
  },
  headerNavArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionsArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
