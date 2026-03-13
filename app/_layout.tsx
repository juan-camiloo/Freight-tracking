// Layout raiz de la aplicacion.
// Inicializa i18n antes de montar cualquier pantalla para garantizar
// que todas las traducciones esten disponibles desde el primer render.
import { Slot } from 'expo-router';
import '../i18n';

export default function RootLayout() {
  // Slot delega el render a la ruta activa; este layout no agrega
  // UI propia para no interferir con los layouts de cada grupo de rutas.
  return <Slot />;
}