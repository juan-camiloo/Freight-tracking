import { StyleSheet } from 'react-native';

import { NEWS_THEME } from './NEWS_THEME';

export const NEWS_TEXT = StyleSheet.create({
  title: {
    color: NEWS_THEME.primaryText,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: 0,
  },
  body: {
    color: NEWS_THEME.secondaryText,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: 0,
  },
  caption: {
    color: NEWS_THEME.secondaryText,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    letterSpacing: 0,
    opacity: 0.76,
  },
  sectionTitle: {
    color: NEWS_THEME.sectionTitle,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: 0,
  },
  emptyTitle: {
    color: NEWS_THEME.primaryText,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: 0,
    textAlign: 'center',
  },
});
