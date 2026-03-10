// Archivo: app/login.tsx
/*
Pantalla de acceso por magic link. 
Solo permite solicitar OTP para correos registrados por usuarios internos.
*/

import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LogoCorner from '../components/LogoCorner';
import { supabase } from '../lib/supabase';

const COLORS = {
  blueMid: '#1862A0',
  blueDark: '#1B2A3A',
  orange: '#F28A07',
  cream: '#FFF6EC',
  creamGlass: 'rgba(255, 246, 236, 0.92)',
  textSecondary: '#6B7C8F',
  placeholder: '#8B98A6',
  border: '#D7E3EE',
};

export default function Login() {
  // Correo digitado por el usuario.
  const [email, setEmail] = useState('');
  // Estado visual del boton mientras se envia la solicitud.
  const [loading, setLoading] = useState(false);

  // Solicita envio de magic link a Supabase.
  const handleLogin = async () => {
    if (!email) {
      Alert.alert('Error', 'Por favor ingresa tu email');
      return;
    }

    setLoading(true);

    //Evita problemas de redireccion en desarrollo local o en Expo Go usando el origen actual como redirect.
    const redirectTo = Linking.createURL('/auth/callback');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // Impide crear usuarios nuevos desde login.
        emailRedirectTo: redirectTo,
      },
    });
   

    setLoading(false);

    console.log('Redirect URL:', redirectTo);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Exito', 'Revisa tu email para el enlace magico');
    }
  };

  return (
    <View style={styles.container}>
      {/* Fondo visual no interactivo */}
      <View style={StyleSheet.absoluteFill}>
        <Image source={require('../visual/background.png')} style={styles.background} resizeMode="cover" />
      </View>

      <View style={styles.fixedHeader}>
        <LogoCorner />
        <Text style={styles.headerTitle}>Iniciar sesión</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Bienvenido</Text>
        <Text style={styles.subtitle}>Ingrese el correo con el cual fue registrado</Text>

        <TextInput
          style={styles.input}
          placeholder="usuario@email.com"
          placeholderTextColor={COLORS.placeholder}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Enviando...' : 'Enviar link de autenticacion'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    zIndex: 1,
    backgroundColor: COLORS.creamGlass,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 72,
  },
  background: { width: '100%', height: '100%' },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'transparent',
  },
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
  title: {
    color: COLORS.blueDark,
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    backgroundColor: COLORS.cream,
    borderColor: COLORS.blueMid,
    borderWidth: 1,
    color: COLORS.blueDark,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    fontSize: 16,
    minHeight: 48,
    marginBottom: 20,
  },
  button: {
    backgroundColor: COLORS.orange,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.blueDark,
    fontSize: 16,
    fontWeight: '600',
  },
});
