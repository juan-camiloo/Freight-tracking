// Layout raiz de la aplicacion.
// Inicializa i18n antes de montar cualquier pantalla para garantizar
// que todas las traducciones esten disponibles desde el primer render.
import { Slot } from 'expo-router';
import '../i18n';


export default function RootLayout() {
  return <Slot />;
}