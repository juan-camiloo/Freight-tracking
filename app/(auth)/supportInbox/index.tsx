// Archivo: app/(auth)/supportInbox/index.tsx
// Descripcion: Bandeja de tickets para usuarios internos. Permite buscar por DO o correo.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    AUTH_COLORS,
    AUTH_SHADOW,
    AuthHeader,
    AuthHeaderAction,
    AuthScreenBackground,
} from '../../../components/auth/AuthChrome';
import { AUTH_MOBILE_DOCK_PADDING } from '../../../components/auth/AuthNavigation';
import { AuthSearchBar } from '../../../components/auth/AuthSearchBar';
import { useNativeNotification } from '../../../components/ui/NativeNotification';
import { useResponsive } from '../../../hooks/useResponsive';
import { listTicketsFunctionUrl, supabase, supabaseAnonKey } from '../../../lib/URLs';
import { formatDateDisplay } from '../../../utils/dateFormatting';

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

const isAbortError = (error: unknown) =>
  error instanceof Error &&
  (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted'));

export default function SupportInbox() {
  const { t, i18n } = useTranslation();
  const notification = useNativeNotification();
  const { height, isDesktop } = useResponsive();

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

  const statusStyles: Record<string, { backgroundColor: string; textColor: string }> = {
    opened: { backgroundColor: AUTH_COLORS.orangeSoft, textColor: AUTH_COLORS.orange },
    in_revision: { backgroundColor: AUTH_COLORS.blueSoft, textColor: AUTH_COLORS.blue },
    resolved: { backgroundColor: AUTH_COLORS.greenSoft, textColor: AUTH_COLORS.green },
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
        notification.error(t('supportInbox.noSession'));
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
      notification.error(error instanceof Error ? error.message : t('supportInbox.loadError'));
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
      <View style={[styles.center, styles.container]}>
        <AuthScreenBackground />
        <ActivityIndicator size="large" color={AUTH_COLORS.orange} />
      </View>
    );
  }

  const listData = searchQuery.trim().length > 0 ? searchResults : tickets;

  return (
    <View style={[styles.container, { minHeight: height }]}>
      <AuthScreenBackground />
      <AuthHeader
        title={t('supportInbox.headerTitle')}
        isDesktop={isDesktop}
        actions={<AuthHeaderAction label={t('common.back')} icon="arrow-back-outline" onPress={backFunction} />}
      />

      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          isDesktop ? styles.listContentDesktop : styles.listContentMobile,
          !isDesktop && styles.contentWithDock,
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <View style={[styles.searchCard, styles.shadowCard]}>
              <AuthSearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('supportInbox.searchPlaceholder')}
                onSubmitEditing={filterTickets}
                searching={searching}
              />
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const statusKey = item.ticket_status ?? 'opened';
          const statusLabel = statusLabels[statusKey as keyof typeof statusLabels] || statusKey;
          const statusTone = statusStyles[statusKey] ?? statusStyles.in_revision;
          const doLabel = item.do_number?.trim() ? item.do_number : t('supportInbox.noDo');
          const emailLabel = item.user_email?.trim() ? item.user_email : t('supportInbox.noEmail');
          const createdLabel = formatDateDisplay(item.created_at, i18n.language === 'es' ? 'es-CO' : 'en-US');
          const messageText = item.message ?? '';
          const preview =
            messageText.length > 120 ? `${messageText.slice(0, 120).trim()}...` : messageText;

          return (
            <TouchableOpacity
              style={[styles.card, styles.shadowCard]}
              onPress={() =>
                router.push({
                  pathname: '/supportInbox/[id]',
                  params: { id: item.id },
                })
              }
            >
              <View style={styles.cardHeader}>
                <View style={styles.ticketBadge}>
                  <Ionicons name="mail-open-outline" size={18} color={AUTH_COLORS.blue} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardDO}>{doLabel}</Text>
                  <Text style={styles.cardEmail}>{emailLabel}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: statusTone.backgroundColor }]}>
                  <Text style={[styles.statusText, { color: statusTone.textColor }]}>{statusLabel}</Text>
                </View>
              </View>

              {createdLabel ? (
                <Text style={styles.cardDate}>{t('supportInbox.createdAt', { date: createdLabel })}</Text>
              ) : null}

              <Text style={styles.cardMessage}>{preview}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={[styles.emptyState, styles.shadowCard]}>
            <Ionicons name="mail-outline" size={34} color={AUTH_COLORS.secondaryText} />
            <Text style={styles.emptyTitle}>
              {searchQuery.trim().length > 0 ? t('supportInbox.notFound') : t('supportInbox.empty')}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AUTH_COLORS.backgroundBottom,
    overflow: 'hidden',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 14,
    paddingBottom: 28,
  },
  listContentDesktop: {
    paddingHorizontal: 28,
    paddingTop: 24,
  },
  listContentMobile: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  contentWithDock: {
    paddingBottom: AUTH_MOBILE_DOCK_PADDING,
  },
  headerStack: {
    gap: 14,
    marginBottom: 2,
  },
  searchCard: {
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    padding: 14,
    gap: 10,
  },
  shadowCard: AUTH_SHADOW,
  card: {
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ticketBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: AUTH_COLORS.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardDO: {
    fontSize: 18,
    fontWeight: '800',
    color: AUTH_COLORS.primaryText,
  },
  cardEmail: {
    marginTop: 4,
    color: AUTH_COLORS.secondaryText,
    fontSize: 13,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    fontWeight: '700',
    fontSize: 12,
  },
  cardDate: {
    color: AUTH_COLORS.secondaryText,
    fontSize: 12,
  },
  cardMessage: {
    color: AUTH_COLORS.primaryText,
    fontSize: 13,
    lineHeight: 19,
  },
  emptyState: {
    marginTop: 10,
    paddingVertical: 34,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: AUTH_COLORS.surface,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  emptyTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
});
