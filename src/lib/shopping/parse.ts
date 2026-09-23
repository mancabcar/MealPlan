// Parser de líneas de ingredientes (docs/pm/lista-compra › R3, R4 "Normalization rules").
// Puro y sin dependencias del framework: lo usan el agregador, el cruce con la Despensa y los tests.
import { normalize } from "@/lib/text";

export type Unit =
  | "g" | "kg" | "ml" | "l" | "cucharada" | "cucharadita" | "lata" | "bote" | "diente" | "rebanada"
  | "cazo" | "hoja" | "rama" | "loncha" | "pizca" | "taza" | "vaso" | "filete" | "puñado" | "sobre"; // null = recuento

export interface ParsedIngredient {
  raw: string;
  qty: number | null;
  unit: Unit | null;
  /** Visible: limpio, conserva mayúsculas y tildes ("garbanzos cocidos"). */
  name: string;
  /** Normalizado: sin tildes ni mayúsculas, sin tamaños, cada palabra en singular ("garbanzo cocido"). */
  key: string;
  /** Llevaba "(opcional)". */
  optional: boolean;
  /** false → no se entendió; se muestra con el texto original (R3). */
  parsed: boolean;
}

// Singular y plural de cada unidad. "unidad(es)" equivale a un recuento sin unidad.
const UNIT_WORDS: Record<string, Unit | null> = {
  g: "g", kg: "kg", ml: "ml", l: "l",
  unidad: null, unidades: null,
};
for (const u of [
  "cucharada", "cucharadita", "lata", "bote", "diente", "rebanada",
  "cazo", "hoja", "rama", "loncha", "pizca", "taza", "vaso", "filete", "puñado", "sobre",
] as const) {
  UNIT_WORDS[u] = u;
  UNIT_WORDS[u + "s"] = u;
}

const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75 };
// Los mixtos van primero ("1 1/2", "1½"): si no, el entero queda solo y la fracción pasa al nombre
const QTY_RE = /^(\d+\s+\d+\s*\/\s*\d+|\d+\s*[½¼¾]|\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?|[½¼¾])/;
const MIXED_RE = /^(\d+)\s*(\d+\s*\/\s*\d+|[½¼¾])$/;
const UNIT_RE = new RegExp(`^(${Object.keys(UNIT_WORDS).sort((a, b) => b.length - a.length).join("|")})(?=\\s|$)`, "i");
const SIZE_RE = /(^|\s)(pequeñ[oa]s?|grandes?|median[oa]s?)(?=\s|$)/gi;
const ZUMO_RE = /^zumo de\s+/i;

function parseQty(s: string): number {
  // "12/3" también encaja en MIXED_RE sin espacio: solo es mixto con glifo o con espacio
  const mixed = s.match(MIXED_RE);
  if (mixed && (mixed[2] in FRACTIONS || /\s/.test(s))) return Number(mixed[1]) + parseQty(mixed[2]);
  if (s in FRACTIONS) return FRACTIONS[s];
  if (s.includes("/")) {
    const [a, b] = s.split("/").map((x) => Number(x.trim()));
    return a / b;
  }
  return Number(s.replace(",", "."));
}

/** Reglas de nombre compartidas por el parser y `normalizeKey`. */
function cleanName(text: string): { name: string; optional: boolean } {
  const optional = /\(\s*opcional\s*\)/i.test(text);
  let s = text.replace(/\([^)]*\)/g, " ");
  // De las alternativas se queda la primera ("leche o bebida vegetal" → "leche")
  s = s.split(/\s+[ou]\s+/i)[0];
  // Notas finales
  s = s.replace(/\s+para\b.*$/i, "").replace(/\s*\bal gusto\s*$/i, "");
  s = s.replace(SIZE_RE, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/^de\s+/i, "");
  return { name: s.trim(), optional };
}

function stem(word: string): string {
  if (word === "de") return word;
  if (word.endsWith("ces")) return word.slice(0, -3) + "z";
  if (/[nrldzjs]es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  // Singulares simétricos a las reglas de plural, para que ambas formas den la misma clave:
  // "verde" ↔ "verdes" → "verd", "dulce" ↔ "dulces" → "dulz"
  if (word.endsWith("ce")) return word.slice(0, -2) + "z";
  if (/[nrldzjs]e$/.test(word)) return word.slice(0, -1);
  return word;
}

function keyOf(cleaned: string): string {
  return normalize(cleaned)
    .split(" ")
    .filter(Boolean)
    .map(stem)
    .join(" ");
}

/** Clave normalizada de un nombre (ingrediente o artículo de la Despensa). */
export function normalizeKey(name: string): string {
  return keyOf(cleanName(name).name);
}

/** Un solo ingrediente; null si no queda nombre. */
function parseSegment(raw: string, segment: string): ParsedIngredient | null {
  let s = segment.trim().replace(ZUMO_RE, "");
  let qty: number | null = null;
  let unit: Unit | null = null;
  const q = s.match(QTY_RE);
  if (q) {
    qty = parseQty(q[1]);
    s = s.slice(q[0].length).trimStart();
    const u = s.match(UNIT_RE);
    if (u) {
      unit = UNIT_WORDS[u[1].toLowerCase()];
      s = s.slice(u[0].length);
    }
  }
  const { name, optional } = cleanName(s);
  if (!name) return null;
  return { raw, qty, unit, name, key: keyOf(name), optional, parsed: true };
}

/** Una línea de receta → uno o más ingredientes. Nunca devuelve []. */
export function parseIngredientLine(line: string): ParsedIngredient[] {
  const raw = line;
  const fallback: ParsedIngredient = { raw, qty: null, unit: null, name: raw, key: keyOf(raw), optional: false, parsed: false };
  // Una línea con cantidad delante nunca se separa: evita romper nombres
  if (QTY_RE.test(line.trim().replace(ZUMO_RE, ""))) {
    const one = parseSegment(raw, line);
    return [one ?? fallback];
  }
  const items = line
    .replace(/\([^)]*\)/g, (m) => (/opcional/i.test(m) ? m : " "))
    .split(/,|\s+y\s+/i)
    .map((part) => parseSegment(raw, part))
    .filter((i): i is ParsedIngredient => i !== null);
  return items.length > 0 ? items : [fallback];
}
