// Pantalla: chat IA
// Objetivo:
// - Mostrar conversacion con asistente de embarques (estado local).
// - Enviar mensajes a la Edge Function `chat-assistant`.

import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { chatAssistantFunctionUrl, supabase, supabaseAnonKey } from '../../lib/supabase';

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
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

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text:
    'Hola, soy tu asistente de embarques. ¿Tienes un número de DO? ' +
    'Si tu consulta no es sobre un embarque específico, cuéntame tu pregunta.',
};

const RECOMMENDATIONS = [
  '¿Cuál es el ETA de mi x12345?',
  '¿Dónde está mi carga x12345?',
  '¿Cuál es el estado actual de mi embarque?',
  '¿Cuál es el documentary cutoff del x12345?',
];

const INACTIVITY_MS = 5 * 60 * 1000;

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
    if (match) return match[0].toUpperCase();
  }
  return null;
};

export default function ChatAssistantScreen() {
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [doNumber, setDoNumber] = useState<string | null>(null);

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
    setMessages([WELCOME_MESSAGE]);
    setInput('');
    setDoNumber(null);
    router.replace('/');
  }, []);

  const markActivity = useCallback(() => {
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);

    warningTimeoutRef.current = setTimeout(() => {
      appendMessage({
        id: `${Date.now()}-assistant-warning`,
        role: 'assistant',
        text: 'Â¿Sigues ahÃ­? Si no se detecta actividad en 5 minutos se procederÃ¡ a cerrar el chat.',
      });

      closeTimeoutRef.current = setTimeout(() => {
        closeChat();
      }, INACTIVITY_MS);
    }, INACTIVITY_MS);
  }, [appendMessage, closeChat]);

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
  }, [messages, sending]);

  const sendMessage = async (text: string) => {
    
    const clean = text.trim();
    if (!clean || sending) return;

    markActivity();
    appendMessage({
      id: `${Date.now()}-user`,
      role: 'user',
      text: clean,
    });

    setInput('');
    setSending(true);

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
      const cleanMessage = clean
      .replace(/mi do es\s+\S+/gi, '')
      .replace(/\bx\d+\b/gi, '')
      .replace(/\bm\d+\b/gi, '')
      .trim();

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
        const errorText = await response.text();
        throw new Error(errorText || 'No se pudo consultar al asistente.');
      }

      const data = await response.json();
      const answer = typeof data?.answer === 'string' ? data.answer : 'No pude responder tu consulta.';

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
          error instanceof Error
            ? `Hubo un problema al consultar el asistente: ${error.message}`
            : 'Hubo un problema al consultar el asistente.',
      });
    } finally {
      setSending(false);
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
        <Text style={styles.headerTitle}>Asistente IA</Text>
        <TouchableOpacity onPress={backFunction} style={styles.topActionContainer}>
          <Text style={styles.topActionText}>Volver</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
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
            sending ? (
              <View style={[styles.bubble, styles.assistantBubble]}>
                <View style={styles.typingRow}>
                  <ActivityIndicator size="small" color={COLORS.orange} />
                  <Text style={styles.typingText}>Pensando...</Text>
                </View>
              </View>
            ) : null
          }
        />

        {!hasUserMessages && (
          <View style={styles.recommendations}>
            <Text style={styles.recommendationsTitle}>Recomendaciones</Text>
            <View style={styles.recommendationsGrid}>
              {RECOMMENDATIONS.map((suggestion) => (
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
            placeholder="Escribe tu pregunta..."
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
            <Text style={styles.sendButtonText}>{sending ? 'Enviando...' : 'Enviar'}</Text>
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
