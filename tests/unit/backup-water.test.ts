// Spec: docs/pm/23-agua-fibra-micros/spec.md › R13 (el agua, el objetivo y el vaso viajan en la copia de seguridad;
// una copia anterior sin esos campos carga con los valores por defecto). Tech: tech.md › Data model (novena clave).
// Fallan hasta la tarea 10 del tech design.
import { describe, expect, it } from "vitest";
import { BACKUP_APP_ID, BACKUP_SCHEMA_VERSION, parseBackup } from "@/lib/backup";
import { USER_DATA_KEYS } from "@/lib/userData";
import { lucia } from "../fixtures/profiles";
import { AGUA_DOS_DIAS, TODAY } from "../fixtures/agua";

function backupWith(data: Record<string, unknown>): string {
  return JSON.stringify({ app: BACKUP_APP_ID, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: "2026-09-22T10:00:00.000Z", data });
}

describe("R13: el agua viaja en la copia de seguridad", () => {
  it("la novena clave de los datos del usuario es «water» (detrás va «mealFavorites», #55)", () => {
    expect(USER_DATA_KEYS).toHaveLength(10);
    expect(USER_DATA_KEYS[8]).toBe("water");
  });

  it("restaura el consumo de agua por día, el objetivo y el tamaño del vaso", () => {
    const result = parseBackup(backupWith({ profile: { ...lucia, waterGoalMl: 2500, glassMl: 330 }, water: AGUA_DOS_DIAS }));
    if (!result.ok) throw new Error(result.error);
    expect(result.data.water).toEqual(AGUA_DOS_DIAS);
    expect(result.data.profile?.waterGoalMl).toBe(2500);
    expect(result.data.profile?.glassMl).toBe(330);
  });

  it("una copia anterior sin agua carga y el agua queda vacía", () => {
    const result = parseBackup(backupWith({ profile: lucia }));
    if (!result.ok) throw new Error(result.error);
    expect(result.data.water).toEqual({});
    expect(result.data.profile).not.toHaveProperty("waterGoalMl");
  });

  it("una sección de agua que no es un objeto invalida la copia entera", () => {
    const result = parseBackup(backupWith({ profile: lucia, water: [250, 500] }));
    expect(result).toEqual({ ok: false, error: "La sección «water» no tiene el formato esperado." });
  });

  it("los días mal formados de una copia se descartan al importar, sin invalidarla", () => {
    const result = parseBackup(backupWith({ water: { [TODAY]: 750, ayer: 500 } }));
    if (!result.ok) throw new Error(result.error);
    expect(result.data.water).toEqual({ [TODAY]: 750 });
  });
});
