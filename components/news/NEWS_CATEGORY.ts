import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { NEWS_THEME } from './NEWS_THEME';

type NewsIconName = ComponentProps<typeof Ionicons>['name'];

export type NewsCategoryKey = 'urgent' | 'common';

export const NEWS_CATEGORY: Record<
  NewsCategoryKey,
  {
    icon: NewsIconName;
    color: string;
    iconBackground: string;
  }
> = {
  urgent: {
    icon: 'warning',
    color: NEWS_THEME.urgent,
    iconBackground: NEWS_THEME.urgentIconBackground,
  },
  common: {
    icon: 'newspaper-outline',
    color: NEWS_THEME.info,
    iconBackground: NEWS_THEME.iconBackground,
  },
};
