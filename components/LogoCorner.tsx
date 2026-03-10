// Archivo: C:\Users\usuario\freight-tracking\components\LogoCorner.tsx
// Descripcion: Este archivo forma parte de la logica principal de la aplicacion.

import { router } from 'expo-router';
import { Image, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';

export default function LogoCorner() {
  const { width } = useWindowDimensions();
  const size = Math.max(100, Math.min(600, Math.round(width * 0.15)));

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        onPress={()=> router.push('/')}
        style={[styles.logo, { width: size, height: 100 }]}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
      <Image
        source={require('../visual/logo1.png')}
        style={[styles.logo, { width: size, height: 100 }]}  
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
// Clase personalizada: estilo 'logo' para ajustar apariencia y disposicion del componente.
  logo: {
    borderRadius: 10,
  },
});

