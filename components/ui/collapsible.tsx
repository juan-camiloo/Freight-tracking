// Archivo: components/ui/collapsible.tsx
// Descripcion: Componente desplegable que muestra/oculta contenido secundario.

import { PropsWithChildren, ReactNode, useState } from 'react';
import { StyleProp, StyleSheet, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type CollapsibleProps = PropsWithChildren<{
  title: string;
  initiallyOpen?: boolean;
  iconColor?: string;
  rightElement?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  headingStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
}>;

export function Collapsible({
  children,
  title,
  initiallyOpen = false,
  iconColor,
  rightElement,
  containerStyle,
  headingStyle,
  contentStyle,
  titleStyle,
}: CollapsibleProps) {
  // Controla si el bloque esta abierto o cerrado.
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const theme = useColorScheme() ?? 'light';
  const resolvedIconColor = iconColor ?? (theme === 'light' ? Colors.light.icon : Colors.dark.icon);

  return (
    <ThemedView style={containerStyle}>
      <TouchableOpacity
        style={[styles.heading, headingStyle]}
        onPress={() => setIsOpen((value) => !value)}
        activeOpacity={0.8}>
        <IconSymbol
          name="chevron.right"
          size={18}
          weight="medium"
          color={resolvedIconColor}
          style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
        />

        <ThemedText type="defaultSemiBold" style={[styles.title, titleStyle]}>{title}</ThemedText>
        {rightElement}
      </TouchableOpacity>
      {isOpen && <ThemedView style={[styles.content, contentStyle]}>{children}</ThemedView>}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  // Clase personalizada: encabezado clickeable del bloque desplegable.
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    flex: 1,
  },
  // Clase personalizada: contenido mostrado cuando el bloque esta abierto.
  content: {
    marginTop: 6,
    marginLeft: 24,
  },
});
