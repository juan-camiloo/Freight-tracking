// Archivo: app/(auth)/supportInbox/[id].tsx
// Descripcion: Detalle de ticket para usuarios internos. Permite actualizar estado.

import { COLORS } from '@/components/ui/COLORS';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    AUTH_SHADOW,
    AuthScreenBackground
} from '../../../components/auth/AuthChrome';
import { AUTH_MOBILE_DOCK_PADDING } from '../../../components/auth/AuthNavigation';
import Header from '../../../components/Header';
import { useNativeNotification } from '../../../components/ui/NativeNotification';
import { useResponsive } from '../../../hooks/useResponsive';
import {
    listTicketsFunctionUrl,
    supabase,
    supabaseAnonKey,
    updateTicketFunctionUrl,
} from '../../../lib/URLs';
import { formatDateTimeDisplay } from '../../../utils/dateFormatting';

type Ticket = {
  id: string;
  do_number: string | null;
  user_id: string | null;
  message: string;
  ticket_status: string | null;
  category?: string | null;
  created_at: string;
  resolved_at: string | null;
  user_email?: string | null;
  user_nickname?: string | null;
  resolved_by_name?: string | null;
};

export default function TicketDetail() {
  const { t, i18n } = useTranslation();
  const notification = useNativeNotification();
  const { id } = useLocalSearchParams();
  const { height, isDesktop } = useResponsive();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [isInternal, setIsInternal] = useState(true);
  const ticketId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';

  const statusLabels = useMemo(
    () => ({
      opened: t('supportInbox.statusOpened'),
      in_revision: t('supportInbox.statusInRevision'),
      resolved: t('supportInbox.statusResolved'),
    }),
    [t],
  );

  const statusStyles: Record<string, { backgroundColor: string; textColor: string }> = {
    opened: { backgroundColor: COLORS.orangeSoft, textColor: COLORS.orange },
    in_revision: { backgroundColor: COLORS.blueSoft, textColor: COLORS.blue },
    resolved: { backgroundColor: COLORS.greenSoft, textColor: COLORS.green },
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
    void loadTicket();
  }, [ticketId]);

  const loadTicket = async () => {
    try {
      if (!ticketId) {
        setTicket(null);
        return;
      }
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/login');
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('is_internal')
        .eq('id', user.id)
        .maybeSingle();
      setIsInternal(Boolean(profileData?.is_internal));

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
        body: JSON.stringify({ ticket_id: ticketId }),
      });

      if (!response.ok) {
        const errorMessage = await resolveErrorMessage(response, t('ticketDetail.loadError'));
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const ticketData = Array.isArray(data) ? data[0] : data?.ticket;
      setTicket(ticketData ?? null);
    } catch (error) {
      notification.error(error instanceof Error ? error.message : t('ticketDetail.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (nextStatus: 'opened' | 'in_revision' | 'resolved') => {
    if (!ticket) return;
    setUpdating(nextStatus);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        notification.error(t('supportInbox.noSession'));
        return;
      }

      const response = await fetch(updateTicketFunctionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticket_id: ticket.id, status: nextStatus }),
      });

      if (!response.ok) {
        const errorMessage = await resolveErrorMessage(response, t('ticketDetail.updateError'));
        throw new Error(errorMessage);
      }

      const payload = await response.json();
      const updated = payload?.ticket ?? payload;
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              ...updated,
              user_email: prev.user_email ?? updated?.user_email,
              user_nickname: prev.user_nickname ?? updated?.user_nickname,
            }
          : updated,
      );
      notification.success(t('ticketDetail.updateOk'));

      if (nextStatus === 'resolved') {
        router.replace('/supportInbox');
      }
    } catch (error) {
      notification.error(error instanceof Error ? error.message : t('ticketDetail.updateError'));
    } finally {
      setUpdating(null);
    }
  };

  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/supportInbox');
  };

  if (loading) {
    return (
      <View style={[styles.center, styles.container]}>
        <AuthScreenBackground />
        <ActivityIndicator size="large" color={COLORS.orange} />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={[styles.center, styles.container]}>
        <AuthScreenBackground />
        <Text style={styles.emptyText}>{t('ticketDetail.notFound')}</Text>
      </View>
    );
  }

  const statusKey = ticket.ticket_status ?? 'opened';
  const statusLabel = statusLabels[statusKey as keyof typeof statusLabels] || statusKey;
  const statusTone = statusStyles[statusKey] ?? statusStyles.in_revision;
  const resolvedLabel = ticket.resolved_at
    ? formatDateTimeDisplay(ticket.resolved_at, i18n.language === 'es' ? 'es-CO' : 'en-US')
    : t('ticketDetail.notResolved');
  const createdLabel = formatDateTimeDisplay(ticket.created_at, i18n.language === 'es' ? 'es-CO' : 'en-US');
  const emailLabel = ticket.user_email?.trim() ? ticket.user_email : t('supportInbox.noEmail');
  const doLabel = ticket.do_number?.trim() ? ticket.do_number : t('supportInbox.noDo');

  const categoryLabel = ticket.category
    ? t(`chatbot.options.${ticket.category}`, { defaultValue: ticket.category })
    : null;

  return (
    <View style={styles.container}>
      <AuthScreenBackground />
      <Header
        title={t('ticketDetail.headerTitle')}
        isDesktop={isDesktop}
        showSearch={false}
        onGoBack={backFunction}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          isDesktop ? styles.contentDesktop : styles.contentMobile,
          !isDesktop && styles.contentWithDock,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroCard, styles.shadowCard]}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{doLabel}</Text>
              <Text style={styles.heroMeta}>{emailLabel}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusTone.backgroundColor }]}>
              <Text style={[styles.statusText, { color: statusTone.textColor }]}>{statusLabel}</Text>
            </View>
          </View>

          <View style={styles.heroStats}>
            <StatCard label={t('ticketDetail.labels.createdAt')} value={createdLabel} icon="time-outline" />
            <StatCard label={t('ticketDetail.labels.resolvedAt')} value={resolvedLabel} icon="checkmark-done-outline" />
            {ticket.ticket_status === 'resolved' && ticket.resolved_by_name ? (
              <StatCard
                label={t('ticketDetail.labels.resolvedBy', { defaultValue: 'Resuelto por' })}
                value={ticket.resolved_by_name}
                icon="person-circle-outline"
              />
            ) : null}
          </View>
        </View>

        <View style={[styles.section, styles.shadowCard]}>
          <Text style={styles.sectionTitle}>{t('ticketDetail.sectionMessage')}</Text>
          <Text style={styles.messageText}>{ticket.message}</Text>
        </View>

        <View style={[styles.section, styles.shadowCard]}>
          <Text style={styles.sectionTitle}>{t('ticketDetail.sectionInfo')}</Text>
          <InfoRow label={t('ticketDetail.labels.doNumber')} value={doLabel} />
          {categoryLabel ? (
            <InfoRow
              label={t('ticketCreateScreen.categoryLabel', { defaultValue: 'Área / Categoría' })}
              value={categoryLabel}
            />
          ) : null}
          <InfoRow label={t('ticketDetail.labels.email')} value={emailLabel} />
          <InfoRow label={t('ticketDetail.labels.status')} value={statusLabel} />
          {ticket.ticket_status === 'resolved' && ticket.resolved_by_name ? (
            <InfoRow
              label={t('ticketDetail.labels.resolvedBy', { defaultValue: 'Resuelto por' })}
              value={ticket.resolved_by_name}
            />
          ) : null}
        </View>

        {isInternal && (
          <View style={[styles.section, styles.shadowCard]}>
            <Text style={styles.sectionTitle}>{t('ticketDetail.sectionActions')}</Text>
            <View style={styles.actionsRow}>
              {ticket.ticket_status !== 'resolved' ? (
                <>
                  <TouchableOpacity
                    style={[styles.secondaryButton, updating && styles.buttonDisabled]}
                    onPress={() => updateStatus('in_revision')}
                    disabled={Boolean(updating)}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {updating === 'in_revision' ? t('ticketDetail.updating') : t('ticketDetail.actionInRevision')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryButton, updating && styles.buttonDisabled]}
                    onPress={() => updateStatus('resolved')}
                    disabled={Boolean(updating)}
                  >
                    <Text style={styles.primaryButtonText}>
                      {updating === 'resolved' ? t('ticketDetail.updating') : t('ticketDetail.actionResolve')}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.secondaryButton, updating && styles.buttonDisabled]}
                  onPress={() => updateStatus('opened')}
                  disabled={Boolean(updating)}
                >
                  <Text style={styles.secondaryButtonText}>
                    {updating === 'opened' ? t('ticketDetail.updating') : t('ticketDetail.actionReopen')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
};

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
};

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIconWrap}>
        <Ionicons name={icon} size={18} color={COLORS.blue} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundBottom,
    overflow: 'hidden',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.surface,
    fontSize: 15,
  },
  scroll: { flex: 1 },
  content: {
    gap: 18,
    paddingBottom: 28,
  },
  contentDesktop: {
    paddingHorizontal: 28,
    paddingTop: 24,
  },
  contentMobile: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  contentWithDock: {
    paddingBottom: AUTH_MOBILE_DOCK_PADDING,
  },
  shadowCard: AUTH_SHADOW,
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 22,
    gap: 18,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    color: COLORS.primaryText,
    fontSize: 30,
    fontWeight: '800',
  },
  heroMeta: {
    color: COLORS.secondaryText,
    fontSize: 14,
    marginTop: 4,
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statCard: {
    flexGrow: 1,
    minWidth: 160,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surfaceAlt,
    gap: 6,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.blueSoft,
    marginBottom: 4,
  },
  statLabel: {
    color: COLORS.secondaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  statValue: {
    color: COLORS.primaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 18,
    gap: 14,
  },
  sectionTitle: {
    color: COLORS.primaryText,
    fontSize: 18,
    fontWeight: '800',
  },
  messageText: {
    color: COLORS.primaryText,
    lineHeight: 21,
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  infoLabel: {
    flex: 1,
    color: COLORS.secondaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    flex: 1,
    color: COLORS.primaryText,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    flexGrow: 1,
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: COLORS.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.orangeBorder,
  },
  primaryButtonText: {
    color: COLORS.primaryText,
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    flexGrow: 1,
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  secondaryButtonText: {
    color: COLORS.primaryText,
    fontWeight: '700',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
