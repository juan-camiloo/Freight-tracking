// Archivo: app/(auth)/supportInbox/index.tsx
// Descripcion: Bandeja de tickets para usuarios internos. Permite buscar por DO o correo.

import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LogoCorner from '../../../components/LogoCorner';
import { listTicketsFunctionUrl, supabase, supabaseAnonKey } from '../../../lib/supabase';

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
  statusResolved: '#2E7D32',
};

type Ticket = {
  id: string;
  do_number: string | null;
  user_id: string | null;
  message: string;
  ticket_status: string | null;
  created_at: string;
  resolved_at: string | null;
  user_email?: string | null;
  user_nickname?: string | null;
};

// Evita loguear como error cancelaciones de promesas por navegacion o recarga.
const isAbortError = (error: unknown) =>
  error instanceof Error &&
  (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted'));

const formatDate = (raw?: string | null) => {
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString();
};

export default function SupportInbox() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [searchResults, setSearchResults] = useState<Ticket[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  const statusLabels = useMemo(
    () => ({
      opened: t('supportInbox.statusOpened'),
      in_revision: t('supportInbox.statusInRevision'),
      resolved: t('supportInbox.statusResolved'),
    }),
    [t],
  );

  const statusColors: Record<string, string> = {
    opened: COLORS.orange,
    in_revision: COLORS.blue,
    resolved: COLORS.statusResolved,
  };

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

  useEffect(() => {
    void loadTickets();
  }, []);

  // Debounce para filtro local.
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(() => {
      filterTickets();
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchQuery, tickets]);

  const loadTickets = async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/login');
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        Alert.alert(t('common.error'), t('supportInbox.noSession'));
        return;
      }

      const response = await fetch(listTicketsFunctionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorMessage = await resolveErrorMessage(response, t('supportInbox.loadError'));
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setTickets(data || []);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Error cargando tickets:', error);
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('supportInbox.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const filterTickets = () => {
    setSearching(true);
    const clean = searchQuery.trim().toLowerCase();

    const next = tickets.filter((ticket) => {
      const doNumber = ticket.do_number?.toLowerCase() ?? '';
      const email = ticket.user_email?.toLowerCase() ?? '';
      const nickname = ticket.user_nickname?.toLowerCase() ?? '';
      return doNumber.includes(clean) || email.includes(clean) || nickname.includes(clean);
    });

    setSearchResults(next);
    setSearching(false);
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

  const listData = searchQuery.trim().length > 0 ? searchResults : tickets;

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image
          source={require('../../../visual/background.png')}
          style={styles.background}
          resizeMode="cover"
        />
      </View>

      <View style={styles.fixedHeader}>
        <LogoCorner />
        <Text style={styles.headerTitle}>{t('supportInbox.headerTitle')}</Text>
        <TouchableOpacity onPress={backFunction} style={styles.topActionContainer}>
          <Text style={styles.topActionText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('supportInbox.searchPlaceholder')}
            placeholderTextColor={COLORS.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={filterTickets}
          />
        </View>

        {searching && (
          <View style={styles.searchStatus}>
            <ActivityIndicator size="small" color={COLORS.orange} />
            <Text style={styles.searchStatusText}>{t('common.searching')}</Text>
          </View>
        )}

        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const statusKey = item.ticket_status ?? 'opened';
            const statusLabel = statusLabels[statusKey as keyof typeof statusLabels] || statusKey;
            const statusColor = statusColors[statusKey] ?? COLORS.blueMid;
            const doLabel = item.do_number?.trim() ? item.do_number : t('supportInbox.noDo');
            const emailLabel = item.user_email?.trim() ? item.user_email : t('supportInbox.noEmail');
            const createdLabel = formatDate(item.created_at);
            const messageText = item.message ?? '';
            const preview =
              messageText.length > 120 ? `${messageText.slice(0, 120).trim()}...` : messageText;

            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() =>
                  router.push({
                    pathname: '/supportInbox/[id]',
                    params: { id: item.id },
                  })
                }
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardDO}>{doLabel}</Text>
                  <View style={[styles.statusPill, { backgroundColor: statusColor }]}>
                    <Text style={styles.statusText}>{statusLabel}</Text>
                  </View>
                </View>
                <Text style={styles.cardEmail}>{emailLabel}</Text>
                {createdLabel ? (
                  <Text style={styles.cardDate}>{t('supportInbox.createdAt', { date: createdLabel })}</Text>
                ) : null}
                <Text style={styles.cardMessage}>{preview}</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {searchQuery.trim().length > 0 ? t('supportInbox.notFound') : t('supportInbox.empty')}
            </Text>
          }
        />
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
    color: '#1B2A3A',
    textAlign: 'center',
    paddingBottom: 14,
  },
  topActionContainer: { position: 'absolute', right: 16, top: 25 },
  topActionText: { color: '#1B2A3A', fontSize: 16, fontWeight: '600', padding: 6 },
  searchContainer: {
    flexDirection: 'row',
    paddingTop: 16,
    padding: 15,
    backgroundColor: COLORS.cream,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    color: COLORS.blueDark,
    backgroundColor: COLORS.cream,
  },
  searchStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 15,
    paddingBottom: 10,
    backgroundColor: COLORS.cream,
  },
  searchStatusText: { color: COLORS.textSecondary, fontSize: 13 },
  card: {
    backgroundColor: COLORS.creamGlass,
    margin: 10,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardDO: { fontSize: 18, fontWeight: 'bold', color: COLORS.blueDark },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  cardEmail: { color: COLORS.blueDark, fontSize: 14, fontWeight: '600' },
  cardDate: { color: COLORS.textSecondary, fontSize: 12 },
  cardMessage: { color: COLORS.textSecondary, fontSize: 13 },
  emptyText: { textAlign: 'center', marginTop: 50, color: COLORS.textSecondary },
});
