// Spec: docs/pm/9-historial-medidas/spec.md › Requirements R1, R3, R4, R8, R9, R10, R12–R16, Acceptance criteria y
// Edge cases. Tech: docs/pm/9-historial-medidas/tech.md › Data model, APIs / interfaces y UI test contract.
// Lógica pura de src/lib/measurements.ts: sin localStorage, sin reloj ("hoy" se pasa como argumento).
import { describe, expect, it } from "vitest";
import {
  DATE_FUTURE_ERROR,
  DATE_REQUIRED_ERROR,
  draftFrom,
  EMPTY_MEASUREMENT_ERROR,
  emptyDraft,
  filterByRange,
  formatDecimal,
  formatMeasurementDate,
  latestWeightMeasurement,
  METRIC_KEYS,
  METRICS,
  metricSeries,
  parseMeasurementDraft,
  profileWeightPatch,
  rangeError,
  sanitizeMeasurements,
  skinfoldSum,
  unusualValues,
  weightChangeOnSave,
  weightTrend,
  weightTrendChange,
} from "@/lib/measurements";
import type { MetricKey, UserProfile } from "@/lib/types";
import { lucia, manuel } from "../fixtures/profiles";
import {
  FIELD_LABELS,
  HOME_WEIGHTS,
  measurement,
  NUTRI_JULY,
  NUTRI_JULY_TYPED,
  NUTRI_JUNE,
  NUTRI_MAY,
  NUTRI_REPORTS,
  SKIN_SUMS,
  TODAY,
} from "../fixtures/measurements";

const draft = (values: Partial<Record<MetricKey, string>>, date = TODAY, source: "home" | "nutritionist" = "home") => ({
  date,
  source,
  values,
});

// ---------------------------------------------------------------------------

describe("R3: catálogo de métricas del informe de la nutricionista", () => {
  it("22 métricas: 6 de bioimpedancia, 10 perímetros y 6 pliegues, en el orden del informe", () => {
    expect(METRIC_KEYS).toEqual([
      "weightKg", "muscleKg", "fatKg", "fatPct", "bmi", "visceralFat",
      "bicepsL", "bicepsR", "waist", "hip", "legL", "legR", "calfL", "calfR", "chestBack", "glutes",
      "skinBiceps", "skinTriceps", "skinAbdominal", "skinSuprailiac", "skinQuadriceps", "skinCalf",
    ]);
    const byGroup = (g: string) => METRICS.filter((m) => m.group === g).map((m) => m.key);
    expect(byGroup("bia")).toHaveLength(6);
    expect(byGroup("perimeters")).toHaveLength(10);
    expect(byGroup("skinfolds")).toHaveLength(6);
  });

  it("cada métrica tiene la etiqueta de campo del contrato de UI", () => {
    expect(Object.fromEntries(METRICS.map((m) => [m.key, m.fieldLabel]))).toEqual(FIELD_LABELS);
  });

  it("las bilaterales (bíceps, pierna, gemelo) comparten gráfica con su pareja", () => {
    const pairs = METRICS.filter((m) => m.chart).map((m) => [m.key, m.chart]);
    expect(pairs).toEqual(
      expect.arrayContaining([
        ["bicepsL", "Bíceps"], ["bicepsR", "Bíceps"],
        ["legL", "Pierna"], ["legR", "Pierna"],
        ["calfL", "Gemelo"], ["calfR", "Gemelo"],
      ]),
    );
  });
});

describe("R4 · Edge cases: rangos válidos y su mensaje", () => {
  it.each([
    ["weightKg", "Entre 30 y 250 kg"],
    ["muscleKg", "Entre 1 y 150 kg"],
    ["fatKg", "Entre 1 y 150 kg"],
    ["fatPct", "Entre 1 y 75 %"],
    ["bmi", "Entre 10 y 70"],
    ["visceralFat", "Entre 1 y 59"],
    ["waist", "Entre 5 y 250 cm"],
    ["legR", "Entre 5 y 250 cm"],
    ["skinCalf", "Entre 1 y 80 mm"],
  ] as [MetricKey, string][])("%s: «%s»", (key, message) => {
    expect(rangeError(key)).toBe(message);
  });
});

