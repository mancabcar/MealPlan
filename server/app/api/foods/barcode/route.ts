// Producto por código de barras (docs/pm/14-escaner-codigo-barras/tech.md › APIs): proxy al endpoint de producto
// de Open Food Facts (distinto del de búsqueda por texto de #13: aquí `brands` es texto, no lista).
// Va por el servidor para fijar el User-Agent que pide OFF. Los GET no se cachean por defecto (Next 16).
// Movida aquí desde src/app/api/foods/barcode/route.ts (issue #69), mismo motivo que foods/search.
import { NextResponse } from "next/server";
import type { BrandProduct } from "../../../../../src/lib/foods";
import { preflight, withCors } from "../../../../lib/cors";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

const USER_AGENT = "MealPlan/0.1 (+https://github.com/mancabcar/MealPlan)";
const TIMEOUT_MS = 8_000;
const FIELDS = "code,product_name,product_name_es,brands,nutriments,serving_quantity,serving_quantity_unit";
/** EAN-8, UPC-A (12), EAN-13, GTIN-14: solo dígitos, longitud típica de código de barras. */
const CODE_RE = /^\d{8,14}$/;

interface V2Product {
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

/** null si falta el código, el nombre o alguno de los cuatro macros por 100 g (mismo criterio que R4 de #13). */
function toProduct(product: V2Product): BrandProduct | null {
  const code = text(product.code);
  const name = text(product.product_name_es) ?? text(product.product_name);
  const n = product.nutriments ?? {};
  const kcal = num(n["energy-kcal_100g"]);
  const protein = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  if (!code || !name || kcal === undefined || protein === undefined || carbs === undefined || fat === undefined) {
    return null;
  }
  // A diferencia de Search-a-licious (brands como lista), la API de producto trae brands como texto separado por comas
  const brandsText = text(product.brands);
  const brand = brandsText?.split(",")[0]?.trim() || undefined;
  const serving = num(product.serving_quantity);
  const servingGrams = product.serving_quantity_unit === "g" && serving ? serving : undefined;
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

const badCode = () => NextResponse.json({ error: "bad_code" }, { status: 400 });
const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });
const unavailable = () => NextResponse.json({ error: "unavailable" }, { status: 502 });

async function handleGET(request: Request): Promise<NextResponse> {
  const code = new URL(request.url).searchParams.get("code") ?? "";
  if (!CODE_RE.test(code)) return badCode();

  const url = new URL(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
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

  const parsed = body as { status?: unknown; product?: unknown } | null;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return unavailable();
  // status 0: OFF confirma que no existe (R5). Cualquier otra forma inesperada, sin "status" reconocible: unavailable.
  if (parsed.status === 0) return notFound();
  if (parsed.status !== 1 || !parsed.product || typeof parsed.product !== "object") return unavailable();

  const product = toProduct(parsed.product as V2Product);
  if (!product) return notFound();
  return NextResponse.json({ product });
}

export async function GET(request: Request) {
  return withCors(request, await handleGET(request));
}
