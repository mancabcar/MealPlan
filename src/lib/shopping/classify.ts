// Pasillos y básicos (docs/pm/lista-compra › R11, R12). Listas fijas en código (spec › Assumptions).
import { normalizeKey } from "./parse";

export type Aisle = "Frutas y verduras" | "Carne y pescado" | "Lácteos y huevos" | "Despensa y conservas" | "Otros";

/** Los cinco pasillos, en el orden de la lista. */
export const AISLES: Aisle[] = ["Frutas y verduras", "Carne y pescado", "Lácteos y huevos", "Despensa y conservas", "Otros"];

// Palabras clave por pasillo. Gana la coincidencia más larga; a igualdad, la que aparece antes en el
// nombre (el núcleo va delante en español: "caldo de pollo" es caldo, no pollo).
const AISLE_KEYWORDS: Record<Exclude<Aisle, "Otros">, string[]> = {
  // Las hierbas frescas se compran en fruta y verdura, no son básicos (tech.md › Spec feedback 5)
  "Frutas y verduras": [
    "aguacate", "ajo", "albahaca", "apio", "berenjena", "brócoli", "calabacín", "calabaza", "cebolla", "cebollino",
    "champiñón", "eneldo", "espárrago", "espinaca", "frutos rojos", "fresa", "guisante", "hojas verdes", "jengibre",
    "judía verde", "lechuga", "lima", "limón", "manzana", "naranja", "patata", "pepino", "perejil", "pimiento",
    "plátano", "puerro", "rúcula", "seta", "tomate", "zanahoria", "cilantro", "menta", "pera", "fruta", "verdura",
  ],
  "Carne y pescado": [
    "pollo", "pavo", "ternera", "cerdo", "carne", "pechuga", "solomillo", "jamón", "fiambre", "bacalao", "merluza",
    "salmón", "gamba", "langostino", "pescado", "atún fresco", "sardina", "lubina", "dorada", "chorizo",
  ],
  "Lácteos y huevos": [
    "huevo", "claras de huevo", "leche", "yogur", "queso", "quesito", "mozzarella", "mantequilla", "kéfir", "nata", "tofu",
  ],
  "Despensa y conservas": [
    "arroz", "garbanzo", "lenteja", "alubia", "atún", "pasta", "fideos", "quinoa", "harina", "avena", "pan",
    "panecillo", "tortilla de trigo", "tortilla de maíz", "tortilla integral", "aceite", "salsa de soja", "miel",
    "mostaza", "sésamo", "semillas", "maíz", "proteína", "leche de coco",
    // "caldo" pierde contra "verduras"/"pescado" por longitud: los caldos van explícitos
    "caldo", "caldo de pollo", "caldo de pescado", "caldo de verduras",
"tomate triturado", "nueces",
    "almendra", "dátil", "chocolate", "cacao", "azúcar", "levadura",
  ],
};

// Especias, condimentos y básicos: plegados y fuera de los recuentos (R12). `aceite` NO es básico.
const BASICS = [
  "sal", "pimienta", "orégano", "vinagre", "agua", "comino", "pimentón", "canela", "caldo en pastilla", "laurel",
  "romero", "tomillo", "curry", "cúrcuma", "ajo en polvo", "nuez moscada", "hielo", "especias",
];

interface Rule {
  kw: string;
  aisle: Aisle;
  basic: boolean;
}

const RULES: Rule[] = [
  ...Object.entries(AISLE_KEYWORDS).flatMap(([aisle, kws]) => kws.map((k) => ({ kw: normalizeKey(k), aisle: aisle as Aisle, basic: false }))),
  ...BASICS.map((k) => ({ kw: normalizeKey(k), aisle: "Despensa y conservas" as Aisle, basic: true })),
];

/** Pasillo y si es un básico, a partir de la clave normalizada del ingrediente. */
export function classify(key: string): { aisle: Aisle; basic: boolean } {
  const padded = ` ${key} `;
  let best: { rule: Rule; pos: number } | null = null;
  for (const rule of RULES) {
    const pos = padded.indexOf(` ${rule.kw} `);
    if (pos === -1) continue;
    if (!best || rule.kw.length > best.rule.kw.length || (rule.kw.length === best.rule.kw.length && pos < best.pos)) {
      best = { rule, pos };
    }
  }
  return best ? { aisle: best.rule.aisle, basic: best.rule.basic } : { aisle: "Otros", basic: false };
}