// ---------------------------------------------------------------------------

describe("R1: fecha, origen y al menos un valor", () => {
  it("un borrador nuevo tiene la fecha de hoy, origen Casa y ningún valor", () => {
    expect(emptyDraft(TODAY)).toEqual({ date: TODAY, source: "home", values: {} });
  });

  it("R2: fecha + peso es una medición válida", () => {
    expect(parseMeasurementDraft(draft({ weightKg: "74,8" }), TODAY)).toEqual({
      value: { date: TODAY, source: "home", values: { weightKg: 74.8 } },
      errors: {},
    });
  });

  it("una fecha posterior a hoy no se guarda", () => {
    const { value, errors } = parseMeasurementDraft(draft({ weightKg: "74,8" }, "2026-09-23"), TODAY);
    expect(value).toBeUndefined();
    expect(errors.date).toBe(DATE_FUTURE_ERROR);
    expect(DATE_FUTURE_ERROR).toBe("La fecha no puede ser futura");
  });

  it("hoy y fechas pasadas sí", () => {
    expect(parseMeasurementDraft(draft({ weightKg: "74,8" }, TODAY), TODAY).value).toBeDefined();
    expect(parseMeasurementDraft(draft({ weightKg: "85" }, "2026-05-05"), TODAY).value).toBeDefined();
  });

  it("sin fecha, o con una que no es fecha, no se guarda", () => {
    expect(parseMeasurementDraft(draft({ weightKg: "74,8" }, ""), TODAY).errors.date).toBe(DATE_REQUIRED_ERROR);
    expect(parseMeasurementDraft(draft({ weightKg: "74,8" }, "31/07/2026"), TODAY).errors.date).toBe(DATE_REQUIRED_ERROR);
    expect(DATE_REQUIRED_ERROR).toBe("Elige una fecha");
  });

  it("sin ningún valor no se guarda", () => {
    const { value, errors } = parseMeasurementDraft(draft({ weightKg: "", waist: "   " }), TODAY);
    expect(value).toBeUndefined();
    expect(errors.form).toBe(EMPTY_MEASUREMENT_ERROR);
    expect(EMPTY_MEASUREMENT_ERROR).toBe("Añade al menos un valor");
  });

  it("el origen se conserva", () => {
    expect(parseMeasurementDraft(draft({ weightKg: "76" }, "2026-07-31", "nutritionist"), TODAY).value?.source).toBe(
      "nutritionist",
    );
  });
});

describe("R3 · R4: los valores se guardan tal cual los escribe el usuario", () => {
  it("la toma del 31/07 tecleada con coma da exactamente los números del informe", () => {
    const { value, errors } = parseMeasurementDraft(draft(NUTRI_JULY_TYPED, "2026-07-31", "nutritionist"), TODAY);
    expect(errors).toEqual({});
    expect(value).toEqual({ date: "2026-07-31", source: "nutritionist", values: NUTRI_JULY.values });
  });

  it("coma y punto decimal valen igual", () => {
    expect(parseMeasurementDraft(draft({ weightKg: "75,3" }), TODAY).value?.values).toEqual({ weightKg: 75.3 });
    expect(parseMeasurementDraft(draft({ weightKg: "75.3" }), TODAY).value?.values).toEqual({ weightKg: 75.3 });
  });

  it("los campos vacíos no se guardan (todo es opcional)", () => {
    const { value } = parseMeasurementDraft(draft({ weightKg: "", waist: "84,5", hip: "87,6" }), TODAY);
    expect(value?.values).toEqual({ waist: 84.5, hip: 87.6 });
  });

  it("un IMC incoherente con el peso se guarda sin tocar (no se recalcula)", () => {
    const { value } = parseMeasurementDraft(draft({ weightKg: "76,0", bmi: "29,3" }), TODAY);
    expect(value?.values).toEqual({ weightKg: 76, bmi: 29.3 });
  });

  it("algo que no es un número da el error del rango junto a ese campo y no se guarda", () => {
    const { value, errors } = parseMeasurementDraft(draft({ weightKg: "abc", waist: "84,5" }), TODAY);
    expect(value).toBeUndefined();
    expect(errors).toEqual({ weightKg: "Entre 30 y 250 kg" });
  });

  it("fuera de rango: error en ese campo; los límites son válidos", () => {
    expect(parseMeasurementDraft(draft({ weightKg: "29,9" }), TODAY).errors.weightKg).toBe("Entre 30 y 250 kg");
    expect(parseMeasurementDraft(draft({ weightKg: "250,1" }), TODAY).errors.weightKg).toBe("Entre 30 y 250 kg");
    expect(parseMeasurementDraft(draft({ weightKg: "30" }), TODAY).errors).toEqual({});
    expect(parseMeasurementDraft(draft({ weightKg: "250" }), TODAY).errors).toEqual({});
    expect(parseMeasurementDraft(draft({ skinCalf: "81" }), TODAY).errors.skinCalf).toBe("Entre 1 y 80 mm");
  });

  it("el «9,7» truncado del PDF entra en el rango de perímetros (lo pilla R16, no la validación)", () => {
    expect(parseMeasurementDraft(draft({ legL: "49,6", legR: "9,7" }), TODAY).errors).toEqual({});
  });
});

