// Archivo: components/support/SupportTicketsModal.tsx
// Modal compacto para consulta, seguimiento y apertura de tickets de soporte.
// Permite al usuario consultar el estado de sus tickets sin navegar a una pantalla completa.

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import {
  createTicketFunctionUrl,
  listTicketsFunctionUrl,
  supabase,
  supabaseAnonKey,
} from '../../lib/URLs';
import { formatDateDisplay } from '../../utils/dateFormatting';
import { AUTH_COLORS } from '../auth/AuthChrome';
import { useNativeNotification } from '../ui/NativeNotification';
import { FONT_SIZE, FONT_WEIGHT } from '../ui/TYPOGRAPHY';

export type TicketRecord = {
  id: string;
  do_number: string | null;
  user_id: string | null;
  message: string;
  ticket_status: string | null;
  category?: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by_name?: string | null;
};

type SupportTicketsModalProps = {
  visible: boolean;
  onClose: () => void;
  initialDoNumber?: string;
};

export function SupportTicketsModal({
  visible,
  onClose,
  initialDoNumber,
}: SupportTicketsModalProps) {
  const { t, i18n } = useTranslation();
  const notification = useNativeNotification();
  const { isDesktop } = useResponsive();
  const locale = i18n.language === 'es' ? 'es-CO' : 'en-US';

  const [activeTab, setActiveTab] = useState<'my_tickets' | 'new_ticket'>('my_tickets');
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Campos de creación
  const [selectedCategory, setSelectedCategory] = useState<string>('administrative');
  const [doInput, setDoInput] = useState<string>(initialDoNumber || '');
  const [messageInput, setMessageInput] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const categories = useMemo(
    () => [
      { id: 'administrative', label: t('chat.options.administrative') || 'Administrativo' },
      { id: 'facturation', label: t('chat.options.facturation') || 'Facturación' },
      { id: 'comercial', label: t('chat.options.comercial') || 'Comercial' },
      { id: 'pricing', label: t('chat.options.pricing') || 'Tarifas' },
      { id: 'maritime', label: t('chat.options.maritime') || 'Marítimo' },
      { id: 'air', label: t('chat.options.air') || 'Aéreo' },
      { id: 'other', label: t('chat.options.other') || 'Otro' },
    ],
    [t],
  );

  const statusConfig = useMemo(
    () => ({
      opened: {
        label: t('supportInbox.statusOpened') || 'Abierto',
        bg: AUTH_COLORS.orangeSoft,
        text: AUTH_COLORS.orange,
        border: AUTH_COLORS.orangeBorder,
      },
      in_revision: {
        label: t('supportInbox.statusInRevision') || 'En revisión',
        bg: AUTH_COLORS.blueSoft,
        text: AUTH_COLORS.blue,
        border: 'rgba(79, 104, 142, 0.3)',
      },
      resolved: {
        label: t('supportInbox.statusResolved') || 'Resuelto',
        bg: AUTH_COLORS.greenSoft,
        text: AUTH_COLORS.green,
        border: 'rgba(52, 199, 89, 0.3)',
      },
    }),
    [t],
  );

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(listTicketsFunctionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const data = await response.json();
        setTickets(Array.isArray(data) ? data : []);
      }
    } catch {
      // no-op silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void loadTickets();
      if (initialDoNumber) {
        setDoInput(initialDoNumber);
      }
    }
  }, [visible, initialDoNumber, loadTickets]);

  const handleSubmitTicket = async () => {
    const cleanMsg = messageInput.trim();
    if (!cleanMsg) {
      notification.error(t('ticketCreateScreen.missingMessage') || 'Por favor ingresa tu consulta');
      return;
    }

    try {
      setSubmitting(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        notification.error(t('createTicket.invalidSession') || 'Sesión inválida');
        return;
      }

      const response = await fetch(createTicketFunctionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: cleanMsg,
          do_number: doInput.trim() || null,
          category: selectedCategory || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al crear ticket');
      }

      notification.success(t('supportModal.ticketSuccess') || 'Ticket creado correctamente');
      setMessageInput('');
      setDoInput('');
      setActiveTab('my_tickets');
      void loadTickets();
    } catch {
      notification.error(t('supportModal.ticketError') || 'No se pudo enviar el ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const openTicketsCount = useMemo(() => {
    return tickets.filter((t) => t.ticket_status !== 'resolved').length;
  }, [tickets]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.backdropDismiss} onPress={onClose} />

        <View style={[styles.modalBox, isDesktop && styles.modalBoxDesktop]}>
          {/* Cabecera */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconWrap}>
                <Ionicons name="headset-outline" size={18} color={AUTH_COLORS.orange} />
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={styles.headerTitle}>
                  {t('supportModal.title') || 'Soporte y Tickets'}
                </Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {t('supportModal.subtitle') || 'Seguimiento de solicitudes y asistencia'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={AUTH_COLORS.secondaryText} />
            </TouchableOpacity>
          </View>

          {/* Segmented Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'my_tickets' && styles.tabBtnActive]}
              onPress={() => setActiveTab('my_tickets')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="file-tray-full-outline"
                size={15}
                color={activeTab === 'my_tickets' ? AUTH_COLORS.orange : AUTH_COLORS.secondaryText}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === 'my_tickets' && styles.tabBtnTextActive,
                ]}
              >
                {t('supportModal.tabMyTickets') || 'Mis tickets'}
              </Text>
              {openTicketsCount > 0 ? (
                <View style={styles.badgePill}>
                  <Text style={styles.badgePillText}>{openTicketsCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'new_ticket' && styles.tabBtnActive]}
              onPress={() => setActiveTab('new_ticket')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="add-circle-outline"
                size={15}
                color={activeTab === 'new_ticket' ? AUTH_COLORS.orange : AUTH_COLORS.secondaryText}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === 'new_ticket' && styles.tabBtnTextActive,
                ]}
              >
                {t('supportModal.tabNewTicket') || '+ Nuevo ticket'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Contenido según pestaña */}
          {activeTab === 'my_tickets' ? (
            <View style={styles.contentWrap}>
              {loading ? (
                <View style={styles.centerLoading}>
                  <ActivityIndicator size="small" color={AUTH_COLORS.orange} />
                </View>
              ) : tickets.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconBox}>
                    <Ionicons name="chatbubble-ellipses-outline" size={32} color={AUTH_COLORS.line} />
                  </View>
                  <Text style={styles.emptyTitle}>
                    {t('supportModal.emptyTitle') || 'No tienes tickets registrados'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {t('supportModal.emptySubtitle') ||
                      'Si requieres asistencia de un asesor comercial o de operaciones, abre una consulta en un clic.'}
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={() => setActiveTab('new_ticket')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-outline" size={16} color={AUTH_COLORS.primaryText} />
                    <Text style={styles.emptyActionBtnText}>
                      {t('supportModal.createFirstTicket') || 'Crear consulta ahora'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView
                  style={styles.ticketsScroll}
                  contentContainerStyle={styles.ticketsScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {tickets.map((ticket) => {
                    const st =
                      statusConfig[ticket.ticket_status as keyof typeof statusConfig] ||
                      statusConfig.opened;
                    const isResolved = ticket.ticket_status === 'resolved';

                    return (
                      <View key={ticket.id} style={styles.ticketCard}>
                        <View style={styles.ticketCardHeader}>
                          <View style={styles.ticketHeaderLeft}>
                            <View
                              style={[
                                styles.statusBadge,
                                { backgroundColor: st.bg, borderColor: st.border },
                              ]}
                            >
                              <Text style={[styles.statusBadgeText, { color: st.text }]}>
                                {st.label}
                              </Text>
                            </View>

                            {ticket.do_number ? (
                              <View style={styles.doBadge}>
                                <Ionicons name="cube-outline" size={11} color={AUTH_COLORS.secondaryText} />
                                <Text style={styles.doBadgeText}>
                                  {ticket.do_number}
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          <Text style={styles.ticketDateText}>
                            {formatDateDisplay(ticket.created_at, locale)}
                          </Text>
                        </View>

                        <Text style={styles.ticketMessageText}>{ticket.message}</Text>

                        {/* Pie con estado de resolución o seguimiento */}
                        {isResolved ? (
                          <View style={styles.resolutionBox}>
                            <Ionicons name="checkmark-circle-outline" size={14} color={AUTH_COLORS.green} />
                            <Text style={styles.resolutionText}>
                              {ticket.resolved_at
                                ? `${t('supportModal.resolvedAt', { date: formatDateDisplay(ticket.resolved_at, locale) })}`
                                : t('supportInbox.statusResolved')}
                              {ticket.resolved_by_name ? ` · ${ticket.resolved_by_name}` : ''}
                            </Text>
                          </View>
                        ) : ticket.ticket_status === 'in_revision' ? (
                          <View style={styles.inRevisionBox}>
                            <Ionicons name="sync-outline" size={14} color={AUTH_COLORS.blue} />
                            <Text style={styles.inRevisionText}>
                              {t('supportModal.inRevisionHint') || 'En proceso de revisión por el personal de operaciones.'}
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.pendingBox}>
                            <Ionicons name="time-outline" size={14} color={AUTH_COLORS.orange} />
                            <Text style={styles.pendingText}>
                              {t('supportModal.openedHint') || 'En cola de espera para asignación de un asesor.'}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          ) : (
            /* Pestaña: Crear nuevo ticket */
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Categoría */}
              <View style={styles.formFieldGroup}>
                <Text style={styles.fieldLabel}>
                  {t('supportModal.fieldCategory') || 'Categoría de la consulta'}
                </Text>
                <View style={styles.categoryChipsRow}>
                  {categories.map((cat) => {
                    const active = selectedCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.categoryChip, active && styles.categoryChipActive]}
                        onPress={() => setSelectedCategory(cat.id)}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            active && styles.categoryChipTextActive,
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Número DO (opcional) */}
              <View style={styles.formFieldGroup}>
                <Text style={styles.fieldLabel}>
                  {t('supportModal.fieldDo') || 'Número DO / Carga (Opcional)'}
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={doInput}
                  onChangeText={setDoInput}
                  placeholder={t('supportModal.doPlaceholder') || 'Ej: M26856'}
                  placeholderTextColor={AUTH_COLORS.secondaryText}
                  autoCapitalize="characters"
                />
              </View>

              {/* Mensaje */}
              <View style={styles.formFieldGroup}>
                <Text style={styles.fieldLabel}>
                  {t('supportModal.fieldMessage') || 'Mensaje o requerimiento *'}
                </Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={messageInput}
                  onChangeText={setMessageInput}
                  placeholder={
                    t('supportModal.messagePlaceholder') ||
                    'Describe brevemente tu solicitud o el detalle que requieres aclarar...'
                  }
                  placeholderTextColor={AUTH_COLORS.secondaryText}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Botones de acción */}
              <View style={styles.formActionsRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setActiveTab('my_tickets')}
                  activeOpacity={0.75}
                  disabled={submitting}
                >
                  <Text style={styles.cancelBtnText}>{t('common.cancel') || 'Cancelar'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                  onPress={handleSubmitTicket}
                  activeOpacity={0.8}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={AUTH_COLORS.primaryText} />
                  ) : (
                    <>
                      <Ionicons name="send-outline" size={16} color={AUTH_COLORS.primaryText} />
                      <Text style={styles.submitBtnText}>
                        {t('supportModal.submitTicket') || 'Enviar solicitud'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  modalBox: {
    width: '100%',
    maxWidth: 580,
    maxHeight: '85%',
    backgroundColor: AUTH_COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  modalBoxDesktop: {
    maxWidth: 580,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: AUTH_COLORS.line,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: AUTH_COLORS.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.bold,
  },
  headerSubtitle: {
    color: AUTH_COLORS.secondaryText,
    fontSize: FONT_SIZE.xs,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AUTH_COLORS.surfaceAlt,
  },

  // Segmented Tabs
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: AUTH_COLORS.line,
  },
  tabBtn: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: AUTH_COLORS.surface,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  tabBtnText: {
    color: AUTH_COLORS.secondaryText,
    fontSize: FONT_SIZE.xs + 1,
    fontWeight: FONT_WEIGHT.medium,
  },
  tabBtnTextActive: {
    color: AUTH_COLORS.primaryText,
    fontWeight: FONT_WEIGHT.bold,
  },
  badgePill: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: AUTH_COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgePillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: FONT_WEIGHT.bold,
  },

  // Content
  contentWrap: {
    flex: 1,
    minHeight: 280,
  },
  centerLoading: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 280,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    color: AUTH_COLORS.primaryText,
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.bold,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: AUTH_COLORS.secondaryText,
    fontSize: FONT_SIZE.xs + 1,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  emptyActionBtn: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
    marginTop: 8,
  },
  emptyActionBtnText: {
    color: AUTH_COLORS.primaryText,
    fontSize: FONT_SIZE.xs + 1,
    fontWeight: FONT_WEIGHT.bold,
  },

  // Tickets List
  ticketsScroll: {
    flex: 1,
  },
  ticketsScrollContent: {
    padding: 16,
    gap: 12,
  },
  ticketCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    gap: 10,
  },
  ticketCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  ticketHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHT.bold,
  },
  doBadge: {
    height: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 241, 234, 0.08)',
  },
  doBadgeText: {
    fontSize: 11,
    color: AUTH_COLORS.primaryText,
    fontWeight: FONT_WEIGHT.bold,
  },
  ticketDateText: {
    fontSize: FONT_SIZE.xs - 1,
    color: AUTH_COLORS.secondaryText,
  },
  ticketMessageText: {
    color: AUTH_COLORS.primaryText,
    fontSize: FONT_SIZE.xs + 1,
    lineHeight: 18,
  },
  resolutionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.2)',
  },
  resolutionText: {
    color: AUTH_COLORS.green,
    fontSize: 11,
    fontWeight: FONT_WEIGHT.medium,
  },
  inRevisionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(79, 104, 142, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(79, 104, 142, 0.25)',
  },
  inRevisionText: {
    color: AUTH_COLORS.blue,
    fontSize: 11,
    fontWeight: FONT_WEIGHT.medium,
  },
  pendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(199, 138, 75, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(199, 138, 75, 0.2)',
  },
  pendingText: {
    color: AUTH_COLORS.orangeText,
    fontSize: 11,
    fontWeight: FONT_WEIGHT.medium,
  },

  // Formulario nuevo ticket
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    padding: 18,
    gap: 14,
  },
  formFieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: AUTH_COLORS.primaryText,
    fontSize: FONT_SIZE.xs + 1,
    fontWeight: FONT_WEIGHT.bold,
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryChip: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipActive: {
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderColor: AUTH_COLORS.orangeBorder,
  },
  categoryChipText: {
    fontSize: FONT_SIZE.xs,
    color: AUTH_COLORS.secondaryText,
    fontWeight: FONT_WEIGHT.medium,
  },
  categoryChipTextActive: {
    color: AUTH_COLORS.primaryText,
    fontWeight: FONT_WEIGHT.bold,
  },
  textInput: {
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
    color: AUTH_COLORS.primaryText,
    fontSize: FONT_SIZE.sm,
  },
  textArea: {
    height: 100,
    paddingVertical: 10,
  },
  formActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AUTH_COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: AUTH_COLORS.line,
  },
  cancelBtnText: {
    color: AUTH_COLORS.secondaryText,
    fontSize: FONT_SIZE.xs + 1,
    fontWeight: FONT_WEIGHT.bold,
  },
  submitBtn: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: AUTH_COLORS.orangeSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.orangeBorder,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: AUTH_COLORS.primaryText,
    fontSize: FONT_SIZE.xs + 1,
    fontWeight: FONT_WEIGHT.bold,
  },
});
