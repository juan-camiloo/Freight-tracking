  // Archivo: app/(auth)/supportInbox/[id].tsx
  // Descripcion: Detalle de ticket para usuarios internos. Permite actualizar estado.

  import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LogoCorner from '../../../components/LogoCorner';
import { listTicketsFunctionUrl, supabase, supabaseAnonKey, updateTicketFunctionUrl } from '../../../lib/supabase';

  const COLORS = {
    blue: '#1E5F99',
    blueMid: '#2B6AA0',
    blueDark: '#1B2A3A',
    orange: '#F28A07',
    cream: '#FFF6EC',
    creamGlass: 'rgba(255, 246, 236, 0.92)',
    textSecondary: '#6B7C8F',
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

  const formatDateTime = (raw?: string | null) => {
    if (!raw) return '';
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    return parsed.toLocaleString();
  };

  export default function TicketDetail() {
    const { t } = useTranslation();
    const { id } = useLocalSearchParams();
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const ticketId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';

    const statusLabels = useMemo(
      () => ({
        opened: t('supportInbox.statusOpened'),
        in_revision: t('supportInbox.statusInRevision'),
        resolved: t('supportInbox.statusResolved'),
      }),
      [t],
    );

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
        console.error('Error cargando ticket:', error);
        Alert.alert(t('common.error'), error instanceof Error ? error.message : t('ticketDetail.loadError'));
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
          Alert.alert(t('common.error'), t('supportInbox.noSession'));
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
        Alert.alert(t('common.success'), t('ticketDetail.updateOk'));
      } catch (error) {
        console.error('Error actualizando ticket:', error);
        Alert.alert(t('common.error'), error instanceof Error ? error.message : t('ticketDetail.updateError'));
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
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.orange} />
        </View>
      );
    }

    if (!ticket) {
      return (
        <View style={styles.center}>
          <Text>{t('ticketDetail.notFound')}</Text>
        </View>
      );
    }

    const statusKey = ticket.ticket_status ?? 'opened';
    const statusLabel = statusLabels[statusKey as keyof typeof statusLabels] || statusKey;
    const resolvedLabel = ticket.resolved_at
      ? formatDateTime(ticket.resolved_at)
      : t('ticketDetail.notResolved');
    const createdLabel = formatDateTime(ticket.created_at);
    const emailLabel = ticket.user_email?.trim() ? ticket.user_email : t('supportInbox.noEmail');
    const doLabel = ticket.do_number?.trim() ? ticket.do_number : t('supportInbox.noDo');

    return (
      <View style={styles.container}>
        <View style={StyleSheet.absoluteFill}>
          <Image
            source={require('../../../visual/background.png')}
            style={styles.background}
            resizeMode="cover"
          />
        </View>

        <View style={styles.fixedHeader}>
          <LogoCorner />
          <Text style={styles.headerTitle}>{t('ticketDetail.headerTitle')}</Text>
          <TouchableOpacity onPress={backFunction} style={styles.topActionContainer}>
            <Text style={styles.topActionText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('ticketDetail.sectionInfo')}</Text>
            <InfoRow label={t('ticketDetail.labels.doNumber')} value={doLabel} />
            <InfoRow label={t('ticketDetail.labels.email')} value={emailLabel} />
            <InfoRow label={t('ticketDetail.labels.status')} value={statusLabel} />
            <InfoRow label={t('ticketDetail.labels.createdAt')} value={createdLabel} />
            <InfoRow label={t('ticketDetail.labels.resolvedAt')} value={resolvedLabel} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('ticketDetail.sectionMessage')}</Text>
            <Text style={styles.messageText}>{ticket.message}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.actionsRow}>
              {ticket.ticket_status !== 'resolved' ? (
                <>
                  <TouchableOpacity
                    style={[styles.actionButtonAlt, updating && styles.actionButtonDisabled]}
                    onPress={() => updateStatus('in_revision')}
                    disabled={Boolean(updating)}
                  >
                    <Text style={styles.actionButtonAltText}>
                      {updating === 'in_revision' ? t('ticketDetail.updating') : t('ticketDetail.actionInRevision')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButtonPrimary, updating && styles.actionButtonDisabled]}
                    onPress={() => {
                      router.replace('/supportInbox')
                      updateStatus('resolved')
                    }}
                    disabled={Boolean(updating)}
                  >
                    <Text style={styles.actionButtonPrimaryText}>
                      {updating === 'resolved' ? t('ticketDetail.updating') : t('ticketDetail.actionResolve')}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.actionButtonAlt, updating && styles.actionButtonDisabled]}
                  onPress={() => updateStatus('opened')}
                  disabled={Boolean(updating)}
                >
                  <Text style={styles.actionButtonAltText}>
                    {updating === 'opened' ? t('ticketDetail.updating') : t('ticketDetail.actionReopen')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
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
        <Text style={styles.infoLabel}>{label}:</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    );
  }

  const styles = StyleSheet.create({
    background: { width: '100%', height: '100%' },
    container: { flex: 1, backgroundColor: 'transparent' },
    content: { zIndex: 1, paddingTop: 100, paddingBottom: 20 },
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
    topActionContainer: {
      position: 'absolute',
      right: 16,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 14,
    },
    topActionText: { color: '#1B2A3A', fontSize: 16, fontWeight: '600', padding: 6, includeFontPadding: false },
    section: {
      backgroundColor: COLORS.creamGlass,
      margin: 10,
      padding: 15,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10, color: COLORS.blueDark },
    infoRow: {
      flexDirection: 'row',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    infoLabel: { width: 120, fontWeight: '600', color: COLORS.textSecondary },
    infoValue: { flex: 1, color: COLORS.blueDark },
    messageText: { color: COLORS.blueDark, lineHeight: 20 },
    actionsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    actionButtonPrimary: {
      backgroundColor: COLORS.orange,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 10,
      alignItems: 'center',
      flexGrow: 1,
    },
    actionButtonPrimaryText: { color: COLORS.blueDark, fontWeight: '700' },
    actionButtonAlt: {
      backgroundColor: COLORS.blue,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 10,
      alignItems: 'center',
      flexGrow: 1,
    },
    actionButtonAltText: { color: COLORS.cream, fontWeight: '700' },
    actionButtonDisabled: { opacity: 0.6 },
  });
