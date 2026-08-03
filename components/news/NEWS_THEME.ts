import { AUTH_COLORS } from '@/components/auth/AuthChrome';

export const NEWS_THEME = {
  background: AUTH_COLORS.backgroundBottom,
  surface: AUTH_COLORS.surface,
  primaryText: "#a9b9df",
  secondaryText: "#cbd6f0",
  divider: 'rgba(255, 255, 255, 0.24)',
  urgent: '#E5484D',
  info: AUTH_COLORS.blue,
  sectionTitle: AUTH_COLORS.secondaryText,
  pressed: 'rgba(43, 50, 66, 0.06)',
  iconBackground: AUTH_COLORS.blueSoft,
  urgentIconBackground: 'rgba(229, 72, 77, 0.14)',
  accent: AUTH_COLORS.orange,
} as const;

export const NEWS_SPACING = {
  screen: 28,
  rowVertical: 14,
  rowHorizontal: 16,
  sectionTop: 28,
  sectionBottom: 8,
  iconGap: 12,
  titleGap: 4,
  timeGap: 8,
} as const;
