// Pantalla: chat IA
// Objetivo:
// - Mostrar conversacion con asistente de cargas (estado local).
// - Enviar mensajes a la Edge Function `chat-assistant`.

import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LogoCorner from '../../components/LogoCorner';
import { chatAssistantFunctionUrl, createTicketFunctionUrl, supabase, supabaseAnonKey } from '../../lib/supabase';

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string | undefined;
};

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
  bubbleAssistant: '#FFFFFF',
  bubbleUser: '#1E5F99',
};

// Tiempo de inactividad antes de advertir y luego cerrar el chat.
const INACTIVITY_MS = 5 * 60 * 1000;

// Extrae un posible DO desde texto libre.
const extractDoNumber = (message: string) => {
  const patterns = [
    /x[- ]?\d+/i,    
    /m[- ]?\d+/i,
    /X[- ]?\d+/i,
    /M[- ]?\d+/i,
    /\b\d{5,}\b/
  ]
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[0].toLowerCase();
  }
  return null;
};

export default function ChatAssistantScreen() {
  const { t } = useTranslation();
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
  {id: "administrative", label: t('chat.options.administrative')},
  {id: "facturation", label: t('chat.options.facturation')},
  {id: "comercial", label: t('chat.options.comercial')},
  {id: "pricing", label: t('chat.options.pricing')},
  {id: "maritime", label: t('chat.options.maritime')},
  {id: "air", label: t('chat.options.air')},
  {id: "other", label: t('chat.options.other')}
]
  const recommendations = useMemo(
    () => [
      t('chat.recommendationEta'),
      t('chat.recommendationWhere'),
      t('chat.recommendationStatus'),
      t('chat.recommendationCutoff'),
    ],
    [t],
  );
  // Referencias para controlar timers de inactividad.
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Historial local (no se guarda en DB).
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  // Texto actual en el input.
  const [input, setInput] = useState('');
  // Flag de envio para evitar doble submit.
  const [sending, setSending] = useState(false);
  // DO detectado en la conversacion.
  const [doNumber, setDoNumber] = useState<string | null>(null);
  // Gestión de creación de tickets
  const ticketMessage = useRef<string | undefined>(undefined)
  const [shouldShowTicketOption, setShouldShowTicketOption] = useState<boolean>(false);
  const [shouldShowCategoryOptions, setShouldShowCategoryOptions] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState <string | null>(null);

  // Se usa para ocultar recomendaciones luego del primer mensaje del usuario.
  const hasUserMessages = useMemo(
    () => messages.some((message) => message.role === 'user'),
    [messages],
  );

  // Verifica que haya sesion activa; si no, vuelve al login.
  const ensureSession = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      router.replace('/login');
    }
  };

  // Agrega mensaje al historial local.
  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  // Resetea el chat y vuelve a la pantalla principal.
  const closeChat = useCallback(() => {
    setMessages([welcomeMessage]);
    setInput('');
    setDoNumber(null);
    router.replace('/');
  }, [welcomeMessage]);

  // Reinicia timers de inactividad en cada accion del usuario.
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
  }, [appendMessage, closeChat]);

  useEffect(() => {
    void ensureSession();
  }, []);

  // Inicializa y limpia timers de inactividad.
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
  }, [messages, sending, shouldShowTicketOption]);

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
  

  // Envia mensaje del usuario a la Edge Function.
  const sendMessage = async (text: string) => {
    setShouldShowTicketOption(false)
    
    const clean = text.trim();
    if (!clean || sending) return;

    markActivity();
    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text: clean,
    };
    appendMessage (userMessage);
    setInput('');
    setSending(true);
    if (!ticketMessage.current){
      ticketMessage.current= userMessage.text
    }
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        router.replace('/login');
        return;
      }

      // Extrae DO del mensaje y lo mantiene en memoria.
      const extractedDo = extractDoNumber(clean);
      const resolvedDo = extractedDo || doNumber;
      if (extractedDo) setDoNumber(extractedDo);
      // Limpiamos el DO del texto antes de enviarlo a la IA.
      const cleanMessage = clean
      .replace(/mi do es\s+\S+/gi, '')
      .replace(/\bx\d+\b/gi, '')
      .replace(/\bm\d+\b/gi, '')
      .trim() || "¿Puedes darme la información que tengas sobre mi embarque?";

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
      console.log("Status:", response.status)

      if (!response.ok) {
        const errorMessage = await resolveErrorMessage(response, t('chat.assistantRequestError'));
        throw buildUserMessageError(errorMessage);
      }
      const data = await response.json();
      const translatedAnswer = resolveAnswerFromPayload(data);
      const answer =
        translatedAnswer ??
        (typeof data?.answer === 'string' ? data.answer : t('chat.assistantFallback'));

      if (data.mode === "handoff"){
        console.log("ticketMessage actual:", ticketMessage)
        console.log("data.mode: ", data.mode)
        console.log("userMessage.text:", userMessage.text)

        setShouldShowTicketOption(true)
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
  const handleCreateTicket = async (category:string) =>{
    console.log("ticketMessage al crear ticket:", ticketMessage)
    const {data: dataSession} = await supabase.auth.getSession()
    const accessToken=dataSession.session?.access_token
    if (!accessToken) return;
    try{
      const response = await fetch (createTicketFunctionUrl,{
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: ticketMessage.current ?? '',
          do_number: doNumber || null,
          category: category || null,
        }),          
      })
      if (!response.ok){
        const errorMessage = await resolveErrorMessage(response, t('chat.ticketRequestError'))
        throw buildUserMessageError(errorMessage)
      }
      ticketMessage.current= undefined
      setShouldShowTicketOption(false);
      
      appendMessage({
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        text: t('chat.createdTicket')
      })
  }catch (error){
    appendMessage({
      id: `${Date.now()}-assistant`,
      role: 'assistant',
      text: 
        typeof (error as { userMessage?: string })?.userMessage === 'string'
          ? (error as { userMessage?: string }).userMessage
          : error instanceof Error
            ? t('chat.ticketCreateFailedWithDetail', { message: error.message })
            : t('chat.ticketCreateFailed')
    })
  }
  }

  // Prellena input con una sugerencia.
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <View style={StyleSheet.absoluteFill}>
        <Image
          source={require('../../visual/background.png')}
          style={styles.background}
          resizeMode="cover"
        />
      </View>

      <View style={styles.fixedHeader}>
        <LogoCorner />
        <Text style={styles.headerTitle}>{t('chat.headerTitle')}</Text>
        <TouchableOpacity onPress={backFunction} style={styles.topActionContainer}>
          <Text style={styles.topActionText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
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
                      <ActivityIndicator size="small" color={COLORS.orange} />
                      <Text style={styles.typingText}>{t('chat.typing')}</Text>
                    </View>
                  </View>
                ) : null}
                {shouldShowTicketOption ? (
                  <View style={[styles.bubble, styles.assistantBubble, styles.ticketCard]}>
                    <Text style={styles.ticketPrompt}>{t('chat.createTicketOption')}</Text>
                    <View style={styles.ticketActions}>
                      <TouchableOpacity
                        onPress={() => setShouldShowCategoryOptions(true)}
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
                {shouldShowCategoryOptions?(
                  <View style={[styles.bubble, styles.assistantBubble, styles.ticketCard]}>
                    <Text style={styles.ticketPrompt}>{t('chat.categoryOptionsPrompt')}</Text>
                    <View style={styles.ticketActions}>
                      {categories.map((cat) =>(
                      <TouchableOpacity
                        key={cat.id}
                        onPress= {()=>{
                          setSelectedCategory(cat.id)
                          setShouldShowCategoryOptions(false)
                          handleCreateTicket(cat.id)
                        }}
                        style = {[styles.ticketButton, styles.ticketButtonPrimary]}
                      >
                      <Text style= {styles.ticketButtonPrimaryText}>{cat.label}</Text>
                      </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ): null} 
              </View>
            ) : null
          }
        />

        {!hasUserMessages && (
          <View style={styles.recommendations}>
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
        )}
      
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={COLORS.placeholder}
            value={input}
            onChangeText={(value) => {
              markActivity();
              setInput(value);
            }}
            onSubmitEditing={() => sendMessage(input)}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || sending}
          >
            <Text style={styles.sendButtonText}>{sending ? t('chat.sending') : t('chat.send')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  background: { width: '100%', height: '100%' },
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { flex: 1, zIndex: 1, paddingTop: 100, paddingBottom: 16 },
  chatContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B2A3A',
    textAlign: 'center',
    paddingBottom: 14,
  },
  topActionContainer: { position: 'absolute', right: 16, top: 25 },
  topActionText: { color: '#1B2A3A', fontSize: 16, fontWeight: '600', padding: 6 },
  bubble: {
    padding: 12,
    borderRadius: 14,
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.bubbleAssistant,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.bubbleUser,
    borderColor: COLORS.bubbleUser,
  },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  assistantText: { color: COLORS.blueDark },
  userText: { color: COLORS.cream },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { color: COLORS.textSecondary },
  footer: { gap: 10 },
  ticketCard: { gap: 10 },
  ticketPrompt: { color: COLORS.blueDark, fontSize: 13, lineHeight: 18 },
  ticketActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ticketButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  ticketButtonPrimary: { backgroundColor: COLORS.orange, borderColor: COLORS.orange },
  ticketButtonPrimaryText: { color: COLORS.blueDark, fontWeight: '700' },
  ticketButtonSecondary: { backgroundColor: 'transparent', borderColor: COLORS.blueMid },
  ticketButtonSecondaryText: { color: COLORS.blueDark, fontWeight: '600' },
  recommendations: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.creamGlass,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.blueDark,
    marginBottom: 8,
  },
  recommendationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recommendationChip: {
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.blueMid,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  recommendationText: { color: COLORS.blueDark, fontSize: 12 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.creamGlass,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: COLORS.cream,
    borderRadius: 10,
    color: COLORS.blueDark,
  },
  sendButton: {
    backgroundColor: COLORS.orange,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  sendButtonDisabled: { opacity: 0.6 },
  sendButtonText: { color: COLORS.blueDark, fontWeight: '700' },
});