describe("R5: editar parte de la medición guardada", () => {
  it("draftFrom muestra cada número con coma y sin ceros de más", () => {
    const d = draftFrom(NUTRI_JULY);
    expect(d.date).toBe("2026-07-31");
    expect(d.source).toBe("nutritionist");
    expect(d.values.weightKg).toBe("76");
    expect(d.values.fatPct).toBe("36,4");
    expect(d.values.skinQuadriceps).toBe("8");
    expect(d.values.legR).toBe("49,7");
  });

  it("guardar sin cambios da los mismos valores", () => {
    expect(parseMeasurementDraft(draftFrom(NUTRI_JULY), TODAY).value?.values).toEqual(NUTRI_JULY.values);
  });
});

// ---------------------------------------------------------------------------

describe("sanitizeMeasurements: carga de lo guardado (upgrade idempotente)", () => {
  it("nada guardado o algo que no es una lista → lista vacía", () => {
    expect(sanitizeMeasurements(null)).toEqual([]);
    expect(sanitizeMeasurements({})).toEqual([]);
    expect(sanitizeMeasurements("[]")).toEqual([]);
  });

  it("las mediciones válidas se conservan sin cambios", () => {
    const list = [...NUTRI_REPORTS, ...HOME_WEIGHTS];
    expect(sanitizeMeasurements(list)).toEqual(list);
  });

  it("es idempotente", () => {
    const once = sanitizeMeasurements([...NUTRI_REPORTS, { id: 3 }, null]);
    expect(sanitizeMeasurements(once)).toEqual(once);
  });

  it("descarta las mal formadas", () => {
    const ok = HOME_WEIGHTS[0];
    expect(
      sanitizeMeasurements([
        ok,
        null,
        { ...ok, id: 7 },
        { ...ok, date: "22/09/2026" },
        { ...ok, source: "gym" },
        { ...ok, values: "76" },
        { ...ok, savedAt: undefined },
      ]),
    ).toEqual([ok]);
  });

  it("quita métricas desconocidas o no numéricas, y la medición si se queda sin valores", () => {
    const m = measurement("x", "2026-09-01", { weightKg: 75 });
    const dirty = { ...m, values: { weightKg: 75, height: 177, waist: "84", hip: Number.NaN } };
    expect(sanitizeMeasurements([dirty])).toEqual([m]);
    expect(sanitizeMeasurements([{ ...m, values: { height: 177 } }])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("R8: tendencia del peso = media de los 7 días anteriores, ese día incluido", () => {
  const SPEC_EXAMPLE = [
    measurement("a", "2026-09-15", { weightKg: 75.6 }),
    measurement("b", "2026-09-19", { weightKg: 74.9 }),
    measurement("c", "2026-09-22", { weightKg: 75.0 }),
    measurement("d", "2026-09-24", { weightKg: 74.8 }),
  ];
  const at = (date: string, list = SPEC_EXAMPLE) => weightTrend(list).find((p) => p.date === date)?.value;

  it("criterio de la spec: 24/09 = media de 19, 22 y 24/09 = 74,9", () => {
    expect(at("2026-09-24")).toBeCloseTo(74.9, 5);
  });

  it("criterio de la spec: 22/09 = media de 19 y 22/09 = 74,95 (el 15/09 queda fuera)", () => {
    expect(at("2026-09-22")).toBeCloseTo(74.95, 5);
  });

  it("un punto por fecha con peso, de la más antigua a la más reciente, aunque lleguen desordenadas", () => {
    expect(weightTrend([...SPEC_EXAMPLE].reverse()).map((p) => p.date)).toEqual([
      "2026-09-15", "2026-09-19", "2026-09-22", "2026-09-24",
    ]);
  });

  it("una sola medición con peso: la tendencia es ese valor", () => {
    expect(weightTrend([measurement("a", "2026-09-22", { weightKg: 75 })])).toEqual([{ date: "2026-09-22", value: 75 }]);
  });

  it("las mediciones sin peso no cuentan", () => {
    expect(weightTrend([measurement("a", "2026-09-22", { waist: 84.5 })])).toEqual([]);
    expect(weightTrend([NUTRI_JULY, measurement("w", "2026-07-31", { waist: 84 })])).toEqual([
      { date: "2026-07-31", value: 76 },
    ]);
  });

  it("dos pesadas el mismo día cuentan las dos", () => {
    const sameDay = [
      measurement("a", "2026-09-22", { weightKg: 75 }),
      measurement("b", "2026-09-22", { weightKg: 76 }, "nutritionist"),
    ];
    expect(weightTrend(sameDay)).toEqual([{ date: "2026-09-22", value: 75.5 }]);
  });

  it("la ventana es de días de calendario, también al cruzar el cambio de hora (25/10)", () => {
    const list = [measurement("a", "2026-10-20", { weightKg: 80 }), measurement("b", "2026-10-26", { weightKg: 78 }),
      measurement("c", "2026-10-27", { weightKg: 78 })];
    expect(at("2026-10-26", list)).toBeCloseTo(79, 5); // 20/10 es el día −6: entra
    expect(at("2026-10-27", list)).toBeCloseTo(78, 5); // 20/10 es el día −7: fuera
  });
});

describe("R12: cambio de la tendencia en 30 días", () => {
  it("tendencia de la última pesada menos la de la pesada más cercana a hace 30 días (−1,1 kg)", () => {
    expect(weightTrendChange(HOME_WEIGHTS, TODAY)).toBeCloseTo(-1.1, 5);
  });

  it("sin pesadas entre hace 35 y 25 días, no hay cifra", () => {
    const recent = HOME_WEIGHTS.filter((m) => m.date >= "2026-09-01");
    expect(weightTrendChange(recent, TODAY)).toBeUndefined();
    expect(weightTrendChange([], TODAY)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe("R9: el peso del perfil es el de la medición con peso más reciente", () => {
  it("la de fecha más reciente con peso", () => {
    expect(latestWeightMeasurement([...HOME_WEIGHTS, ...NUTRI_REPORTS])?.id).toBe("home-0922");
  });

  it("ignora las que no tienen peso", () => {
    const onlyWaist = measurement("w", "2026-09-25", { waist: 84 });
    expect(latestWeightMeasurement([...HOME_WEIGHTS, onlyWaist])?.id).toBe("home-0922");
  });

  it("el mismo día manda la última guardada", () => {
    const morning = measurement("am", TODAY, { weightKg: 75 }, "home", `${TODAY}T07:00:00.000Z`);
    const clinic = measurement("pm", TODAY, { weightKg: 75.4 }, "nutritionist", `${TODAY}T17:00:00.000Z`);
    expect(latestWeightMeasurement([clinic, morning])?.id).toBe("pm");
  });

  it("sin mediciones con peso, ninguna", () => {
    expect(latestWeightMeasurement([])).toBeUndefined();
    expect(latestWeightMeasurement([measurement("w", TODAY, { waist: 84 })])).toBeUndefined();
  });
});

describe("R9 · R10: cuándo cambia el peso del perfil al guardar", () => {
  const withWeight = (p: UserProfile, kg: number): UserProfile =>
    p.body ? { ...p, body: { ...p.body, weightKg: kg } } : { ...p, weightKg: kg };
  const profile = withWeight(lucia, 75);

  it("una medición nueva y más reciente con otro peso → ese peso", () => {
    const saved = measurement("n", "2026-09-24", { weightKg: 74.8 });
    expect(weightChangeOnSave(HOME_WEIGHTS, saved, profile)).toBe(74.8);
  });

  it("una medición más antigua que la última con peso → no cambia", () => {
    expect(weightChangeOnSave(HOME_WEIGHTS, NUTRI_JULY, profile)).toBeNull();
  });

  it("el mismo peso que ya tiene el perfil → no cambia (no se ofrece recalcular)", () => {
    expect(weightChangeOnSave(HOME_WEIGHTS, measurement("n", "2026-09-24", { weightKg: 75 }), profile)).toBeNull();
  });

  it("una medición sin peso → no cambia", () => {
    expect(weightChangeOnSave(HOME_WEIGHTS, measurement("n", "2026-09-24", { waist: 84 }), profile)).toBeNull();
  });

  it("editar la más reciente con otro peso → el nuevo peso", () => {
    const edited = { ...HOME_WEIGHTS[6], values: { weightKg: 74.6 }, savedAt: `${TODAY}T20:00:00.000Z` };
    expect(weightChangeOnSave(HOME_WEIGHTS, edited, profile)).toBe(74.6);
  });

  it("editar la más reciente quitándole el peso → no cambia (como borrar)", () => {
    const edited = { ...HOME_WEIGHTS[6], values: { waist: 84 }, savedAt: `${TODAY}T20:00:00.000Z` };
    expect(weightChangeOnSave(HOME_WEIGHTS, edited, profile)).toBeNull();
  });

  it("el mismo día que la última, guardada después → manda la nueva", () => {
    const later = measurement("n", TODAY, { weightKg: 75.4 }, "nutritionist", `${TODAY}T17:00:00.000Z`);
    expect(weightChangeOnSave(HOME_WEIGHTS, later, profile)).toBe(75.4);
  });

  it("la primera medición con peso, con un perfil sin peso", () => {
    const noWeight: UserProfile = { ...manuel, weightKg: undefined };
    expect(weightChangeOnSave([], measurement("n", TODAY, { weightKg: 75 }), noWeight)).toBe(75);
  });

  it("con objetivos de la nutricionista sin datos corporales compara con weightKg", () => {
    const m = { ...manuel, weightKg: 76 };
    expect(weightChangeOnSave([], measurement("n", TODAY, { weightKg: 76 }), m)).toBeNull();
    expect(weightChangeOnSave([], measurement("n", TODAY, { weightKg: 75 }), m)).toBe(75);
  });
});

describe("R9: profileWeightPatch escribe el peso donde lo lee cada tipo de perfil", () => {
  it("objetivos calculados (con datos corporales): solo body.weightKg", () => {
    expect(profileWeightPatch(lucia, 60.5)).toEqual({ body: { ...lucia.body, weightKg: 60.5 } });
  });

  it("de la nutricionista sin datos corporales: weightKg", () => {
    expect(profileWeightPatch(manuel, 74.8)).toEqual({ weightKg: 74.8 });
  });

  it("de la nutricionista con datos corporales: los dos, como hoy «Datos corporales»", () => {
    const withBody: UserProfile = { ...manuel, body: { ...lucia.body!, weightKg: 76 } };
    expect(profileWeightPatch(withBody, 74.8)).toEqual({ body: { ...lucia.body, weightKg: 74.8 }, weightKg: 74.8 });
  });
});

// ---------------------------------------------------------------------------

describe("R14: suma de pliegues", () => {
  it("con los seis pliegues, la suma del informe", () => {
    expect(skinfoldSum(NUTRI_MAY.values)).toBe(SKIN_SUMS.may);
    expect(skinfoldSum(NUTRI_JUNE.values)).toBe(SKIN_SUMS.june);
    expect(skinfoldSum(NUTRI_JULY.values)).toBe(SKIN_SUMS.july);
  });

  it("con cinco, no hay suma", () => {
    const { skinCalf, ...five } = NUTRI_JULY.values;
    void skinCalf;
    expect(skinfoldSum(five)).toBeUndefined();
  });

  it("redondeada a una décima (sin restos de coma flotante)", () => {
    expect(
      skinfoldSum({ skinBiceps: 1.1, skinTriceps: 2.2, skinAbdominal: 3.3, skinSuprailiac: 1, skinQuadriceps: 1, skinCalf: 1 }),
    ).toBe(9.6);
  });
});

describe("R13: serie de una métrica", () => {
  it("cintura de las tres tomas, de la más antigua a la más reciente", () => {
    expect(metricSeries([NUTRI_JULY, NUTRI_MAY, NUTRI_JUNE], "waist")).toEqual([
      { id: "nutri-may", date: "2026-05-05", value: 99.4, source: "nutritionist" },
      { id: "nutri-jun", date: "2026-06-19", value: 93.0, source: "nutritionist" },
      { id: "nutri-jul", date: "2026-07-31", value: 84.5, source: "nutritionist" },
    ]);
  });

  it("solo las mediciones que tienen esa métrica", () => {
    expect(metricSeries([...NUTRI_REPORTS, ...HOME_WEIGHTS], "waist")).toHaveLength(3);
    expect(metricSeries([...NUTRI_REPORTS, ...HOME_WEIGHTS], "weightKg")).toHaveLength(10);
  });

  it("«skinSum» es la suma derivada de cada toma completa", () => {
    expect(metricSeries(NUTRI_REPORTS, "skinSum").map((p) => p.value)).toEqual([87, 74, 56]);
  });
});

describe("R15: periodo de la gráfica", () => {
  const points = [...NUTRI_REPORTS, ...HOME_WEIGHTS].flatMap((m) => metricSeries([m], "weightKg"));

  it("«1M»: los últimos 30 días, hoy incluido (desde el 23/08 si hoy es 22/09)", () => {
    const dates = filterByRange(points, "1M", TODAY).map((p) => p.date);
    expect(dates[0]).toBe("2026-08-23");
    expect(dates).not.toContain("2026-07-31");
  });

  it("«3M» (90 días) incluye la toma del 31/07 pero no la del 19/06", () => {
    const dates = filterByRange(points, "3M", TODAY).map((p) => p.date);
    expect(dates).toContain("2026-07-31");
    expect(dates).not.toContain("2026-06-19");
  });

  it("«6M» (180 días) y «all» incluyen la del 5/05", () => {
    expect(filterByRange(points, "6M", TODAY).map((p) => p.date)).toContain("2026-05-05");
    expect(filterByRange(points, "all", TODAY)).toHaveLength(points.length);
  });
});

// ---------------------------------------------------------------------------

describe("R16 (Could): avisos de valores raros, sin bloquear", () => {
  it("un lado bilateral más de un 30 % distinto del otro", () => {
    expect(unusualValues({ legL: 49.6, legR: 9.7 })).toEqual({
      legR: "Muy distinto de la izquierda (49,6). ¿Es correcto? Se guarda igual.",
    });
  });

  it("más de un 30 % distinto de la medición anterior de esa métrica", () => {
    expect(unusualValues({ weightKg: 7.6 }, NUTRI_JULY.values)).toEqual({
      weightKg: "Muy distinto de la anterior (76). ¿Es correcto? Se guarda igual.",
    });
  });

  it("las variaciones normales no avisan (cintura −15 % desde mayo, bíceps iguales)", () => {
    expect(unusualValues({ waist: 84.5, bicepsL: 30.1, bicepsR: 30.1 }, { waist: NUTRI_MAY.values.waist })).toEqual({});
  });
});

describe("Formato (contrato de UI)", () => {
  it("fechas del historial: «22 sep 2026»", () => {
    expect(formatMeasurementDate("2026-09-22")).toBe("22 sep 2026");
    expect(formatMeasurementDate("2026-05-05")).toBe("5 may 2026");
  });

  it("números con coma decimal y sin ceros de más", () => {
    expect(formatDecimal(74.8)).toBe("74,8");
    expect(formatDecimal(76)).toBe("76");
    expect(formatDecimal(74.95)).toBe("74,95");
  });
});
