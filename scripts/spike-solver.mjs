// Spike de #15 (docs/pm/15-autocompletar-semana-ia/brief.md › What to prototype). Desechable: no lo usa la app.
// Genera semanas con el recetario real y el perfil vigente para juzgar si los días apetecen, no solo si cuadran.
// Uso: node scripts/spike-solver.mjs [salida.md]
import { readFileSync, writeFileSync } from "node:fs";

const { recipes } = JSON.parse(readFileSync(new URL("../src/data/recipes.json", import.meta.url), "utf8"));

const PROFILE = { kcal: 2000, protein: { min: 130, max: 160 }, carbs: 230, fat: 69, tolerance: 10 };
const MEALS = ["Desayuno", "Media mañana", "Comida", "Pre-entreno", "Cena"];
const SLOT_TAG = { Desayuno: "desayuno", "Media mañana": "snack", Comida: "comida", "Pre-entreno": "snack", Cena: "cena" };
const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const NUTRI = "plan nutricionista";
const SERVINGS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const isNutri = (r) => r.tags.includes(NUTRI);
const fits = (r, meal) => r.tags.map((t) => t.toLowerCase()).includes(SLOT_TAG[meal]);
const byId = new Map(recipes.map((r) => [r.id, r]));

// Misma regla que macroStatus (src/lib/planMacros.ts)
function status(v, target) {
  v = Math.round(v);
  if (typeof target !== "number") return v < target.min ? "below" : v > target.max ? "above" : "within";
  if (100 * v < Math.round((100 - PROFILE.tolerance) * target)) return "below";
  if (100 * v > Math.round((100 + PROFILE.tolerance) * target)) return "above";
  return "within";
}

function totals(slots) {
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const s of slots) for (const k in t) t[k] += byId.get(s.recipeId)[k] * s.servings;
  return t;
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const outside = (v, min, max) => (v < min ? min - v : v > max ? v - max : 0);

function dayCost(slots, uses) {
  const t = totals(slots);
  let c = 0;
  c += 4 * outside(t.calories, 1800, 2200) / 2000 + Math.abs(t.calories - 2000) / 2000;
  c += 4 * outside(t.protein, 130, 160) / 145;
  c += 0.4 * Math.abs(t.carbs - PROFILE.carbs) / PROFILE.carbs + 0.4 * Math.abs(t.fat - PROFILE.fat) / PROFILE.fat;
  for (const s of slots) {
    if (s.fixed) continue;
    const r = byId.get(s.recipeId);
    c += 0.12 * (uses.get(r.id) ?? 0); // variedad: penaliza repetir en la semana
    c -= isNutri(r) ? 0.04 : 0; // preferencia nutricionista: prioriza, no obliga
    c += 0.03 * Math.abs(s.servings - 1); // mejor raciones enteras
  }
  return c;
}

function pick(cands, uses, rand) {
  const w = cands.map((r) => (isNutri(r) ? 2.5 : 1) / (1 + 2 * (uses.get(r.id) ?? 0)));
  let x = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cands.length; i++) if ((x -= w[i]) <= 0) return cands[i];
  return cands.at(-1);
}

function fillDay(fixed, uses, rand, { withServings }) {
  let best = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const taken = new Set(fixed.map((s) => s.recipeId));
    const slots = MEALS.map((meal) => {
      const f = fixed.find((s) => s.meal === meal);
      if (f) return { ...f, fixed: true };
      const cands = recipes.filter((r) => fits(r, meal) && !taken.has(r.id));
      const r = pick(cands, uses, rand);
      taken.add(r.id);
      return { meal, recipeId: r.id, servings: 1 };
    });
    if (withServings) {
      for (let pass = 0; pass < 3; pass++)
        for (const s of slots) {
          if (s.fixed) continue;
          let bestS = s.servings, bestC = Infinity;
          for (const v of SERVINGS) {
            s.servings = v;
            const c = dayCost(slots, uses);
            if (c < bestC) [bestC, bestS] = [c, v];
          }
          s.servings = bestS;
        }
    }
    const c = dayCost(slots, uses);
    if (!best || c < best.cost) best = { slots: slots.map((s) => ({ ...s })), cost: c };
  }
  return best.slots;
}

function fillWeek(seed, partial = {}, opts = { withServings: true }) {
  const rand = mulberry32(seed);
  const uses = new Map();
  // Lo ya asignado cuenta para la variedad: que el relleno no repita la receta que el usuario puso
  for (const s of Object.values(partial).flat()) uses.set(s.recipeId, (uses.get(s.recipeId) ?? 0) + 1);
  return DAYS.map((day) => {
    const slots = fillDay(partial[day] ?? [], uses, rand, opts);
    for (const s of slots) if (!s.fixed) uses.set(s.recipeId, (uses.get(s.recipeId) ?? 0) + 1);
    return { day, slots };
  });
}

