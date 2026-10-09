// Spec: docs/pm/54-copiar-diario/spec.md › Acceptance criteria R2 (la copia), R6 (destino válido) y R7 (atajos y texto
// de las fechas); Edge cases (calorías NaN, receta que ya no existe).
// Tech: tech.md › APIs / interfaces (`copyDay`, `copyTargets`, `canCopyTo`, `formatDayShort`, `entryName` en
// src/lib/diary.ts) y State & edge cases. Fallan hasta la tarea 1 del tech design.
import { describe, expect, it } from "vitest";
import { canCopyTo, copyDay, copyTargets, entryName, formatDayShort } from "@/lib/diary";
import type { MealEntry } from "@/lib/types";
import { DESTINO_ENTRIES, LAST_MONTH, ORIGEN_ENTRIES, TODAY, TOMORROW, YESTERDAY } from "../fixtures/copiar-dia";
import { GUISO, LENTEJAS } from "../fixtures/diario";

/** Ids deterministas: n1, n2… */
function ids() {
  let n = 0;
  return () => `n${++n}`;
}

const copy = (entries: MealEntry[] = ORIGEN_ENTRIES, to = TODAY) => copyDay(entries, YESTERDAY, to, ids());

describe("R2: copyDay duplica las entradas del día", () => {
  it("devuelve una entrada nueva por cada una del origen, en el destino y en la misma franja", () => {
    const out = copy();
    expect(out).toHaveLength(ORIGEN_ENTRIES.length);
    out.forEach((e, i) => {
      expect(e.date).toBe(TODAY);
      expect(e.mealType).toBe(ORIGEN_ENTRIES[i].mealType);
    });
  });

  it("los ids son nuevos, distintos entre sí y distintos de los del origen", () => {
    const out = copy();
    const outIds = out.map((e) => e.id);
    expect(new Set(outIds).size).toBe(outIds.length);
    for (const original of ORIGEN_ENTRIES) expect(outIds).not.toContain(original.id);
  });

  it("sin newId usa crypto.randomUUID: ids únicos entre llamadas", () => {
    const a = copyDay(ORIGEN_ENTRIES, YESTERDAY, TODAY);
    const b = copyDay(ORIGEN_ENTRIES, YESTERDAY, TODAY);
    const all = [...a, ...b].map((e) => e.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it("conserva macros, fibra, raciones, gramos, unidades, receta, nombre y alimento de origen", () => {
    const out = copy();
    // Todo menos id y fecha: toEqual distingue "campo ausente" de "campo undefined" solo con toStrictEqual
    const sinIdNiFecha = (e: MealEntry) => {
      const c: Partial<MealEntry> = { ...e };
      delete c.id;
      delete c.date;
      return c;
    };
    out.forEach((e, i) => expect(sinIdNiFecha(e)).toStrictEqual(sinIdNiFecha(ORIGEN_ENTRIES[i])));
  });

  it("receta con raciones: servings 0,5 y los macros ya multiplicados (300 kcal) pasan tal cual", () => {
    const [guiso] = copy();
    expect(guiso).toMatchObject({ recipeId: GUISO.id, servings: 0.5, calories: 300 });
  });

  it("alimento en unidades: foodId, gramos y unidades pasan tal cual (2 ud · 120 g)", () => {
    const huevo = copy()[1];
    expect(huevo).toMatchObject({ foodId: "local:huevo", grams: 120, units: 2 });
    expect(huevo.calories).toBeCloseTo(168, 6);
  });

  it("receta de una ración: sin campo servings, como el original", () => {
    const lentejas = copy()[2];
    expect(lentejas.recipeId).toBe(LENTEJAS.id);
    expect(lentejas).not.toHaveProperty("servings");
  });

  it("sin dato de fibra la copia tampoco lo tiene (no se inventa 0); con fibra la conserva", () => {
    const out = copy();
    expect(out[3].fiber).toBe(4.5);
    expect(out[4]).not.toHaveProperty("fiber");
  });

  it("conserva el orden de registro del origen", () => {
    expect(copy().map((e) => e.customName ?? e.recipeId)).toEqual(
      ORIGEN_ENTRIES.map((e) => e.customName ?? e.recipeId),
    );
  });

  it("solo copia las entradas del día de origen, no las de otros días", () => {
    const otros: MealEntry[] = [...DESTINO_ENTRIES, ...ORIGEN_ENTRIES];
    const out = copy(otros);
    expect(out).toHaveLength(ORIGEN_ENTRIES.length);
    expect(out.map((e) => e.customName)).not.toContain("Tostadas con aguacate");
  });

  it("no incluye las entradas que ya había en el destino: devuelve solo las nuevas", () => {
    const out = copy([...ORIGEN_ENTRIES, ...DESTINO_ENTRIES]);
    expect(out).toHaveLength(ORIGEN_ENTRIES.length);
    expect(out.every((e) => e.date === TODAY)).toBe(true);
  });

  it("no cambia las entradas del origen ni devuelve las mismas referencias", () => {
    const before = structuredClone(ORIGEN_ENTRIES);
    const out = copy();
    expect(ORIGEN_ENTRIES).toEqual(before);
    out.forEach((e) => expect(ORIGEN_ENTRIES).not.toContain(e));
  });

  it("origen sin entradas: lista vacía", () => {
    expect(copy([])).toEqual([]);
    expect(copy(DESTINO_ENTRIES)).toEqual([]);
  });

  it("calorías NaN (copia de seguridad editada a mano): se copian tal cual, sin recalcular", () => {
    const raro: MealEntry = { ...ORIGEN_ENTRIES[3], id: "raro", calories: NaN };
    const [e] = copy([raro]);
    expect(e.calories).toBeNaN();
    expect(e.date).toBe(TODAY);
  });

  it("entrada de una receta que ya no existe: se copia con su recipeId, como el resto del historial", () => {
    const huerfana: MealEntry = { ...ORIGEN_ENTRIES[2], id: "huerfana", recipeId: "ya-no-existe" };
    expect(copy([huerfana])[0].recipeId).toBe("ya-no-existe");
  });

  it("destino futuro o pasado: la fecha de destino es la pedida", () => {
    expect(copy(ORIGEN_ENTRIES, TOMORROW).every((e) => e.date === TOMORROW)).toBe(true);
    expect(copy(ORIGEN_ENTRIES, LAST_MONTH).every((e) => e.date === LAST_MONTH)).toBe(true);
  });
});

describe("R6: canCopyTo", () => {
  it("fecha futura o pasada distinta del origen: sí", () => {
    expect(canCopyTo(YESTERDAY, TODAY)).toBe(true);
    expect(canCopyTo(YESTERDAY, TOMORROW)).toBe(true);
    expect(canCopyTo(YESTERDAY, LAST_MONTH)).toBe(true);
    expect(canCopyTo(YESTERDAY, "2099-12-31")).toBe(true);
  });

  it("el propio día de origen: no", () => {
    expect(canCopyTo(YESTERDAY, YESTERDAY)).toBe(false);
  });

  it("fecha vacía (input borrado): no", () => {
    expect(canCopyTo(YESTERDAY, "")).toBe(false);
  });

  it("no es una fecha YYYY-MM-DD válida: no", () => {
    for (const mala of ["abc", "2026-9-22", "22/09/2026", "2026-13-01", "2026-02-30", "2026-09-31"]) {
      expect(canCopyTo(YESTERDAY, mala), mala).toBe(false);
    }
  });
});

describe("R7: copyTargets (atajos desde hoy, sin el día de origen)", () => {
  it("origen distinto de los tres: Hoy, Mañana y En 7 días, con su fecha", () => {
    expect(copyTargets(YESTERDAY, TODAY)).toEqual([
      { label: "Hoy", date: "2026-09-22" },
      { label: "Mañana", date: "2026-09-23" },
      { label: "En 7 días", date: "2026-09-29" },
    ]);
  });

  it("si el origen es hoy no se ofrece Hoy", () => {
    expect(copyTargets(TODAY, TODAY).map((t) => t.label)).toEqual(["Mañana", "En 7 días"]);
  });

  it("si el origen es mañana no se ofrece Mañana", () => {
    expect(copyTargets(TOMORROW, TODAY).map((t) => t.label)).toEqual(["Hoy", "En 7 días"]);
  });

  it("si el origen es dentro de 7 días no se ofrece En 7 días", () => {
    expect(copyTargets("2026-09-29", TODAY).map((t) => t.label)).toEqual(["Hoy", "Mañana"]);
  });

  it("cuentan desde hoy, no desde el día que se mira", () => {
    const desde = copyTargets("2026-01-01", TODAY);
    expect(desde.map((t) => t.date)).toEqual(["2026-09-22", "2026-09-23", "2026-09-29"]);
  });

  it("cruzan fin de mes y fin de año", () => {
    expect(copyTargets(YESTERDAY, "2026-09-30").map((t) => t.date)).toEqual(["2026-09-30", "2026-10-01", "2026-10-07"]);
    expect(copyTargets(YESTERDAY, "2026-12-28").map((t) => t.date)).toEqual(["2026-12-28", "2026-12-29", "2027-01-04"]);
  });
});

describe("R7: formatDayShort", () => {
  it("«lun 5 oct»: día de la semana en minúscula y mes abreviado, sin año ni cero", () => {
    expect(formatDayShort("2026-10-05")).toBe("lun 5 oct");
    expect(formatDayShort("2026-10-07")).toBe("mié 7 oct");
    expect(formatDayShort("2026-10-03")).toBe("sáb 3 oct");
    expect(formatDayShort("2026-09-22")).toBe("mar 22 sep");
  });

  it("cubre los doce meses y los siete días", () => {
    const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    meses.forEach((m, i) => {
      const fecha = `2026-${String(i + 1).padStart(2, "0")}-15`;
      expect(formatDayShort(fecha).split(" ")[2], fecha).toBe(m);
    });
    const dias = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
    dias.forEach((d, i) => expect(formatDayShort(`2026-09-${21 + i}`).split(" ")[0]).toBe(d));
  });

  it("fin de año", () => {
    expect(formatDayShort("2026-12-31")).toBe("jue 31 dic");
    expect(formatDayShort("2027-01-04")).toBe("lun 4 ene");
  });
});

describe("entryName (nombre de la entrada en la lista y en el aviso de conflicto)", () => {
  it("customName manda sobre la receta", () => {
    const e: MealEntry = { ...ORIGEN_ENTRIES[3], recipeId: LENTEJAS.id };
    expect(entryName(e, [LENTEJAS])).toBe("Ensalada de la casa");
  });

  it("sin customName usa el nombre de la receta", () => {
    expect(entryName(ORIGEN_ENTRIES[2], [LENTEJAS, GUISO])).toBe("Lentejas");
  });

  it("receta que ya no existe y sin customName: «Receta»", () => {
    expect(entryName({ ...ORIGEN_ENTRIES[2], recipeId: "ya-no-existe" }, [LENTEJAS])).toBe("Receta");
  });
});
