// Productos de marca (docs/pm/13-base-alimentos/tech.md › APIs): proxy a Search-a-licious de Open Food Facts.
// Va por el servidor para fijar el User-Agent que pide OFF. Los GET no se cachean por defecto (Next 16).
import { NextResponse } from "next/server";
import { plainQuery, type BrandProduct } from "@/lib/foods";

const OFF_SEARCH = "https://search.openfoodfacts.org/search";
const USER_AGENT = "MealPlan/0.1 (+https://github.com/mancabcar/MealPlan)";
const TIMEOUT_MS = 8_000;
/** R4: como mucho 5 productos; se piden más porque los que no traen macros se descartan. */
const MAX_PRODUCTS = 5;
const PAGE_SIZE = 20;
const FIELDS = "code,product_name,product_name_es,brands,nutriments,serving_quantity,serving_quantity_unit";

interface Hit {
  code?: unknown;
  product_name?: unknown;
  product_name_es?: unknown;
  brands?: unknown;
  nutriments?: Record<string, unknown>;
  serving_quantity?: unknown;
  serving_quantity_unit?: unknown;
}

const text = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);
// OFF guarda floats de 32 bits (4.3000001907349): se quita el ruido
const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined;
};

/** null si falta el código, el nombre o alguno de los cuatro macros por 100 g (R4). */
function toProduct(hit: Hit): BrandProduct | null {
  const code = text(hit.code);
  const name = text(hit.product_name_es) ?? text(hit.product_name);
  const n = hit.nutriments ?? {};
  const kcal = num(n["energy-kcal_100g"]);
  const protein = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  if (!code || !name || kcal === undefined || protein === undefined || carbs === undefined || fat === undefined) {
    return null;
  }
  const brand = Array.isArray(hit.brands) ? text(hit.brands[0]) : undefined;
  const serving = num(hit.serving_quantity);
  // Edge cases: una ración en ml o sin unidad no cuenta como unidad
  const servingGrams = hit.serving_quantity_unit === "g" && serving ? serving : undefined;
  return {
    code,
    name,
    ...(brand && { brand }),
    kcal,
    protein,
    carbs,
    fat,
    ...(servingGrams && { servingGrams }),
  };
}

const unavailable = () => NextResponse.json({ error: "unavailable" }, { status: 502 });

export async function GET(request: Request) {
  const q = plainQuery(new URL(request.url).searchParams.get("q") ?? "");
  if (q.length < 2) return NextResponse.json({ error: "bad_query" }, { status: 400 });

  const url = new URL(OFF_SEARCH);
  // Solo productos vendidos en España; langs=es busca en los nombres en español
  url.searchParams.set("q", `${q} countries_tags:"en:spain"`);
  url.searchParams.set("langs", "es");
  url.searchParams.set("page_size", String(PAGE_SIZE));
  url.searchParams.set("fields", FIELDS);

  // AbortController + setTimeout (no AbortSignal.timeout): el test usa timers falsos
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  let body: unknown;
  try {
    res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: controller.signal });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After"));
      return NextResponse.json(
        { error: "rate_limited", retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 60 },
        { status: 429 },
      );
    }
    if (!res.ok) return unavailable();
    body = await res.json();
  } catch {
    // Sin red, timeout o JSON ilegible
    return unavailable();
  } finally {
    clearTimeout(timer);
  }

  const hits = (body as { hits?: unknown } | null)?.hits;
  if (!Array.isArray(hits)) return unavailable();

  const products: BrandProduct[] = [];
  for (const hit of hits) {
    const p = hit && typeof hit === "object" ? toProduct(hit as Hit) : null;
    if (p) products.push(p);
    if (products.length === MAX_PRODUCTS) break;
  }
  return NextResponse.json({ products });
}