const find = (name) => recipes.find((r) => r.name.startsWith(name)).id;
// Días a medias: lo que ya estaba asignado a mano (no se toca, 1 ración)
const PARTIAL = {
  Lun: [{ meal: "Comida", recipeId: find("Lentejas estofadas"), servings: 1 }],
  Mié: [{ meal: "Cena", recipeId: find("Fajitas de pollo"), servings: 1 }],
  Sáb: [
    { meal: "Desayuno", recipeId: find("Bol de avena"), servings: 1 },
    { meal: "Comida", recipeId: find("Chili con carne"), servings: 1 },
  ],
};

const WEEKS = [
  { title: "Semana 1 — desde cero", week: fillWeek(1) },
  { title: "Semana 2 — desde cero", week: fillWeek(2) },
  { title: "Semana 3 — días a medias (Lun comida, Mié cena, Sáb desayuno+comida ya puestos)", week: fillWeek(3, PARTIAL) },
  { title: "Semana 4 — desde cero", week: fillWeek(4) },
];

const fmtS = (s) => (s === 1 ? "" : ` ×${String(s).replace(".", ",")}`);
const mark = (st) => (st === "within" ? "✓" : st === "below" ? "↓" : "↑");

function stats(week) {
  const days = week.map(({ slots }) => {
    const t = totals(slots);
    return { ok: status(t.calories, PROFILE.kcal) === "within" && status(t.protein, PROFILE.protein) === "within", t };
  });
  const filled = week.flatMap((d) => d.slots.filter((s) => !s.fixed));
  const counts = new Map();
  for (const s of filled) counts.set(s.recipeId, (counts.get(s.recipeId) ?? 0) + 1);
  return {
    okDays: days.filter((d) => d.ok).length,
    nutriPct: Math.round((100 * filled.filter((s) => isNutri(byId.get(s.recipeId))).length) / filled.length),
    distinct: counts.size,
    filled: filled.length,
    maxRepeat: Math.max(...counts.values()),
    notOne: filled.filter((s) => s.servings !== 1).length,
  };
}

let md = `# Spike del solver (#15)\n\nPerfil: 2000 kcal ±10 %, proteína 130–160 g, HC 230 g, grasa 69 g · 5 tomas · sin alergias · omnívoro.\n` +
  `Raciones entre 0,5 y 2. ✓ dentro · ↓ por debajo · ↑ por encima (HC y grasa ±10 %, solo informativo). 📌 = ya estaba puesta. ★ = plan nutricionista.\n`;
for (const { title, week } of WEEKS) {
  const st = stats(week);
  md += `\n## ${title}\n\nCumplen kcal+prot: **${st.okDays}/7** · recetas ★: ${st.nutriPct} % · distintas: ${st.distinct}/${st.filled} · máx. repeticiones: ${st.maxRepeat} · raciones ≠ 1: ${st.notOne}\n\n`;
  md += `| Día | ${MEALS.join(" | ")} | kcal | P | HC | G |\n|---|${MEALS.map(() => "---").join("|")}|---|---|---|---|\n`;
  for (const { day, slots } of week) {
    const t = totals(slots);
    const cells = slots.map((s) => `${s.fixed ? "📌 " : ""}${isNutri(byId.get(s.recipeId)) ? "★ " : ""}${byId.get(s.recipeId).name}${fmtS(s.servings)}`);
    md += `| ${day} | ${cells.join(" | ")} | ${Math.round(t.calories)} ${mark(status(t.calories, PROFILE.kcal))} | ${Math.round(t.protein)} ${mark(status(t.protein, PROFILE.protein))} | ${Math.round(t.carbs)} ${mark(status(t.carbs, PROFILE.carbs))} | ${Math.round(t.fat)} ${mark(status(t.fat, PROFILE.fat))} |\n`;
  }
}

// Control: lo mismo sin ajustar raciones (todo a 1), para ver cuánto aportan
const control = [1, 2, 4].map((seed) => stats(fillWeek(seed, {}, { withServings: false })).okDays);
md += `\n## Control sin raciones (todo a 1)\n\nDías que cumplen en las semanas 1, 2 y 4 con las mismas semillas: ${control.join(", ")} de 7.\n`;

const out = process.argv[2];
if (out) writeFileSync(out, md);
else console.log(md);
