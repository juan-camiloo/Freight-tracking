import { supabase } from './URLs';

const isUuid = (val: string | null | undefined): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
};

// Caché en memoria para nombres de usuarios/autores
const userDisplayMap = new Map<string, string>();

/**
 * Resuelve una lista de IDs de usuario a sus nombres o apodos.
 * Revisa el caché en memoria primero y solo consulta a Supabase los IDs no cacheados.
 */
export async function resolveUserDisplayNames(
  userIds: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const validIds = Array.from(
    new Set(userIds.filter((id): id is string => Boolean(id) && isUuid(id)))
  );
  const missingIds = validIds.filter((id) => !userDisplayMap.has(id));

  if (missingIds.length > 0) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nickname, email')
        .in('id', missingIds);

      if (!error && data) {
        for (const p of data) {
          const resolved = p.nickname?.trim() || p.email?.split('@')[0]?.trim() || 'Equipo Ingelox';
          userDisplayMap.set(p.id, resolved);
        }
      }
    } catch (err) {
      console.warn('Error resolviendo nombres de usuario en caché:', err);
    }
  }

  return userDisplayMap;
}

/**
 * Obtiene de forma síncrona el nombre resuelto de un usuario si ya está en caché,
 * o devuelve el fallback si aún no ha sido resuelto.
 */
export function getUserDisplayNameSync(
  id: string | null | undefined,
  fallback = 'Equipo Ingelox'
): string {
  if (!id) return fallback;
  if (!isUuid(id)) return id;
  return userDisplayMap.get(id) || fallback;
}

/**
 * Permite pre-cargar un perfil en el caché (por ejemplo, el usuario actual).
 */
export function primeUserCache(id: string, name: string): void {
  if (id && name) {
    userDisplayMap.set(id, name);
  }
}
