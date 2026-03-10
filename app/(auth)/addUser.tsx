// Archivo: app/(auth)/addUser.tsx
// Descripcion: Pantalla para invitar nuevos usuarios. Solo internos deben usar esta vista.

import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LogoCorner from '../../components/LogoCorner';
import { supabase } from '../../lib/supabase';

const COLORS = {
  blue: '#1E5F99',
  blueMid: '#2B6AA0',
  blueDark: '#1B2A3A',
  orange: '#F28A07',
  cream: '#FFF6EC',
  creamGlass: 'rgba(255, 246, 236, 0.92)',
  textSecondary: '#6B7C8F',
  placeholder: '#8B98A6',
  border: '#D7E3EE',
};

export default function AddUser() {
  // Datos del formulario de invitacion.
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  // Estado visual durante la solicitud de invitacion.
  const [loading, setLoading] = useState(false);

  // Llama la Edge Function invite-user para crear/invitar usuario.
  const handleAddUser = async () => {
    if (!email) {
      Alert.alert('Error', 'Ingresa un email');
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        Alert.alert('Error', 'No hay sesion activa, vuelve a iniciar sesion');
        setLoading(false);
        return;
      }

      const response = await fetch('https://wmzafpkrmyhxbvymdjgu.supabase.co/functions/v1/invite-user', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, nickname, is_internal: isInternal }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al invitar usuario');
      }

      console.log('Exito:', data);
      Alert.alert('Exito', 'Usuario creado, invitacion enviada');
      router.replace('/');
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Error', 'Algo salio mal... Intentalo de nuevo');
      }
    } finally {
      setLoading(false);
    }
  };

  // Vuelve atras con alternativa al dashboard.
  const backFunction = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill]}>
        <Image
          source={require('../../visual/background.png')}
          style={styles.background}
          resizeMode="cover"
        />
      </View>

      <View style={styles.fixedHeader}>
        <LogoCorner />
        <Text style={styles.headerTitle}>Agregar Usuario</Text>
        <TouchableOpacity onPress={backFunction} style={styles.topActionContainer}>
          <Text style={styles.topActionText}>Volver</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.form}>
          <Text style={styles.label}>Email del usuario</Text>
          <TextInput
            style={styles.input}
            placeholder="usuario@email.com"
            placeholderTextColor={COLORS.placeholder}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Alias del usuario</Text>
          <TextInput
            style={styles.input}
            placeholder="Alias del usuario (opcional)"
            placeholderTextColor={COLORS.placeholder}
            value={nickname}
            onChangeText={setNickname}
            autoCapitalize="none"
          />

          <View style={styles.switchContainer}>
            <Text style={styles.label}>Es usuario interno?</Text>
            <Switch
              value={isInternal}
              onValueChange={setIsInternal}
              trackColor={{ false: COLORS.border, true: '#FFB24C' }}
              thumbColor={isInternal ? COLORS.orange : COLORS.cream}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleAddUser} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Creando...' : 'Crear Usuario'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Clase personalizada: imagen de fondo para toda la pantalla.
  background: { position: 'absolute', width: '100%', height: '100%' },
  // Clase personalizada: contenedor raiz.
  container: { flex: 1 },
  // Clase personalizada: area principal por debajo del header.
  content: { flex: 1, paddingTop: 72 },
  // Clase personalizada: encabezado fijo con titulo y boton de regreso.
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
  // Clase personalizada: titulo principal del encabezado.
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B2A3A',
    textAlign: 'center',
    paddingBottom: 14,
  },
  // Clase personalizada: contenedor del boton volver.
  topActionContainer: { position: 'absolute', right: 16, top: 25 },
  // Clase personalizada: texto del boton volver.
  topActionText: { color: '#1B2A3A', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  // Clase personalizada: tarjeta que contiene los campos del formulario.
  form: {
    margin: 16,
    padding: 20,
    backgroundColor: COLORS.creamGlass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 50,
  },
  // Clase personalizada: etiqueta de los campos del formulario.
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: COLORS.blueDark },
  // Clase personalizada: input base de email y alias.
  input: {
    borderWidth: 1,
    borderColor: COLORS.blueMid,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: COLORS.cream,
    color: COLORS.blueDark,
  },
  // Clase personalizada: fila para el switch de usuario interno.
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  // Clase personalizada: boton principal para enviar invitacion.
  button: {
    backgroundColor: COLORS.orange,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  // Clase personalizada: texto del boton principal.
  buttonText: { color: COLORS.blueDark, fontSize: 16, fontWeight: '700' },
});

