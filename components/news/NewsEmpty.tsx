import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { NEWS_SPACING, NEWS_THEME } from './NEWS_THEME';
import { NEWS_TEXT } from './NEWS_TEXT';

type NewsEmptyProps = {
  title: string;
};

export function NewsEmpty({ title }: NewsEmptyProps) {
  return (
    <View style={styles.emptyState}>
      <Ionicons
        name="newspaper-outline"
        size={30}
        color={NEWS_THEME.secondaryText}
      />
      <Text style={NEWS_TEXT.emptyTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: NEWS_THEME.surface,
    borderBottomColor: NEWS_THEME.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: NEWS_SPACING.rowHorizontal,
    paddingVertical: 48,
  },
});
