// Genera src/data/foods.json (docs/pm/13-base-alimentos/tech.md › Components & files) a partir de la lista curada
// scripts/foods-list.json y de la tabla CIQUAL 2020 en XML, que no se commitea:
//
//   1. Descarga XML_2020_07_07.zip de https://ciqual.anses.fr (enlace en data.gouv.fr) y descomprímelo.
//   2. node scripts/build-foods.mjs <carpeta con alim_*.xml y compo_*.xml>
//
// Sin dependencias. Los alimentos USDA llevan sus valores copiados en la lista (con su fdcId); los de CIQUAL se leen
// del XML por su código. Si CIQUAL no trae la energía del Reglamento UE 1169/2011 (campo 328), se calcula con los
// mismos factores del reglamento: 4·P + 4·C + 9·G + 2·fibra + 7·alcohol + 2,4·polioles + 3·ácidos orgánicos.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIST = join(ROOT, "scripts", "foods-list.json");
const OUT = join(ROOT, "src", "data", "foods.json");

// Códigos de constituyente de CIQUAL (const_2020_07_07.xml)
const C = {
  kcal: "328", // Energía, Reglamento UE 1169/2011 (kcal/100 g)
  protein: "25000", // Proteínas, N × factor de Jones
  carbs: "31000", // Glúcidos
  fat: "40000", // Lípidos
  fibre: "34100",
  polyols: "34000",
  alcohol: "60000",
  organicAcids: "65000",
};
const WANTED = new Set(Object.values(C));

const dir = process.argv[2];
if (!dir) {
  console.error("Uso: node scripts/build-foods.mjs <carpeta de CIQUAL 2020 en XML>");
  process.exit(1);
}

const decoder = new TextDecoder("windows-1252");
// alim_ + fecha: el zip trae también alim_grp_*.xml (grupos de alimentos), que no sirve aquí
const readXml = (prefix) => {
  const file = readdirSync(dir).find((f) => f.startsWith(prefix) && /^\d.*\.xml$/.test(f.slice(prefix.length)));
  if (!file) throw new Error(`No encuentro ${prefix}<fecha>.xml en ${dir}`);
  return decoder.decode(readFileSync(join(dir, file)));
};

/** "59,7" → 59.7 · "traces" y "< 0,5" (por debajo del límite de cuantificación) → 0 · "-" o vacío → undefined. */
function parseValue(raw) {
  const t = raw.trim();
  if (t === "" || t === "-") return undefined;
  if (t === "traces" || /^<\s*[\d,]+$/.test(t)) return 0;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n)) throw new Error(`Valor de CIQUAL ilegible: «${raw}»`);
  return n;
}

// alim_code → nombre en francés (para comprobar que el código de la lista es el alimento que dice)
const names = new Map();
for (const m of readXml("alim_").matchAll(/<alim_code>\s*(\d+)\s*<\/alim_code>\s*<alim_nom_fr>\s*(.*?)\s*<\/alim_nom_fr>/gs)) {
  names.set(m[1], m[2]);
}

// alim_code → { const_code → valor }
const compo = new Map();
for (const m of readXml("compo_").matchAll(
  /<alim_code>\s*(\d+)\s*<\/alim_code>\s*<const_code>\s*(\d+)\s*<\/const_code>\s*<teneur>(.*?)<\/teneur>/gs,
)) {
  if (!WANTED.has(m[2])) continue;
  if (!compo.has(m[1])) compo.set(m[1], {});
  compo.get(m[1])[m[2]] = parseValue(m[3]);
}

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;

function fromCiqual(item) {
  const code = item.sourceCode;
  if (!names.has(code)) throw new Error(`${item.id}: el código CIQUAL ${code} no existe`);
  if (names.get(code) !== item.sourceName) {
    throw new Error(`${item.id}: CIQUAL ${code} es «${names.get(code)}», no «${item.sourceName}»`);
  }
  const v = compo.get(code) ?? {};
  for (const k of ["protein", "carbs", "fat"]) {
    if (v[C[k]] === undefined) throw new Error(`${item.id}: CIQUAL ${code} no trae ${k}`);
  }
  const protein = v[C.protein];
  const carbs = v[C.carbs];
  const fat = v[C.fat];
  const kcal =
    v[C.kcal] ??
    round(
      4 * protein +
        4 * carbs +
        9 * fat +
        2 * (v[C.fibre] ?? 0) +
        7 * (v[C.alcohol] ?? 0) +
        2.4 * (v[C.polyols] ?? 0) +
        3 * (v[C.organicAcids] ?? 0),
      1,
    );
  // Fibra (#23): "-" (no determinada) se queda sin dato; "traces" y "< x" ya son 0 (parseValue)
  const fiber = v[C.fibre];
  return { kcal, protein, carbs, fat, ...(fiber !== undefined && { fiber }) };
}

const list = JSON.parse(readFileSync(LIST, "utf8"));
const foods = list.map((item) => {
  const values =
    item.source === "CIQUAL"
      ? fromCiqual(item)
      : { kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat, ...(item.fiber !== undefined && { fiber: item.fiber }) };
  return {
    id: item.id,
    name: item.name,
    ...values,
    source: item.source,
    sourceCode: item.sourceCode,
    ...(item.unitGrams !== undefined && { unitGrams: item.unitGrams }),
  };
});

// Un alimento por línea: los cambios de valores se leen bien en un diff
writeFileSync(OUT, `[\n${foods.map((f) => `  ${JSON.stringify(f)}`).join(",\n")}\n]\n`);
console.log(`${foods.length} alimentos → ${OUT}`);
