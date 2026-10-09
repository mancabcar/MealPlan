// Spec: docs/pm/11-medias-adherencia/spec.md › R1–R8, Acceptance criteria y Edge cases.
// Tech: docs/pm/11-medias-adherencia/tech.md › APIs / interfaces (`statsPeriod`, `dailyTotals`, `isCompliantDay`,
// `periodStats`, `formatPeriod`, `addDays`, `macroTarget`) y Testing strategy.
// Falla hasta que existan src/lib/diaryStats.ts, `addDays` en src/lib/week.ts y `macroTarget` en planMacros (tareas 2–3).
import { describe, expect, it } from "vitest";
import { dailyTotals, formatPeriod, isCompliantDay, periodStats, statsPeriod, weekDayStates } from "@/lib/diaryStats";
import { macroStatus, macroTarget } from "@/lib/planMacros";
import { addDays } from "@/lib/week";
import {
  ALL_ENTRIES,
  MONTH_ENTRIES,
  TODAY,
  TODAY_ENTRY,
  TOMORROW,
  WEEK_ENTRIES,
  YESTERDAY,
  statsProfile,
  statsProfileNoRange,
} from "../fixtures/medias-adherencia";
import { entry } from "../fixtures/diario";

const day = (calories: number, protein: number) => ({ calories, protein, carbs: 200, fat: 60 });

