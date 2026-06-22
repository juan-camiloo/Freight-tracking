import { Ionicons } from '@expo/vector-icons';
import type { TextInputProps } from 'react-native';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AUTH_COLORS } from './AuthChrome';

type AuthSearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onSubmitEditing?: () => void;
  helperText?: string;
  resultLabel?: string;
  searching?: boolean;
  tone?: 'light' | 'dark';
  autoCapitalize?: TextInputProps['autoCapitalize'];
  returnKeyType?: TextInputProps['returnKeyType'];
};

export function AuthSearchBar({
  value,
  onChangeText,
  placeholder,
  onSubmitEditing,
  helperText,
  resultLabel,
  searching = false,
  tone = 'light',
  autoCapitalize = 'none',
  returnKeyType = 'search',
}: AuthSearchBarProps) {
  const isDark = tone === 'dark';

  return (
    <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
      <View style={[styles.field, isDark ? styles.fieldDark : styles.fieldLight]}>
        <View style={[styles.iconWrap, isDark ? styles.iconWrapDark : styles.iconWrapLight]}>
          <Ionicons
            name="search-outline"
            size={18}
            color={isDark ? AUTH_COLORS.surface : AUTH_COLORS.secondaryText}
          />
        </View>

        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder={placeholder}
          placeholderTextColor={isDark ? 'rgba(245, 241, 234, 0.68)' : AUTH_COLORS.secondaryText}
          value={value}
          onChangeText={onChangeText}
          returnKeyType={returnKeyType}
          autoCapitalize={autoCapitalize}
          onSubmitEditing={onSubmitEditing}
        />

        {searching ? (
          <ActivityIndicator size="small" color={isDark ? AUTH_COLORS.surface : AUTH_COLORS.orange} />
        ) : value ? (
          <TouchableOpacity
            style={[styles.clearButton, isDark ? styles.clearButtonDark : styles.clearButtonLight]}
            onPress={() => onChangeText('')}
          >
            <Ionicons
              name="close-outline"
              size={16}
              color={isDark ? AUTH_COLORS.surface : AUTH_COLORS.primaryText}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {helperText || resultLabel ? (
        <View style={styles.metaRow}>
          {helperText ? (
            <Text style={[styles.helperText, isDark && styles.helperTextDark]}>{helperText}</Text>
          ) : (
            <View />
          )}
          {resultLabel ? (
            <View style={[styles.resultPill, isDark ? styles.resultPillDark : styles.resultPillLight]}>
              <Text style={[styles.resultPillText, isDark && styles.resultPillTextDark]}>{resultLabel}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 10,
    gap: 8,
    borderWidth: 1,
  },
  cardLight: {
    backgroundColor: AUTH_COLORS.surface,
    borderColor: AUTH_COLORS.line,
  },
  cardDark: {
    backgroundColor: 'rgba(245, 241, 234, 0.08)',
    borderColor: 'rgba(245, 241, 234, 0.12)',
  },
  field: {
    minHeight: 56,
    borderRadius: 16,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
  },
  fieldLight: {
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderColor: AUTH_COLORS.line,
  },
  fieldDark: {
    backgroundColor: 'rgba(245, 241, 234, 0.1)',
    borderColor: 'rgba(245, 241, 234, 0.12)',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapLight: {
    backgroundColor: AUTH_COLORS.surface,
  },
  iconWrapDark: {
    backgroundColor: 'rgba(245, 241, 234, 0.12)',
  },
  input: {
    flex: 1,
    color: AUTH_COLORS.primaryText,
    fontSize: 15,
    paddingVertical: 0,
  },
  inputDark: {
    color: AUTH_COLORS.surface,
  },
  clearButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  clearButtonLight: {
    backgroundColor: AUTH_COLORS.surface,
    borderColor: AUTH_COLORS.line,
  },
  clearButtonDark: {
    backgroundColor: 'rgba(245, 241, 234, 0.12)',
    borderColor: 'rgba(245, 241, 234, 0.12)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 4,
  },
  helperText: {
    flex: 1,
    color: AUTH_COLORS.secondaryText,
    fontSize: 12,
  },
  helperTextDark: {
    color: 'rgba(245, 241, 234, 0.72)',
  },
  resultPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  resultPillLight: {
    backgroundColor: AUTH_COLORS.blueSoft,
  },
  resultPillDark: {
    backgroundColor: 'rgba(245, 241, 234, 0.12)',
  },
  resultPillText: {
    color: AUTH_COLORS.blue,
    fontSize: 11,
    fontWeight: '700',
  },
  resultPillTextDark: {
    color: AUTH_COLORS.surface,
  },
});
