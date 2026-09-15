/**
 * TYPOGRAPHY — Escala tipográfica unificada de la app.
 *
 * Tamaños: solo usar estos valores. No añadir tamaños intermedios.
 * Pesos:   solo usar medium (600) o bold (800).
 */

export const FONT_SIZE = {
  xs: 11,   // Labels auxiliares, badges, metadatos secundarios
  sm: 13,   // Body secundario, subtítulos de campo
  base: 15, // Body principal, etiquetas de botón
  lg: 18,   // Títulos de sección, valores destacados
  xl: 24,   // Títulos de pantalla (mobile)
  xxl: 32,  // Número de DO, hero principal
} as const;

export const FONT_WEIGHT = {
  regular: '400' as const,
  medium: '600' as const,
  bold: '800' as const,
} as const;

export const LINE_HEIGHT = {
  tight: 1.2,   // Títulos grandes
  normal: 1.45, // Body
  loose: 1.65,  // Texto largo / descriptivo
} as const;
