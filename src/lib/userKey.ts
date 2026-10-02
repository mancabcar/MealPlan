/** Clave de localStorage de un dato del usuario: mp_<userId>_<dato>. Módulo aparte para que backup.ts y auth.tsx no se importen entre sí. */
export function userKey(userId: string, key: string): string {
  return `mp_${userId}_${key}`;
}
