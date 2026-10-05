// Spec: docs/pm/23-agua-fibra-micros/spec.md › R1 (copias anteriores cargan sin fibra), R3 (objetivo) y R13 (la fibra viaja
// en la copia de seguridad). Tech: tech.md › Data model (campos opcionales en entries, recipes y profile; sin migración).
import { describe, expect, it } from "vitest";
import { BACKUP_APP_ID, BACKUP_SCHEMA_VERSION, parseBackup } from "@/lib/backup";
import type { MealEntry, Recipe } from "@/lib/types";
import { lucia } from "../fixtures/profiles";
import { DIA_PARCIAL, LENTEJAS_FIBRA } from "../fixtures/fibra";

function backupWith(data: Record<string, unknown>): string {
  return JSON.stringify({ app: BACKUP_APP_ID, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: "2026-09-22T10:00:00.000Z", data });
}

describe("R13: la fibra viaja en la copia de seguridad", () => {
  it("restaura la fibra de las entradas, la de las recetas y el objetivo del perfil", () => {
    const result = parseBackup(
      backupWith({ profile: { ...lucia, fiberGoal: 30 }, entries: DIA_PARCIAL, recipes: [LENTEJAS_FIBRA] }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.data.profile?.fiberGoal).toBe(30);
    expect(result.data.entries.map((e) => e.fiber)).toEqual([9, undefined, undefined, 3, undefined]);
    expect((result.data.recipes.find((r) => r.id === LENTEJAS_FIBRA.id) as Recipe).fiber).toBe(14);
  });
});

describe("R1: una copia anterior a esta entrega carga sin errores", () => {
  const OLD_ENTRY: MealEntry = { id: "old", date: "2026-08-01", mealType: "Comida", customName: "Lentejas", calories: 500, protein: 30, carbs: 60, fat: 10 };

  it("sin fibra en entradas ni objetivo en el perfil: carga y la fibra queda «sin dato»", () => {
    const result = parseBackup(backupWith({ profile: lucia, entries: [OLD_ENTRY] }));
    if (!result.ok) throw new Error(result.error);
    expect(result.data.entries[0]).not.toHaveProperty("fiber");
    expect(result.data.profile).not.toHaveProperty("fiberGoal");
  });
});
