// Pantalla: createTicket
// Objetivo:
// - Permitir crear tickets de soporte sin chat.
// - Validar campos minimos en cliente.
// - Enviar payload a la Edge Function `createTicket`.

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LogoCorner from '../../components/LogoCorner';
import { createTicketFunctionUrl, supabase, supabaseAnonKey } from '../../lib/supabase';

const COLORS = {
  blue: '#1E5F99',
  blueMid: '#2B6AA0',
  blueDark: '#1B2A3A',
  orange: '#F28A07',
  cream: '#FFF6EC',
  creamGlass: 'rgba(255, 246, 236, 0.92)',
  textSecondary: '#6B7C8F',
  placeholder: '#8B98A6',
  border: '#D7E3EE',
};

const HEADER_HEIGHT = 100;

// Extrae un posible DO desde texto libre.
const extractDoNumber = (message: string) => {
  const patterns = [/x[- ]?\d+/i, /m[- ]?\d+/i, /\b\d{5,}\b/];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[0].toLowerCase();
  }
  return null;
};

type CategoryOption = {
  id: string;
  label: string;
};

export default function CreateTicketScreen() {
  const { t } = useTranslation();
  const categories = useMemo<CategoryOption[]>(
    () => [
      { id: 'administrative', label: t('chat.options.administrative') },
      { id: 'facturation', label: t('chat.options.facturation') },
      { id: 'comercial', label: t('chat.options.comercial') },
      { id: 'pricing', label: t('chat.options.pricing') },
      { id: 'maritime', label: t('chat.options.maritime') },
      { id: 'air', label: t('chat.options.air') },
      { id: 'other', label: t('chat.options.other') },
    ],
    [t],
  );

  const [message, setMessage] = useState('');
  const [doNumber, setDoNumber] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const resolveErrorMessage = async (response: Response, fallbackMessage: string) => {
    try {
      const text = await response.text();
      if (text) {
        try {
          const payload = JSON.parse(text);
          if (typeof payload?.error_key === 'string') {
            return t(payload.error_key, payload.error_params ?? {});
          }
          if (typeof payload?.reason_key === 'string') {
            return t(payload.reason_key, payload.reason_params ?? {});
          }
          if (typeof payload?.error === 'string') return payload.error;
          if (typeof payload?.reason === 'string') return payload.reason;
        } catch {
          return text;
        }
      }
    } catch {
      // ignore response parsing errors
    }
    return fallbackMessage;
  };

  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleCreateTicket = async () => {
    const cleanMessage = message.trim();
    if (!cleanMessage) {
      Alert.alert(t('common.error'), t('ticketCreateScreen.missingMessage'));
      return;
    }
    if (!selectedCategory) {
      Alert.alert(t('common.error'), t('ticketCreateScreen.missingCategory'));
      return;
    }

    setSending(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        Alert.alert(t('common.error'), t('createTicket.invalidSession'));
        return;
      }

      const resolvedDo = doNumber.trim() || extractDoNumber(cleanMessage);

      const response = await fetch(createTicketFunctionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: cleanMessage,
          do_number: resolvedDo || null,
          category: selectedCategory || null,
        }),
      });

      if (!response.ok) {
        const errorMessage = await resolveErrorMessage(response, t('chat.ticketRequestError'));
        throw new Error(errorMessage);
      }

      Alert.alert(t('ticketCreateScreen.successTitle'), t('ticketCreateScreen.successBody'));
      setMessage('');
      setDoNumber('');
      setSelectedCategory(null);
      router.replace('/');
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('chat.ticketCreateFailed'),
      );
    } finally {
      setSending(false);
    }
  };

  const submitDisabled = sending || !message.trim() || !selectedCategory;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? HEADER_HEIGHT : 0}
    >
      <View style={StyleSheet.absoluteFill}>
        <Image
          source={require('../../visual/background.png')}
          style={styles.background}
          resizeMode="cover"
        />
      </View>

      <View style={styles.fixedHeader}>
        <View style={styles.headerRow}>
          <LogoCorner inline size={120} />
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {t('ticketCreateScreen.headerTitle')}
          </Text>
          <View style={styles.topActions}>
            <TouchableOpacity onPress={backFunction}>
              <Text style={styles.topActionText}>{t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('ticketCreateScreen.title')}</Text>
          <Text style={styles.cardSubtitle}>{t('ticketCreateScreen.subtitle')}</Text>

          <Text style={styles.label}>{t('ticketCreateScreen.messageLabel')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t('ticketCreateScreen.messagePlaceholder')}
            placeholderTextColor={COLORS.placeholder}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
          />

          <Text style={styles.label}>{t('ticketCreateScreen.doLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('ticketCreateScreen.doPlaceholder')}
            placeholderTextColor={COLORS.placeholder}
            value={doNumber}
            onChangeText={setDoNumber}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
          />

          <Text style={styles.label}>{t('ticketCreateScreen.categoryLabel')}</Text>
          <Text style={styles.helper}>{t('ticketCreateScreen.categoryHint')}</Text>
          <View style={styles.categoryGrid}>
            {categories.map((category) => {
              const isActive = selectedCategory === category.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(category.id)}
                >
                  <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                    {category.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitDisabled && styles.submitButtonDisabled]}
            onPress={handleCreateTicket}
            disabled={submitDisabled}
          >
            <Text style={styles.submitText}>
              {sending ? t('ticketCreateScreen.submitting') : t('ticketCreateScreen.submit')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  background: { width: '100%', height: '100%' },
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { zIndex: 1, paddingTop: 110, paddingBottom: 20 },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 4,
    justifyContent: 'center',
    backgroundColor: COLORS.orange,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.orange,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B2A3A',
    textAlign: 'center',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 60,
  },
  topActionText: { color: '#1B2A3A', fontSize: 16, fontWeight: '600', padding: 6, includeFontPadding: false },
  card: {
    margin: 16,
    padding: 20,
    backgroundColor: COLORS.creamGlass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.blueDark },
  cardSubtitle: { marginTop: 6, marginBottom: 16, color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 10, color: COLORS.blueDark },
  helper: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.blueMid,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: COLORS.cream,
    color: COLORS.blueDark,
    minHeight: 48,
  },
  textArea: { height: 110, textAlignVertical: 'top' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.blueMid,
    backgroundColor: COLORS.cream,
  },
  categoryChipActive: { backgroundColor: COLORS.orange, borderColor: COLORS.orange },
  categoryText: { color: COLORS.blueDark, fontSize: 13, fontWeight: '600' },
  categoryTextActive: { color: COLORS.blueDark, fontWeight: '700' },
  submitButton: {
    backgroundColor: COLORS.blue,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitText: { color: COLORS.cream, fontSize: 16, fontWeight: '700' },
});
