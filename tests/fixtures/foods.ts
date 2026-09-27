// Datos de "Base de datos de alimentos" (docs/pm/13-base-alimentos/spec.md › Acceptance criteria).
// Compartidos por tests/unit/foods*.test.ts, tests/unit/diary.test.ts y tests/e2e/food.spec.ts.
//
// Las marcas y productos de OFF son inventados (valores realistas, no copiados de OFF): los datos reales cambian.
// La forma de SAL_HIT es la de Search-a-licious (https://search.openfoodfacts.org/search), comprobada el 2026-09-27:
// `hits[]`, `brands` como lista, `nutriments.<campo>_100g`, `product_name` / `product_name_es`.
import type { BrandProduct, LocalFood } from "@/lib/foods";

function food(id: string, name: string, kcal: number, protein: number, carbs: number, fat: number, unitGrams?: number): LocalFood {
  return { id, name, kcal, protein, carbs, fat, source: "CIQUAL", sourceCode: `t-${id}`, ...(unitGrams && { unitGrams }) };
}

/** El caso de R6: 130 kcal, 2,7 P, 28 C, 0,3 G por 100 g → 150 g = 195 / 4 / 42 / 0,5. */
export const ARROZ_COCIDO = food("arroz-blanco-cocido", "Arroz blanco, cocido", 130, 2.7, 28, 0.3);
export const ARROZ_CRUDO = food("arroz-blanco-crudo", "Arroz blanco, crudo", 354, 7.1, 78, 0.7);
export const ARROZ_BASMATI = food("arroz-basmati-crudo", "Arroz basmati, crudo", 351, 8, 77, 0.9);
export const ARROZ_INTEGRAL = food("arroz-integral-crudo", "Arroz integral, crudo", 350, 7.5, 73, 2.7);
export const PLATANO = food("platano", "Plátano", 90, 1.1, 20, 0.3, 120);
/** Con unidad: 2 ud = 120 g. */
export const HUEVO = food("huevo", "Huevo", 140, 12.5, 0.7, 9.8, 60);
export const CLARA = food("clara-huevo", "Clara de huevo", 48, 10.5, 0.7, 0.2);
export const PAN_CENTENO = food("pan-centeno", "Pan de centeno", 240, 7.5, 45, 1.7, 30);
export const POLLO = food("pollo-pechuga", "Pollo, pechuga, cruda", 110, 23, 0, 1.5);
export const PASTA_CRUDA = food("pasta-cruda", "Pasta, cruda", 355, 12, 72, 1.5);
export const PASTA_COCIDA = food("pasta-cocida", "Pasta, cocida", 150, 5.3, 30, 0.8);
export const PASTA_INTEGRAL = food("pasta-integral-cruda", "Pasta integral, cruda", 340, 13, 64, 2.5);
/** Contiene "arroz" pero no empieza por "arroz": R2 ordena primero los que empiezan por lo escrito. */
export const TORTITAS = food("tortitas-arroz", "Tortitas de arroz", 385, 8, 81, 2.8, 8);
export const HARINA_ARROZ = food("harina-arroz", "Harina de arroz", 360, 6, 80, 1.4);
export const LECHE_ARROZ = food("bebida-arroz", "Bebida de arroz", 50, 0.3, 10, 1);
export const ARROZ_SALVAJE = food("arroz-salvaje-crudo", "Arroz salvaje, crudo", 357, 14.7, 75, 1.1);
export const ARROZ_JAZMIN = food("arroz-jazmin-crudo", "Arroz jazmín, crudo", 356, 7, 79, 0.6);

