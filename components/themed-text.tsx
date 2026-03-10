// Archivo: C:\Users\usuario\freight-tracking\components\themed-text.tsx
// Descripcion: Este archivo forma parte de la logica principal de la aplicacion.

import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
// Clase personalizada: estilo 'default' para ajustar apariencia y disposicion del componente.
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
// Clase personalizada: estilo 'defaultSemiBold' para ajustar apariencia y disposicion del componente.
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
// Clase personalizada: titulo destacado dentro del contenido.
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
  },
// Clase personalizada: subtitulo o texto explicativo secundario.
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
// Clase personalizada: estilo 'link' para ajustar apariencia y disposicion del componente.
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: '#0a7ea4',
  },
});

