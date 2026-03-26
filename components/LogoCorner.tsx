// Archivo: C:\Users\usuario\freight-tracking\components\LogoCorner.tsx
// Descripcion: Este archivo forma parte de la logica principal de la aplicacion.

import { router } from 'expo-router';
import { Image, StyleSheet, TouchableOpacity, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

type LogoCornerProps = {
  inline?: boolean;
  size?: number;
  height?: number;
  wrapperStyle?: StyleProp<ViewStyle>;
};

export default function LogoCorner({ inline = false, size, height, wrapperStyle }: LogoCornerProps) {
  const { width } = useWindowDimensions();
  const defaultSize = Math.max(100, Math.min(600, Math.round(width * 0.15)));
  const inlineSize = Math.max(80, Math.min(160, Math.round(width * 0.2)));
  const resolvedSize = size ?? (inline ? inlineSize : defaultSize);
  const resolvedHeight = height ?? (inline ? Math.round(resolvedSize * 0.6) : 100);

  return (
    <View style={[styles.wrapper, inline && styles.inlineWrapper, wrapperStyle]}>
      <TouchableOpacity
        onPress={()=> router.push('/')}
        style={[styles.logo, { width: resolvedSize, height: resolvedHeight }]}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
      <Image
        source={require('../visual/logo1.png')}
        style={[styles.logo, { width: resolvedSize, height: resolvedHeight }]}  
        resizeMode="contain"
      />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
// Clase personalizada: estilo 'wrapper' para ajustar apariencia y disposicion del componente.
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 16,

  },
  inlineWrapper: {
    position: 'relative',
    top: undefined,
    left: undefined,
  },
// Clase personalizada: estilo 'logo' para ajustar apariencia y disposicion del componente.
  logo: {
    borderRadius: 10,
  },
});

