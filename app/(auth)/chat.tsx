// Pantalla: chat IA
// Objetivo:
// - Mostrar conversacion con asistente de cargas (estado local).
// - Enviar mensajes a la Edge Function `chat-assistant`.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AUTH_COLORS,
  AUTH_SHADOW,
  AuthHeaderAction,
  AuthScreenBackground,
} from '../../components/auth/AuthChrome';
import { AUTH_MOBILE_DOCK_PADDING } from '../../components/auth/AuthNavigation';
import { useResponsive } from '../../hooks/useResponsive';
import {
  chatAssistantFunctionUrl,
  createTicketFunctionUrl,
  supabase,
  supabaseAnonKey,
} from '../../lib/URLs';

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string | undefined;
};

const INACTIVITY_MS = 5 * 60 * 1000;

const extractDoNumber = (message: string) => {
  const patterns = [/x[- ]?\d+/i, /m[- ]?\d+/i, /X[- ]?\d+/i, /M[- ]?\d+/i, /\b\d{5,}\b/];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[0].toLowerCase();
  }
  return null;
};

export default function ChatAssistantScreen() {
  const { t } = useTranslation();
  const { height, isDesktop } = useResponsive();
  const keyboardOffset = Platform.OS === 'ios' ? 48 : 0;

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const welcomeMessage = useMemo<ChatMessage>(
    () => ({
      id: 'welcome',
      role: 'assistant',
      text: t('chat.welcome'),
    }),
    [t],
  );
  const categories = [
    { id: 'administrative', label: t('chat.options.administrative') },
    { id: 'facturation', label: t('chat.options.facturation') },
    { id: 'comercial', label: t('chat.options.comercial') },
    { id: 'pricing', label: t('chat.options.pricing') },
    { id: 'maritime', label: t('chat.options.maritime') },
    { id: 'air', label: t('chat.options.air') },
    { id: 'other', label: t('chat.options.other') },
  ];
  const recommendations = useMemo(
    () => [
      t('chat.recommendationEta'),
      t('chat.recommendationWhere'),
      t('chat.recommendationStatus'),
      t('chat.recommendationCutoff'),
    ],
    [t],
  );

  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [doNumber, setDoNumber] = useState<string | null>(null);
  const ticketMessage = useRef<string | undefined>(undefined);
  const [shouldShowTicketOption, setShouldShowTicketOption] = useState<boolean>(false);
  const [shouldShowCategoryOptions, setShouldShowCategoryOptions] = useState<boolean>(false);

  const hasUserMessages = useMemo(
    () => messages.some((message) => message.role === 'user'),
    [messages],
  );

  const ensureSession = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      router.replace('/login');
    }
  };

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const closeChat = useCallback(() => {
    setMessages([welcomeMessage]);
    setInput('');
    setDoNumber(null);
    router.replace('/');
  }, [welcomeMessage]);

  const markActivity = useCallback(() => {
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);

    warningTimeoutRef.current = setTimeout(() => {
      appendMessage({
        id: `${Date.now()}-assistant-warning`,
        role: 'assistant',
        text: t('chat.inactivityWarning'),
      });

      closeTimeoutRef.current = setTimeout(() => {
        closeChat();
      }, INACTIVITY_MS);
    }, INACTIVITY_MS);
  }, [appendMessage, closeChat, t]);

  useEffect(() => {
    void ensureSession();
  }, []);

  useEffect(() => {
    markActivity();
    return () => {
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, [markActivity]);

  useEffect(() => {
    if (!listRef.current) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages, sending, shouldShowTicketOption, shouldShowCategoryOptions]);

  const resolveAnswerFromPayload = (payload: any) => {
    if (typeof payload?.answer_key === 'string') {
      return t(payload.answer_key, payload.answer_params ?? {});
    }
    return null;
  };

  const resolveErrorMessage = async (response: Response, fallbackMessage: string) => {
    const raw = await response.text();
    if (!raw) return fallbackMessage;
    try {
      const payload = JSON.parse(raw);
      if (typeof payload?.error_key === 'string') {
        return t(payload.error_key, payload.error_params ?? {});
      }
      if (typeof payload?.answer_key === 'string') {
        return t(payload.answer_key, payload.answer_params ?? {});
      }
      if (typeof payload?.error === 'string') return payload.error;
      if (typeof payload?.answer === 'string') return payload.answer;
    } catch {
      // ignore JSON parse errors
    }
    return raw;
  };

  const buildUserMessageError = (message: string) => {
    const error = new Error(message);
    (error as Error & { userMessage?: string }).userMessage = message;
    return error;
  };

  const sendMessage = async (text: string) => {
    setShouldShowTicketOption(false);

    const clean = text.trim();
    if (!clean || sending) return;

    markActivity();
    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text: clean,
    };
    appendMessage(userMessage);
    setInput('');
    setSending(true);
    if (!ticketMessage.current) {
      ticketMessage.current = userMessage.text;
    }
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        router.replace('/login');
        return;
      }

      const extractedDo = extractDoNumber(clean);
      const resolvedDo = extractedDo || doNumber;
      if (extractedDo) setDoNumber(extractedDo);
      const cleanMessage =
        clean
          .replace(/mi do es\s+\S+/gi, '')
          .replace(/\bx\d+\b/gi, '')
          .replace(/\bm\d+\b/gi, '')
          .trim() || '¿Puedes darme la información que tengas sobre mi embarque?';

      const response = await fetch(chatAssistantFunctionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: cleanMessage,
          do_number: resolvedDo,
        }),
      });

      if (!response.ok) {
        const errorMessage = await resolveErrorMessage(response, t('chat.assistantRequestError'));
        throw buildUserMessageError(errorMessage);
      }
      const data = await response.json();
      const translatedAnswer = resolveAnswerFromPayload(data);
      const answer =
        translatedAnswer ??
        (typeof data?.answer === 'string' ? data.answer : t('chat.assistantFallback'));

      if (data.mode === 'handoff') {
        setShouldShowTicketOption(true);
      }
      appendMessage({
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        text: answer,
      });
    } catch (error) {
      appendMessage({
        id: `${Date.now()}-assistant-error`,
        role: 'assistant',
        text:
          typeof (error as { userMessage?: string })?.userMessage === 'string'
            ? (error as { userMessage?: string }).userMessage
            : error instanceof Error
              ? t('chat.assistantErrorWithDetail', { message: error.message })
              : t('chat.assistantError'),
      });
    } finally {
      setSending(false);
    }
  };

  const handleCreateTicket = async (category: string) => {
    const { data: dataSession } = await supabase.auth.getSession();
    const accessToken = dataSession.session?.access_token;
    if (!accessToken) return;
    try {
      const response = await fetch(createTicketFunctionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: ticketMessage.current ?? '',
          do_number: doNumber || null,
          category: category || null,
        }),
      });
      if (!response.ok) {
        const errorMessage = await resolveErrorMessage(response, t('chat.ticketRequestError'));
        throw buildUserMessageError(errorMessage);
      }
      ticketMessage.current = undefined;
      setShouldShowTicketOption(false);

      appendMessage({
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        text: t('chat.createdTicket'),
      });
    } catch (error) {
      appendMessage({
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        text:
          typeof (error as { userMessage?: string })?.userMessage === 'string'
            ? (error as { userMessage?: string }).userMessage
            : error instanceof Error
              ? t('chat.ticketCreateFailedWithDetail', { message: error.message })
              : t('chat.ticketCreateFailed'),
      });
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    markActivity();
    setInput(suggestion);
  };

  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { minHeight: height }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardOffset}
    >
      <AuthScreenBackground />
      <AuthHeader
        title={t('dashboard.fabAssistant')}
        isDesktop={isDesktop}
        actions={<AuthHeaderAction label={t('common.back')} icon="arrow-back-outline" onPress={backFunction} />}
      />

      <View style={[styles.content, !isDesktop && styles.contentWithDock]}>
        <View style={[styles.chatFrame, isDesktop && styles.chatFrameDesktop]}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            style={styles.chatList}
            contentContainerStyle={styles.chatContent}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.bubble,
                  item.role === 'user' ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    item.role === 'user' ? styles.userText : styles.assistantText,
                  ]}
                >
                  {item.text}
                </Text>
              </View>
            )}
            ListFooterComponent={
              sending || shouldShowTicketOption || shouldShowCategoryOptions ? (
                <View style={styles.footer}>
                  {sending ? (
                    <View style={[styles.bubble, styles.assistantBubble]}>
                      <View style={styles.typingRow}>
                        <ActivityIndicator size="small" color={AUTH_COLORS.orange} />
                        <Text style={styles.typingText}>{t('chat.typing')}</Text>
                      </View>
                    </View>
                  ) : null}
                  {shouldShowTicketOption ? (
                    <View style={[styles.bubble, styles.assistantBubble, styles.ticketCard]}>
                      <Text style={styles.ticketPrompt}>{t('chat.createTicketOption')}</Text>
                      <View style={styles.ticketActions}>
                        <TouchableOpacity
                          onPress={() => {
                            setShouldShowCategoryOptions(true);
                            setShouldShowTicketOption(false);
                          }}
                          style={[styles.ticketButton, styles.ticketButtonPrimary]}
                        >
                          <Text style={styles.ticketButtonPrimaryText}>{t('common.yes')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setShouldShowTicketOption(false)}
                          style={[styles.ticketButton, styles.ticketButtonSecondary]}
                        >
                          <Text style={styles.ticketButtonSecondaryText}>{t('common.no')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}
                  {shouldShowCategoryOptions ? (
                    <View style={[styles.bubble, styles.assistantBubble, styles.ticketCard]}>
                      <Text style={styles.ticketPrompt}>{t('chat.categoryOptionsPrompt')}</Text>
                      <View style={styles.ticketActions}>
                        {categories.map((cat) => (
                          <TouchableOpacity
                            key={cat.id}
                            onPress={() => {
                              setShouldShowCategoryOptions(false);
                              void handleCreateTicket(cat.id);
                            }}
                            style={[styles.ticketButton, styles.ticketButtonPrimary]}
                          >
                            <Text style={styles.ticketButtonPrimaryText}>{cat.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null
            }
          />

          {!hasUserMessages ? (
            <View style={[styles.recommendations, styles.shadowCard]}>
              <Text style={styles.recommendationsTitle}>{t('chat.recommendationsTitle')}</Text>
              <View style={styles.recommendationsGrid}>
                {recommendations.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion}
                    style={styles.recommendationChip}
                    onPress={() => handleSuggestionPress(suggestion)}
                  >
                    <Text style={styles.recommendationText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          <View style={[styles.inputBar, styles.shadowCard]}>
            <TextInput
              style={styles.input}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={AUTH_COLORS.secondaryText}
              value={input}
              onChangeText={(value) => {
                markActivity();
                setInput(value);
              }}
              onSubmitEditing={() => sendMessage(input)}
              returnKeyType="send"
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || sending}
            >
              <Ionicons name="paper-plane-outline" size={18} color={AUTH_COLORS.primaryText} />
              <Text style={styles.sendButtonText}>{sending ? t('common.sending') : t('chat.send')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AUTH_COLORS.backgroundBottom,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
  },
  contentWithDock: {
    paddingBottom: AUTH_MOBILE_DOCK_PADDING,
  },
  chatFrame: {
    flex: 1,
    gap: 14,
  },
  chatFrameDesktop: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  chatList: {
    flex: 1,
  },
  chatContent: {
    gap: 10,
    paddingBottom: 8,
  },
  shadowCard: AUTH_SHADOW,
  bubble: {
    padding: 14,
    borderRadius: 20,
    maxWidth: '86%',
    borderWidth: 1,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: AUTH_COLORS.surface,
    borderColor: AUTH_COLORS.line,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderColor: AUTH_COLORS.orangeBorder,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  assistantText: {
    color: AUTH_COLORS.primaryText,
  },
  userText: {
    color: AUTH_COLORS.primaryText,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingText: {
    color: AUTH_COLORS.secondaryText,
  },
  footer: {
    gap: 10,
    paddingTop: 2,
  },
  ticketCard: {
    gap: 12,
  },
  ticketPrompt: {
    color: AUTH_COLORS.primaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  ticketActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ticketButton: {
    minHeight: 38,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketButtonPrimary: {
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderColor: AUTH_COLORS.orangeBorder,
  },
  ticketButtonPrimaryText: {
    color: AUTH_COLORS.primaryText,
    fontWeight: '700',
  },
  ticketButtonSecondary: {
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderColor: AUTH_COLORS.line,
  },
  ticketButtonSecondaryText: {
    color: AUTH_COLORS.primaryText,
    fontWeight: '600',
  },
  recommendations: {
    padding: 14,
    borderRadius: 22,
    backgroundColor: AUTH_COLORS.surface,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    gap: 10,
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: AUTH_COLORS.primaryText,
  },
  recommendationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recommendationChip: {
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  recommendationText: {
    color: AUTH_COLORS.primaryText,
    fontSize: 12,
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    borderRadius: 22,
    backgroundColor: AUTH_COLORS.surface,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 132,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderRadius: 14,
    color: AUTH_COLORS.primaryText,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  sendButton: {
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: AUTH_COLORS.primaryText,
    fontWeight: '700',
  },
});
