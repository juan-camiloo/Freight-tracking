// Pantalla de chat de soporte (actualmente comentada/desactivada).
// Flujo principal:
// 1) Obtiene usuario y su ultima conversacion.
// 2) Lista historial de ai_messages.
// 3) Envia mensaje a Edge Function `chat-assistant`.
// 4) Refresca la conversacion con respuesta AI o derivacion a ticket.
/*import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LogoCorner from '../../components/LogoCorner';
import { supabase, supabaseAnonKey, supabaseUrl } from '../../lib/supabase';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'agent';
  content: string;
  created_at: string;
};

type ChatFunctionResponse = {
  conversation_id: string;
  mode: 'ai_answer' | 'handoff';
  answer: string;
};

const COLORS = {
  blue: '#1E5F99',
  blueDark: '#1B2A3A',
  orange: '#F28A07',
  cream: '#FFF6EC',
  creamGlass: 'rgba(255, 246, 236, 0.92)',
  textSecondary: '#6B7C8F',
  placeholder: '#8B98A6',
  border: '#D7E3EE',
};

export default function ChatScreen() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isInternal, setIsInternal] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    void bootstrap();
  }, []);

  const bootstrap = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_internal')
        .eq('id', user.id)
        .single();

      setIsInternal(profile?.is_internal || false);

      const { data: lastConversation } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastConversation?.id) {
        setConversationId(lastConversation.id);
        await loadMessages(lastConversation.id);
      }
    } catch (error) {
      console.error('Error iniciando chat:', error);
      Alert.alert('Error', 'No se pudo cargar el chat');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversation: string) => {
    const { data, error } = await supabase
      .from('ai_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversation)
      .order('created_at', { ascending: true });

    if (error) throw error;
    setMessages((data as ChatMessage[]) || []);
  };

  const handleSend = async () => {
    const message = input.trim();
    if (!message || sending) return;

    setSending(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        Alert.alert('Error', 'No hay sesion activa');
        return;
      }

      setInput('');

      const response = await fetch(`${supabaseUrl}/functions/v1/chat-assistant`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message,
        }),
      });

      const payload = (await response.json()) as ChatFunctionResponse | { error?: string };

      if (!response.ok) {
        throw new Error('error' in payload && payload.error ? payload.error : 'No se pudo enviar el mensaje');
      }

      if (!('conversation_id' in payload)) {
        throw new Error('Respuesta invalida');
      }

      setConversationId(payload.conversation_id);
      await loadMessages(payload.conversation_id);
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.orange} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image source={require('../../visual/background.png')} style={styles.background} resizeMode="cover" />
      </View>

      <View style={styles.fixedHeader}>
        <LogoCorner />
        <Text style={styles.headerTitle}>Chat</Text>
        <View style={styles.topActions}>
          {isInternal && (
            <TouchableOpacity onPress={() => router.push('/supportInbox' as any)}>
              <Text style={styles.topActionText}>Tickets</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={backFunction}>
            <Text style={styles.topActionText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <ScrollView style={styles.messagesWrapper} contentContainerStyle={styles.messagesContent}>
          {messages.length === 0 ? (
            <Text style={styles.emptyText}>Haz tu primera pregunta sobre tus cargas.</Text>
          ) : (
            messages.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.messageBubble,
                  item.role === 'user' ? styles.messageUser : styles.messageAssistant,
                ]}
              >
                <Text style={styles.messageText}>{item.content}</Text>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Escribe tu pregunta..."
            placeholderTextColor={COLORS.placeholder}
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={sending}>
            <Text style={styles.sendButtonText}>{sending ? 'Enviando...' : 'Enviar'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { width: '100%', height: '100%' },
  container: { flex: 1, backgroundColor: 'transparent', paddingTop: 30 },
  content: { flex: 1, zIndex: 1, paddingTop: 72 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
    color: COLORS.blueDark,
    textAlign: 'center',
    paddingBottom: 14,
  },
  topActions: {
    position: 'absolute',
    right: 16,
    top: 25,
    flexDirection: 'row',
    gap: 8,
  },
  topActionText: { color: COLORS.blueDark, fontSize: 16, fontWeight: '600', padding: 6 },
  messagesWrapper: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  messagesContent: {
    paddingBottom: 16,
    gap: 10,
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 28,
  },
  messageBubble: {
    maxWidth: '90%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  messageUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#DDEEFF',
  },
  messageAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.creamGlass,
  },
  messageText: {
    color: COLORS.blueDark,
    fontSize: 14,
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.cream,
    padding: 10,
    gap: 10,
  },
  input: {
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    color: COLORS.blueDark,
  },
  sendButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sendButtonText: {
    color: COLORS.cream,
    fontWeight: '700',
  },
});*/
