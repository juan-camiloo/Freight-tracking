import { StyleSheet, Text } from 'react-native';

import { NEWS_TEXT } from './NEWS_TEXT';
import { NEWS_SPACING } from './NEWS_THEME';

type NewsSectionHeaderProps = {
  title: string;
};

export function NewsSectionHeader({ title }: NewsSectionHeaderProps) {
  return <Text style={[NEWS_TEXT.sectionTitle, styles.sectionHeader]}>{title}</Text>;
}

const styles = StyleSheet.create({
  sectionHeader: {
    paddingBottom: NEWS_SPACING.sectionBottom,
    paddingHorizontal: NEWS_SPACING.rowHorizontal,
    paddingTop: NEWS_SPACING.sectionTop,
  },
});
