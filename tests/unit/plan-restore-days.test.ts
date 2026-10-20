// #149: Deshacer de «Copiar semana anterior» y «Rellenar semana» (docs/pm/53-copiar-semana-anterior › R5;
// docs/pm/15-autocompletar-semana-ia › R6). Contrato de `src/lib/plan/restoreDays.ts`:
//   - `snapshotDays(plan, dates)` → { [fecha]: franjas | undefined } de esas fechas, tal como están.
//   - `restoreDays(plan, before, dates)` → plan nuevo con esas fechas como en `before`; un día que antes no tenía
//     entrada se borra del plan. El resto del plan (otras semanas) no se toca. Puras: no mutan la entrada.
import { describe, expect, it } from "vitest";
import { restoreDays, snapshotDays } from "@/lib/plan/restoreDays";
import type { WeekPlan } from "@/lib/types";

const WEEK = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"];
const OTHER = "2026-09-28"; // lunes de la semana siguiente
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

const before: WeekPlan = {
  [WEEK[0]]: [{ mealType: "Comida", recipeId: "pollo" }],
  [WEEK[2]]: [],
  [OTHER]: [{ mealType: "Cena", recipeId: "guiso" }],
};

describe("#149: Deshacer restaura solo los 7 días de la semana vista", () => {
  it("snapshotDays guarda cada fecha de la semana, también las que no tienen entrada", () => {
    const snap = snapshotDays(before, WEEK);
    expect(Object.keys(snap)).toEqual(WEEK);
    expect(snap[WEEK[0]]).toEqual([{ mealType: "Comida", recipeId: "pollo" }]);
    expect(snap[WEEK[2]]).toEqual([]);
    expect(snap[WEEK[1]]).toBeUndefined();
  });

  it("devuelve los días de la semana a como estaban", () => {
    const snap = snapshotDays(before, WEEK);
    const after: WeekPlan = {
      ...before,
      [WEEK[0]]: [{ mealType: "Comida", recipeId: "lentejas" }],
      [WEEK[2]]: [{ mealType: "Cena", recipeId: "tortilla" }],
    };
    const restored = restoreDays(after, snap, WEEK);
    expect(restored[WEEK[0]]).toEqual([{ mealType: "Comida", recipeId: "pollo" }]);
    expect(restored[WEEK[2]]).toEqual([]);
  });

  it("un día que antes no tenía entrada se borra, no queda como lista vacía", () => {
    const snap = snapshotDays(before, WEEK);
    const after: WeekPlan = { ...before, [WEEK[1]]: [{ mealType: "Desayuno", recipeId: "batido" }] };
    const restored = restoreDays(after, snap, WEEK);
    expect(WEEK[1] in restored).toBe(false);
  });

  it("no toca otras semanas, aunque hayan cambiado después", () => {
    const snap = snapshotDays(before, WEEK);
    const after: WeekPlan = {
      ...before,
      [WEEK[0]]: [],
      [OTHER]: [{ mealType: "Cena", recipeId: "crema" }],
      "2026-09-14": [{ mealType: "Comida", recipeId: "datiles" }],
    };
    const restored = restoreDays(after, snap, WEEK);
    expect(restored[OTHER]).toEqual([{ mealType: "Cena", recipeId: "crema" }]);
    expect(restored["2026-09-14"]).toEqual([{ mealType: "Comida", recipeId: "datiles" }]);
  });

  it("no muta el plan ni la foto de entrada", () => {
    const snap = snapshotDays(before, WEEK);
    const after: WeekPlan = { ...before, [WEEK[1]]: [{ mealType: "Desayuno", recipeId: "batido" }] };
    const [afterCopy, snapCopy] = [clone(after), clone(snap)];
    restoreDays(after, snap, WEEK);
    expect(after).toEqual(afterCopy);
    expect(snap).toEqual(snapCopy);
  });
});
