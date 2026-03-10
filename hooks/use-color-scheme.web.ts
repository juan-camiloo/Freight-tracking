// Archivo: hooks/use-color-scheme.web.ts
// Descripcion: Hook para web que evita desajustes de render entre servidor y cliente.

import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

// En web, el esquema de color se confirma despues de hidratar en cliente.
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  // Fallback inicial para evitar parpadeos antes de hidratar.
  return 'light';
}
