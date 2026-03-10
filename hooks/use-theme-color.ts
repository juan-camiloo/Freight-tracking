// Archivo: hooks/use-theme-color.ts
// Descripcion: Hook que devuelve el color correcto segun tema actual y props opcionales.

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Prioriza color pasado por props; si no existe, usa paleta del tema activo.
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  }

  return Colors[theme][colorName];
}