describe("addDays: fechas locales, un día de calendario", () => {
  it("resta y suma días cruzando mes y año", () => {
    expect(addDays("2026-09-22", -1)).toBe("2026-09-21");
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("el cambio de hora (25 oct 2026) no salta ni repite días", () => {
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
    expect(addDays("2026-10-26", -1)).toBe("2026-10-25");
    expect(addDays("2026-03-30", -1)).toBe("2026-03-29");
  });
});

describe("R6: el periodo son N días completos y el día en curso nunca cuenta", () => {
  it("con la fecha de hoy, 7 días acaban ayer: 15–21 sep", () => {
    const p = statsPeriod(TODAY, TODAY, 7);
    expect(p.start).toBe("2026-09-15");
    expect(p.end).toBe("2026-09-21");
    expect(p.dates).toEqual(["2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21"]);
  });

  it("con la fecha de hoy, 30 días: 23 ago–21 sep", () => {
    const p = statsPeriod(TODAY, TODAY, 30);
    expect(p.start).toBe("2026-08-23");
    expect(p.end).toBe("2026-09-21");
    expect(p.dates).toHaveLength(30);
  });

  it("con una fecha pasada (14 sep), el periodo acaba en ella: 8–14 sep", () => {
    const p = statsPeriod("2026-09-14", TODAY, 7);
    expect(p.start).toBe("2026-09-08");
    expect(p.end).toBe("2026-09-14");
  });

  it("con ayer, el periodo acaba ayer (es un día completo)", () => {
    expect(statsPeriod("2026-09-21", TODAY, 7).end).toBe("2026-09-21");
  });

  it("con una fecha futura, el periodo acaba ayer, como con hoy", () => {
    expect(statsPeriod(TOMORROW, TODAY, 7)).toEqual(statsPeriod(TODAY, TODAY, 7));
  });

  it('con la fecha borrada (""), el periodo acaba ayer', () => {
    expect(statsPeriod("", TODAY, 7)).toEqual(statsPeriod(TODAY, TODAY, 7));
  });

  it("cruzando el cambio de hora hay exactamente 7 y 30 fechas distintas y consecutivas", () => {
    for (const days of [7, 30] as const) {
      const { dates } = statsPeriod("2026-10-28", "2026-11-05", days);
      expect(new Set(dates).size).toBe(days);
      expect(dates.at(-1)).toBe("2026-10-28");
      for (let i = 1; i < dates.length; i++) expect(addDays(dates[i - 1], 1)).toBe(dates[i]);
    }
  });
});

describe("R1 · R2: medias solo de los días con registros", () => {
  const week = statsPeriod(TODAY, TODAY, 7).dates;

  it("1800, 2000 y 2200 kcal en 3 de 7 días → media 2000 (no 857)", () => {
    const stats = periodStats({ entries: ALL_ENTRIES, profile: statsProfile, dates: week })!;
    expect(stats.loggedDays).toBe(3);
    expect(stats.averages.calories).toBe(2000);
  });

  it("medias de cada macro, sin redondear", () => {
    const { averages } = periodStats({ entries: WEEK_ENTRIES, profile: statsProfile, dates: week })!;
    expect(averages.protein).toBeCloseTo(395 / 3);
    expect(averages.carbs).toBeCloseTo(670 / 3);
    expect(averages.fat).toBeCloseTo(205 / 3);
  });

  it("un día con dos registros (1200 + 1000) aporta un solo total de 2200", () => {
    const totals = dailyTotals(WEEK_ENTRIES, week);
    expect(totals.get("2026-09-18")).toEqual({ calories: 2200, protein: 140, carbs: 230, fat: 75 });
  });

  it("dailyTotals solo devuelve las fechas pedidas con al menos un registro", () => {
    const totals = dailyTotals(ALL_ENTRIES, week);
    expect([...totals.keys()].sort()).toEqual(["2026-09-16", "2026-09-18", "2026-09-20"]);
  });

  it("entradas con raciones: se suman sus macros ya escalados, con decimales", () => {
    const e = [
      entry("2026-09-16", "Comida", { recipeId: "r", customName: undefined, servings: 0.25, calories: 37.5, protein: 2, carbs: 3, fat: 1.5 }),
      entry("2026-09-16", "Cena", { recipeId: "r", customName: undefined, servings: 0.25, calories: 37.5, protein: 2, carbs: 3, fat: 1.5 }),
      entry("2026-09-17", "Comida", { calories: 100, protein: 1, carbs: 1, fat: 1 }),
    ];
    const stats = periodStats({ entries: e, profile: statsProfile, dates: week })!;
    expect(stats.averages.calories).toBe(87.5);
  });

  it("lo registrado hoy o en el futuro no cuenta", () => {
    const withFuture = [...WEEK_ENTRIES, TODAY_ENTRY, entry(TOMORROW, "Comida", { calories: 9000 })];
    expect(periodStats({ entries: withFuture, profile: statsProfile, dates: week })).toEqual(
      periodStats({ entries: WEEK_ENTRIES, profile: statsProfile, dates: week }),
    );
  });

  it("un macro ausente o no numérico (backup) suma 0, no NaN", () => {
    const broken = { ...entry("2026-09-16", "Comida", { calories: 2000, protein: 140 }), fat: undefined as unknown as number, carbs: NaN };
    const { averages } = periodStats({ entries: [broken], profile: statsProfile, dates: week })!;
    expect(averages.fat).toBe(0);
    expect(averages.carbs).toBe(0);
    expect(averages.calories).toBe(2000);
  });
});

describe("R3: adherencia «X de N días», N = días con registros", () => {
  it("la semana del fixture: 2 de 3 días cumplen", () => {
    const stats = periodStats({ entries: ALL_ENTRIES, profile: statsProfile, dates: statsPeriod(TODAY, TODAY, 7).dates })!;
    expect(stats).toMatchObject({ loggedDays: 3, compliantDays: 2 });
  });

  it("6 días registrados, 5 cumplen → 5 de 6", () => {
    const dates = statsPeriod(TODAY, TODAY, 7).dates;
    const e = dates.slice(0, 6).map((d, i) => entry(d, "Comida", { calories: i === 0 ? 2500 : 2000, protein: 140 }));
    expect(periodStats({ entries: e, profile: statsProfile, dates })).toMatchObject({ loggedDays: 6, compliantDays: 5 });
  });

  it("un día registrado con 0 kcal cuenta y no cumple", () => {
    const dates = statsPeriod(TODAY, TODAY, 7).dates;
    const e = [entry("2026-09-16", "Comida", { calories: 0, protein: 0, carbs: 0, fat: 0 })];
    expect(periodStats({ entries: e, profile: statsProfile, dates })).toMatchObject({ loggedDays: 1, compliantDays: 0 });
  });
});

describe("R4: un día cumple por kcal (±10 %) y proteína (rango o ±10 %), como el Plan", () => {
  it("2000 kcal + rango 130–160: 2150 kcal y 135 g cumple", () => {
    expect(isCompliantDay(day(2150, 135), statsProfile)).toBe(true);
  });

  it("2150 kcal y 125 g no cumple: por debajo del rango aunque esté a menos del 10 % del mínimo", () => {
    expect(isCompliantDay(day(2150, 125), statsProfile)).toBe(false);
  });

  it("2201 kcal con proteína en rango no cumple (por encima de 2200)", () => {
    expect(isCompliantDay(day(2201, 140), statsProfile)).toBe(false);
  });

  it("los límites exactos cumplen: 1800 y 2200 kcal; 130 y 160 g", () => {
    expect(isCompliantDay(day(1800, 130), statsProfile)).toBe(true);
    expect(isCompliantDay(day(2200, 160), statsProfile)).toBe(true);
    expect(isCompliantDay(day(1799, 145), statsProfile)).toBe(false);
    expect(isCompliantDay(day(2000, 161), statsProfile)).toBe(false);
  });

  it("sin rango, proteinGoal 140: 2000 kcal y 128 g cumple (128 ≥ 126)", () => {
    expect(isCompliantDay(day(2000, 128), statsProfileNoRange)).toBe(true);
    expect(isCompliantDay(day(2000, 125), statsProfileNoRange)).toBe(false);
  });

  it("carbohidratos y grasas no deciden la adherencia (non-goal)", () => {
    expect(isCompliantDay({ calories: 2000, protein: 140, carbs: 900, fat: 1 }, statsProfile)).toBe(true);
  });

  it("mismo criterio que el Plan: cumple ⇔ macroStatus de kcal y proteína es «within»", () => {
    for (const profile of [statsProfile, statsProfileNoRange]) {
      for (const calories of [1799.4, 1799.6, 2000, 2200.4, 2200.6]) {
        for (const protein of [125.6, 129.5, 145, 160.4, 160.5]) {
          const t = day(calories, protein);
          const plan =
            macroStatus(calories, macroTarget("calories", profile), 10) === "within" &&
            macroStatus(protein, macroTarget("protein", profile), 10) === "within";
          expect(isCompliantDay(t, profile), `${calories} kcal / ${protein} g`).toBe(plan);
        }
      }
    }
  });
});

describe("macroTarget: un solo mapeo perfil → objetivo, compartido por Plan y Diario", () => {
  it("proteína = rango si existe; si no, proteinGoal", () => {
    expect(macroTarget("protein", statsProfile)).toEqual({ min: 130, max: 160 });
    expect(macroTarget("protein", statsProfileNoRange)).toBe(140);
    expect(macroTarget("calories", statsProfile)).toBe(2000);
    expect(macroTarget("carbs", statsProfile)).toBe(230);
    expect(macroTarget("fat", statsProfile)).toBe(69);
  });
});

describe("R5: cambiar a 30 días recalcula medias y adherencia", () => {
  it("30 días: 5 días registrados, 2120 kcal de media, 3 de 5 cumplen; el 22 ago queda fuera", () => {
    const stats = periodStats({ entries: ALL_ENTRIES, profile: statsProfile, dates: statsPeriod(TODAY, TODAY, 30).dates })!;
    expect(stats).toMatchObject({ loggedDays: 5, compliantDays: 3 });
    expect(stats.averages.calories).toBe(2120);
  });

  it("con la fecha en 14 sep, 7 días (8–14 sep): solo el 10 sep, 0 de 1", () => {
    const stats = periodStats({ entries: ALL_ENTRIES, profile: statsProfile, dates: statsPeriod("2026-09-14", TODAY, 7).dates })!;
    expect(stats).toMatchObject({ loggedDays: 1, compliantDays: 0 });
    expect(stats.averages.calories).toBe(2600);
  });
});

describe("R7: sin días con registros no hay resumen", () => {
  it("sin registros en el periodo → null", () => {
    expect(periodStats({ entries: MONTH_ENTRIES, profile: statsProfile, dates: statsPeriod(TODAY, TODAY, 7).dates })).toBeNull();
  });

  it("con registros solo hoy → null (hoy no cuenta)", () => {
    expect(periodStats({ entries: [TODAY_ENTRY], profile: statsProfile, dates: statsPeriod(TODAY, TODAY, 7).dates })).toBeNull();
  });
});

describe("R8: rango de fechas del periodo", () => {
  it("mismo mes: «15–21 sep»", () => {
    expect(formatPeriod("2026-09-15", "2026-09-21")).toBe("15–21 sep");
  });

  it("cambio de mes: «23 ago–21 sep»", () => {
    expect(formatPeriod("2026-08-23", "2026-09-21")).toBe("23 ago–21 sep");
  });
});

// Spec: docs/pm/50-marcar-dias-cumplen/spec.md › R1, R2 y Edge cases.
// Tech: docs/pm/50-marcar-dias-cumplen/tech.md › APIs / interfaces (`weekDayStates`, `DayState`).
// Falla hasta que exista `weekDayStates` en src/lib/diaryStats.ts (tarea 2).
describe("#50 R1 · R2: estado de cada día de la gráfica semanal", () => {
  // Hoy es martes 22 sep: la gráfica con la fecha de hoy enseña 16–22 sep (incluye hoy).
  const dates = ["2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", TODAY];
  const states = (entries = ALL_ENTRIES, ds = dates) => weekDayStates({ entries, profile: statsProfile, dates: ds, today: TODAY });

  it("R1: con el fixture, 16 y 18 sep cumplen y 20 sep no", () => {
    const s = states();
    expect(s.get("2026-09-16")).toBe("met");
    expect(s.get("2026-09-18")).toBe("met");
    expect(s.get("2026-09-20")).toBe("missed");
  });

  it("R1: 2150 kcal y 135 g (rango 130–160) cumple", () => {
    const e = [entry("2026-09-16", "Comida", { calories: 2150, protein: 135, carbs: 200, fat: 60 })];
    expect(states(e).get("2026-09-16")).toBe("met");
  });

  it("R1: 2150 kcal y 125 g no cumple (proteína por debajo del rango)", () => {
    const e = [entry("2026-09-16", "Comida", { calories: 2150, protein: 125, carbs: 200, fat: 60 })];
    expect(states(e).get("2026-09-16")).toBe("missed");
  });

  it("R2: un día pasado sin entradas es «empty»", () => {
    const s = states();
    for (const d of ["2026-09-17", "2026-09-19", "2026-09-21"]) expect(s.get(d)).toBe("empty");
  });

  it("R2: hoy es «today» aunque sus entradas cumplirían el objetivo", () => {
    const e = [entry(TODAY, "Comida", { calories: 2000, protein: 140, carbs: 200, fat: 60 })];
    expect(states(e).get(TODAY)).toBe("today");
  });

  it("R2: hoy sin entradas también es «today»", () => {
    expect(states([]).get(TODAY)).toBe("today");
  });

  it("R2: un día futuro es «empty» aunque tenga entradas que cumplirían", () => {
    const e = [entry(TOMORROW, "Comida", { calories: 2000, protein: 140, carbs: 200, fat: 60 })];
    expect(states(e, [YESTERDAY, TODAY, TOMORROW]).get(TOMORROW)).toBe("empty");
  });

  it("devuelve una entrada por cada fecha pedida, en orden", () => {
    expect([...states().keys()]).toEqual(dates);
  });

  it("Edge case: un macro ausente o no numérico (backup) suma 0 y no rompe el estado", () => {
    const broken = { ...entry("2026-09-16", "Comida", { calories: 2000, protein: 140 }), fat: undefined as unknown as number, carbs: NaN };
    expect(states([broken]).get("2026-09-16")).toBe("met");
  });

  it("Edge case: sin fechas, mapa vacío", () => {
    expect(states(ALL_ENTRIES, []).size).toBe(0);
  });

  it("Métrica: los días «met» de los días completos coinciden con los cumplidos de periodStats", () => {
    const past = statsPeriod(TODAY, TODAY, 7); // 15–21 sep
    const s = weekDayStates({ entries: ALL_ENTRIES, profile: statsProfile, dates: past.dates, today: TODAY });
    const met = [...s.values()].filter((v) => v === "met").length;
    expect(met).toBe(periodStats({ entries: ALL_ENTRIES, profile: statsProfile, dates: past.dates })!.compliantDays);
  });
});
