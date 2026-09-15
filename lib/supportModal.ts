// Archivo: lib/supportModal.ts
// Permite abrir y cerrar el modal de soporte y tickets desde cualquier componente (TopBar, Perfil, etc.)

type Listener = (open: boolean) => void;
const listeners = new Set<Listener>();

export const supportModal = {
  open: () => {
    listeners.forEach((listener) => listener(true));
  },
  close: () => {
    listeners.forEach((listener) => listener(false));
  },
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
