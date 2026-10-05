// Spec: docs/pm/49-tolerancia-cumplido/spec.md › R4 (la tolerancia viaja en la copia) y R5 (copias sin el campo cargan sin errores).
// Tech: tech.md › Data model (campo opcional en el perfil; sin migración). Mismo patrón que backup-fiber.test.ts.
import { describe, expect, it } from "vitest";
import { BACKUP_APP_ID, BACKUP_SCHEMA_VERSION, parseBackup } from "@/lib/backup";
import { tolerancePct } from "@/lib/tolerance";
import { lucia } from "../fixtures/profiles";

function backupWith(data: Record<string, unknown>): string {
  return JSON.stringify({ app: BACKUP_APP_ID, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: "2026-10-05T10:00:00.000Z", data });
}

function restored(profile: Record<string, unknown>) {
  const result = parseBackup(backupWith({ profile }));
  if (!result.ok) throw new Error(result.error);
  return result.data.profile!;
}

describe("R4: la tolerancia viaja en la copia de seguridad", () => {
  it("restaura la tolerancia del perfil", () => {
    expect(restored({ ...lucia, tolerancePct: 15 }).tolerancePct).toBe(15);
  });
});

describe("R5: copias antiguas o con un valor roto cargan sin errores", () => {
  it("sin el campo: carga y se usa 10", () => {
    const profile = restored({ ...lucia });
    expect(profile).not.toHaveProperty("tolerancePct");
    expect(tolerancePct(profile)).toBe(10);
  });

  it("con un valor no numérico: carga y se usa 10", () => {
    expect(tolerancePct(restored({ ...lucia, tolerancePct: "quince" }))).toBe(10);
  });

  it("con un valor fuera de rango: carga y se ajusta (3 → 5, 50 → 20)", () => {
    expect(tolerancePct(restored({ ...lucia, tolerancePct: 3 }))).toBe(5);
    expect(tolerancePct(restored({ ...lucia, tolerancePct: 50 }))).toBe(20);
  });
});
