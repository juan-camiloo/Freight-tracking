// Pantalla: createTicket
// Objetivo:
// - Permitir crear tickets de soporte sin chat.
// - Validar campos minimos en cliente.
// - Enviar payload a la Edge Function `createTicket`.

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import {
    AUTH_COLORS,
    AUTH_SHADOW,
    AuthHeader,
    AuthHeaderAction,
    AuthScreenBackground,
} from '../../components/auth/AuthChrome';
import { AUTH_MOBILE_DOCK_PADDING } from '../../components/auth/AuthNavigation';
import { useNativeNotification } from '../../components/ui/NativeNotification';
import { useResponsive } from '../../hooks/useResponsive';
import { createTicketFunctionUrl, supabase, supabaseAnonKey } from '../../lib/URLs';

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
  const notification = useNativeNotification();
  const { height, isDesktop } = useResponsive();
  const keyboardOffset = Platform.OS === 'ios' ? 48 : 0;

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
      notification.error(t('ticketCreateScreen.missingMessage'));
      return;
    }
    if (!selectedCategory) {
      notification.error(t('ticketCreateScreen.missingCategory'));
      return;
    }

    setSending(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        notification.error(t('createTicket.invalidSession'));
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

      notification.success(t('ticketCreateScreen.successBody'), t('ticketCreateScreen.successTitle'));
      setMessage('');
      setDoNumber('');
      setSelectedCategory(null);
      router.replace('/');
    } catch (error) {
      notification.error(error instanceof Error ? error.message : t('chat.ticketCreateFailed'));
    } finally {
      setSending(false);
    }
  };

  const submitDisabled = sending || !message.trim() || !selectedCategory;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { minHeight: height }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardOffset}
    >
      <AuthScreenBackground />
      <AuthHeader
        title={t('dashboard.fabCreateTicket')}
        isDesktop={isDesktop}
        actions={<AuthHeaderAction label={t('common.back')} icon="arrow-back-outline" onPress={backFunction} />}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          isDesktop ? styles.contentDesktop : styles.contentMobile,
          !isDesktop && styles.contentWithDock,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, styles.shadowCard, isDesktop && styles.cardDesktop]}>
          <Text style={styles.cardTitle}>{t('ticketCreateScreen.title')}</Text>
          <Text style={styles.cardSubtitle}>{t('ticketCreateScreen.subtitle')}</Text>

          <Text style={styles.label}>{t('ticketCreateScreen.messageLabel')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t('ticketCreateScreen.messagePlaceholder')}
            placeholderTextColor={AUTH_COLORS.secondaryText}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
          />

          <Text style={styles.label}>{t('ticketCreateScreen.doLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('ticketCreateScreen.doPlaceholder')}
            placeholderTextColor={AUTH_COLORS.secondaryText}
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
              {sending ? t('ticketCreateScreen.submitting') : t('dashboard.fabCreateTicket')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AUTH_COLORS.backgroundBottom,
    overflow: 'hidden',
  },
  scroll: { flex: 1 },
  content: {
    gap: 18,
    paddingBottom: 28,
  },
  contentDesktop: {
    paddingHorizontal: 28,
    paddingTop: 24,
    alignItems: 'center',
  },
  contentMobile: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  contentWithDock: {
    paddingBottom: AUTH_MOBILE_DOCK_PADDING,
  },
  card: {
    width: '100%',
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    padding: 18,
  },
  cardDesktop: {
    maxWidth: 820,
    padding: 24,
  },
  shadowCard: AUTH_SHADOW,
  cardTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 24,
    fontWeight: '800',
  },
  cardSubtitle: {
    marginTop: 6,
    marginBottom: 8,
    color: AUTH_COLORS.secondaryText,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 10,
    color: AUTH_COLORS.secondaryText,
  },
  helper: {
    fontSize: 12,
    color: AUTH_COLORS.secondaryText,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    padding: 12,
    borderRadius: 12,
    fontSize: 16,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    color: AUTH_COLORS.primaryText,
    minHeight: 48,
  },
  textArea: {
    height: 132,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    backgroundColor: AUTH_COLORS.surfaceAlt,
  },
  categoryChipActive: {
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderColor: AUTH_COLORS.orangeBorder,
  },
  categoryText: {
    color: AUTH_COLORS.primaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  categoryTextActive: {
    fontWeight: '700',
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: AUTH_COLORS.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
    marginTop: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: AUTH_COLORS.primaryText,
    fontSize: 14,
    fontWeight: '700',
  },
});
