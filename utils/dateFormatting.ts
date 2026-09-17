/**
 * Archivo: utils/dateFormatting.ts
 * Utilidades para manejo, parseo, visualización y serialización de fechas
 * garantizando coherencia absoluta en la zona horaria local del usuario.
 */

/**
 * Parsea con seguridad cualquier cadena de fecha o fecha/hora hacia un objeto Date en zona horaria local.
 * Evita el comportamiento predeterminado de JS donde 'YYYY-MM-DD' se interpreta como medianoche UTC,
 * lo que en zonas horarias de América (como UTC-5 Colombia) provocaba que la fecha retrocediera 1 día (a las 19:00 de la víspera).
 */
export function parseDateSafe(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // 1. Si es formato de solo fecha YYYY-MM-DD (ej: "2026-09-17")
  // o si es una fecha guardada con medianoche UTC (ej: "2026-09-17T00:00:00Z" o "2026-09-17T00:00:00.000Z")
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]00:00(?::00(?:\.000)?)?(?:[Zz]|\+00(?::?00)?)?)?$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    // Fijar al mediodía local (12:00) para garantizar que jamás haya saltos de día por DST o conversiones
    return new Date(year, month, day, 12, 0, 0);
  }

  // 2. Si es fecha y hora local sin información de zona (ej: "2026-09-17 14:30" o "2026-09-17T14:30")
  const localDateTimeMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (localDateTimeMatch) {
    const year = Number(localDateTimeMatch[1]);
    const month = Number(localDateTimeMatch[2]) - 1;
    const day = Number(localDateTimeMatch[3]);
    const hours = Number(localDateTimeMatch[4]);
    const minutes = Number(localDateTimeMatch[5]);
    const seconds = localDateTimeMatch[6] ? Number(localDateTimeMatch[6]) : 0;
    return new Date(year, month, day, hours, minutes, seconds);
  }

  // 3. Cadena con zona horaria explícita (ej: ISO 8601 con Z o +/-HH:MM)
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formatea una fecha para visualización en pantalla (solo mes y día, o con opciones personalizadas).
 * Maneja zona local para que nunca retroceda un día.
 */
export function formatDateDisplay(
  value: string | null | undefined,
  locale = 'es-CO',
  options?: Intl.DateTimeFormatOptions
): string {
  if (!value) return '--';
  const parsed = parseDateSafe(value);
  if (!parsed) return value;
  const defaultOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    ...options,
  };
  return parsed.toLocaleDateString(locale, defaultOptions);
}

/**
 * Formatea una fecha y hora para visualización en pantalla en la zona horaria local.
 */
export function formatDateTimeDisplay(
  value: string | null | undefined,
  locale = 'es-CO',
  options?: Intl.DateTimeFormatOptions
): string {
  if (!value) return '--';
  const parsed = parseDateSafe(value);
  if (!parsed) return value;
  const defaultOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };
  return parsed.toLocaleString(locale, defaultOptions);
}

/**
 * Formatea una fecha completa incluyendo año (ej: 17 de sept. de 2026).
 */
export function formatDateFull(value: string | null | undefined, locale = 'es-CO'): string {
  if (!value) return '--';
  const parsed = parseDateSafe(value);
  if (!parsed) return value;
  return parsed.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Convierte un objeto Date a formato 'YYYY-MM-DD' en la zona horaria local.
 */
export function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convierte un objeto Date a formato 'YYYY-MM-DD HH:mm' en la zona horaria local.
 */
export function formatDateTimeInputValue(date: Date): string {
  const datePart = formatDateInputValue(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${datePart} ${hours}:${minutes}`;
}

/**
 * Parsea el valor actual de un input para inicializar pickers de fecha o editores en la zona horaria local.
 */
export function parseDateInputValue(value: string | null | undefined): Date | null {
  if (!value) return null;
  return parseDateSafe(value);
}

/**
 * Combina fecha y hora locales seleccionadas independientemente.
 */
export function mergeDateAndTime(datePart: Date, timePart: Date): Date {
  const merged = new Date(datePart);
  merged.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return merged;
}

/**
 * Prepara un valor de fecha pura (ETD, ETA) para guardarse en la columna 'date' de PostgreSQL.
 * Devuelve estrictamente 'YYYY-MM-DD' en zona local.
 */
export function serializeDateForDb(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const parsed = parseDateSafe(trimmed);
  return parsed ? formatDateInputValue(parsed) : null;
}

/**
 * Prepara un valor de fecha y hora (ATD, ATA, Documentary Cutoff) para guardarse en una columna
 * 'timestamp with time zone' de PostgreSQL.
 * Si el usuario ingresó hora local (ej: "2026-09-17 14:30"), se convierte a ISO 8601 con zona horaria (UTC),
 * evitando que la base de datos asuma erróneamente que la hora era UTC y reste horas indebidas.
 */
export function serializeDateTimeForDb(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Si ya tiene zona horaria ISO explícita (Z o +/-HH:MM)
  if (/[Zz]|[+-]\d{2}(?::?\d{2})?$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
  }

  // Si es fecha y hora local (ej: "2026-09-17 14:30" o "2026-09-17T14:30")
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const hours = Number(match[4]);
    const minutes = Number(match[5]);
    const seconds = match[6] ? Number(match[6]) : 0;
    const localDate = new Date(year, month, day, hours, minutes, seconds);
    return Number.isNaN(localDate.getTime()) ? trimmed : localDate.toISOString();
  }

  // Si solo se ingresó fecha pura para un campo con hora
  const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]) - 1;
    const day = Number(dateMatch[3]);
    // Inicio del día en zona local del usuario
    const localDate = new Date(year, month, day, 0, 0, 0);
    return Number.isNaN(localDate.getTime()) ? trimmed : localDate.toISOString();
  }

  const fallback = parseDateSafe(trimmed);
  return fallback ? fallback.toISOString() : null;
}

/**
 * Convierte un valor proveniente de la base de datos a formato de input de solo fecha ('YYYY-MM-DD')
 * preservando el día exacto en hora local.
 */
export function formatIsoToLocalDateInput(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = parseDateSafe(value);
  if (!parsed) return '';
  return formatDateInputValue(parsed);
}

/**
 * Convierte un valor timestamptz proveniente de la base de datos a formato de input de fecha y hora
 * local ('YYYY-MM-DD HH:mm').
 */
export function formatIsoToLocalDateTimeInput(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = parseDateSafe(value);
  if (!parsed) return '';
  return formatDateTimeInputValue(parsed);
}