/** Tabla de fixture para la búsqueda (R2): 9 contienen "arroz", 6 empiezan por "Arroz". */
export const FOODS_FIXTURE: LocalFood[] = [
  TORTITAS,
  HARINA_ARROZ,
  ARROZ_CRUDO,
  ARROZ_COCIDO,
  PLATANO,
  HUEVO,
  CLARA,
  PAN_CENTENO,
  POLLO,
  LECHE_ARROZ,
  ARROZ_BASMATI,
  ARROZ_INTEGRAL,
  PASTA_CRUDA,
  PASTA_COCIDA,
  PASTA_INTEGRAL,
  ARROZ_SALVAJE,
  ARROZ_JAZMIN,
];

// ---------------------------------------------------------------------------
// Open Food Facts (Search-a-licious)
// ---------------------------------------------------------------------------

export interface SalHit {
  code: string;
  product_name?: string;
  product_name_es?: string;
  brands?: string[];
  nutriments?: Record<string, number>;
  serving_quantity?: number | string;
  serving_quantity_unit?: string;
}

export function salHit(
  code: string,
  name: string,
  brand: string | null,
  n: { kcal?: number; protein?: number; carbs?: number; fat?: number },
  extra: Partial<SalHit> = {},
): SalHit {
  const nutriments: Record<string, number> = {};
  if (n.kcal !== undefined) nutriments["energy-kcal_100g"] = n.kcal;
  if (n.protein !== undefined) nutriments.proteins_100g = n.protein;
  if (n.carbs !== undefined) nutriments.carbohydrates_100g = n.carbs;
  if (n.fat !== undefined) nutriments.fat_100g = n.fat;
  return { code, product_name: name, ...(brand && { brands: [brand] }), nutriments, ...extra };
}

/** Yogur de marca inventada, con ración en gramos (R7: tiene unidades). */
export const YOGUR_GRIEGO_HIT = salHit(
  "8400000000011",
  "Greek yoghurt",
  "Lácteos Sierra Alta",
  { kcal: 122, protein: 3.6, carbs: 4.1, fat: 10.2 },
  { product_name_es: "Yogur griego natural", serving_quantity: 125, serving_quantity_unit: "g" },
);
export const YOGUR_LIGERO_HIT = salHit("8400000000028", "Yogur griego ligero", "Valle Blanco", {
  kcal: 78,
  protein: 5.2,
  carbs: 5,
  fat: 4,
});
/** Sin proteína por 100 g: R4 lo oculta. */
export const YOGUR_SIN_PROTEINA_HIT = salHit("8400000000035", "Yogur griego con miel", "Colmena Real", {
  kcal: 150,
  carbs: 14,
  fat: 8.5,
});
/** Sin marca: se guarda solo el nombre (Edge cases). Ración en ml: solo gramos (Edge cases). */
export const YOGUR_SIN_MARCA_HIT = salHit(
  "8400000000042",
  "Yogur griego de pueblo",
  null,
  { kcal: 118, protein: 3.4, carbs: 4.5, fat: 9.6 },
  { serving_quantity: 125, serving_quantity_unit: "ml" },
);

export function manyHits(n: number): SalHit[] {
  return Array.from({ length: n }, (_, i) =>
    salHit(`84000000010${String(i).padStart(2, "0")}`, `Yogur griego ${i + 1}`, `Marca ${i + 1}`, {
      kcal: 100 + i,
      protein: 4,
      carbs: 5,
      fat: 6,
    }),
  );
}

// ---------------------------------------------------------------------------
// Respuestas normalizadas de GET /api/foods/search (para el e2e, que intercepta la ruta)
// ---------------------------------------------------------------------------

export const YOGUR_GRIEGO: BrandProduct = {
  code: "8400000000011",
  name: "Yogur griego natural",
  brand: "Lácteos Sierra Alta",
  kcal: 122,
  protein: 3.6,
  carbs: 4.1,
  fat: 10.2,
  servingGrams: 125,
};
export const YOGUR_LIGERO: BrandProduct = {
  code: "8400000000028",
  name: "Yogur griego ligero",
  brand: "Valle Blanco",
  kcal: 78,
  protein: 5.2,
  carbs: 5,
  fat: 4,
};
