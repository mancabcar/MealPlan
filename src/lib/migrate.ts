// Migración v1 → v2 del perfil y de las comidas guardadas (spec R14). Pura e idempotente.
// STUB: el contrato lo fija tests/unit/migrate.test.ts; la implementación llega con dev-code.
import type { MealSlot, UserProfileV2 } from "./types";

type WithSlot<T> = Omit<T, "mealType"> & { mealType: MealSlot };

function notImplemented(fn: string): never {
  throw new Error(`${fn}: not implemented`);
}

/** null → null. v1 (sin schemaVersion) → v2. v2 → sin cambios. */
export function migrateProfile(raw: unknown): UserProfileV2 | null {
  void raw;
  return notImplemented("migrateProfile");
}

/** "Snack" → "Merienda"; el resto de campos se conserva. */
export function migrateEntries<T extends { mealType: string }>(entries: T[]): WithSlot<T>[] {
  void entries;
  return notImplemented("migrateEntries");
}

export function migrateWeekPlan<T extends { mealType: string }>(
  plan: Record<string, T[]>,
): Record<string, WithSlot<T>[]> {
  void plan;
  return notImplemented("migrateWeekPlan");
}
