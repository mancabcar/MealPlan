// Datos de la importación de recetas desde URL (docs/pm/19-importar-receta-url/spec.md › Acceptance criteria R1–R9).
// Compartidos por tests/unit/recipe-import.test.ts, tests/unit/RecipeForm-import.test.tsx,
// server/tests/unit/recipes-import-route.test.ts y tests/e2e/importar-receta.spec.ts.
//
// Ninguna URL se descarga de verdad: son textos inventados con la forma de una web de recetas real.

export const RECIPE_URL = "https://www.recetas-ejemplo.es/lentejas-con-verduras";

/** JSON-LD completo: es lo que publica la mayoría de webs de recetas. Macros por ración (schema.org). */
export const LENTEJAS_LD = {
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Lentejas con verduras",
  recipeIngredient: ["250 g de lentejas", "1 zanahoria", "1 puerro", "2 cucharadas de aceite de oliva"],
  recipeInstructions: [
    { "@type": "HowToStep", text: "Sofreír la verdura." },
    { "@type": "HowToStep", text: "Añadir las lentejas y cubrir con agua." },
    { "@type": "HowToStep", text: "Cocer 30 minutos." },
  ],
  totalTime: "PT45M",
  recipeYield: "4 raciones",
  recipeCategory: "Plato principal",
  nutrition: {
    "@type": "NutritionInformation",
    calories: "420 kcal",
    proteinContent: "24 g",
    carbohydrateContent: "58 g",
    fatContent: "10 g",
  },
};

/** Lo que debe salir de extraer LENTEJAS_LD: nombre, ingredientes/pasos como listas, minutos y macros numéricos. */
export const LENTEJAS_IMPORTED = {
  name: "Lentejas con verduras",
  ingredients: ["250 g de lentejas", "1 zanahoria", "1 puerro", "2 cucharadas de aceite de oliva"],
  instructions: ["Sofreír la verdura.", "Añadir las lentejas y cubrir con agua.", "Cocer 30 minutos."],
  prepTimeMinutes: 45,
  calories: 420,
  protein: 24,
  carbs: 58,
  fat: 10,
};

export const page = (head: string, body = "<h1>Receta</h1>") =>
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Receta</title>${head}</head><body>${body}</body></html>`;

export const ldScript = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

/** Página con JSON-LD directo. */
export const HTML_JSONLD = page(ldScript(LENTEJAS_LD));

/** Mismo JSON-LD dentro de un @graph junto a otros nodos que no son la receta. */
export const HTML_GRAPH = page(
  ldScript({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: "Recetas Ejemplo", url: "https://www.recetas-ejemplo.es" },
      { ...LENTEJAS_LD, "@type": ["Recipe"], "@context": undefined },
    ],
  }),
);

/** Mismo JSON-LD como lista de nodos en el script. */
export const HTML_LIST = page(ldScript([{ "@type": "BreadcrumbList", itemListElement: [] }, LENTEJAS_LD]));

/** Sin bloque `nutrition`: los macros quedan vacíos. */
export const HTML_NO_NUTRITION = page(ldScript({ ...LENTEJAS_LD, nutrition: undefined }));

/** Sin `recipeYield`. */
export const HTML_NO_YIELD = page(ldScript({ ...LENTEJAS_LD, recipeYield: undefined }));

/** Pasos con secciones (HowToSection) y `recipeInstructions` como texto suelto. */
export const HTML_SECTIONS = page(
  ldScript({
    ...LENTEJAS_LD,
    recipeInstructions: [
      {
        "@type": "HowToSection",
        name: "Sofrito",
        itemListElement: [
          { "@type": "HowToStep", text: "Picar la verdura." },
          { "@type": "HowToStep", text: "Sofreírla 10 minutos." },
        ],
      },
      { "@type": "HowToSection", name: "Guiso", itemListElement: [{ "@type": "HowToStep", text: "Cocer las lentejas." }] },
    ],
  }),
);

/** Tiempo de 1 h 30 min. */
export const HTML_TIME_1H30 = page(ldScript({ ...LENTEJAS_LD, totalTime: "PT1H30M" }));

/** Receta sin JSON-LD: solo texto en la página (ruta de IA, R3). */
export const HTML_TEXT_ONLY = page(
  "<style>body{font-family:sans-serif}</style><script>window.track = 1;</script>",
  `<h1>Crema de calabaza</h1>
   <p>Ingredientes: 500 g de calabaza, 1 cebolla, 1 vaso de caldo.</p>
   <p>Pasos: cortar la calabaza, sofreír la cebolla, cocer con el caldo y triturar.</p>`,
);

/** Página sin ninguna receta. */
export const HTML_NO_RECIPE = page("", "<h1>Política de cookies</h1><p>Usamos cookies para mejorar tu experiencia.</p>");

/** Lo que devuelve Claude para HTML_TEXT_ONLY: macros por ración estimados. */
export const CALABAZA_AI = {
  name: "Crema de calabaza",
  ingredients: ["500 g de calabaza", "1 cebolla", "1 vaso de caldo"],
  instructions: ["Cortar la calabaza.", "Sofreír la cebolla.", "Cocer con el caldo y triturar."],
  prepTimeMinutes: 30,
  calories: 180,
  protein: 5,
  carbs: 28,
  fat: 6,
};

/** Respuesta de la ruta para una importación por JSON-LD (lo que el e2e simula desde el servidor). */
export const RESPONSE_JSONLD = {
  recipe: LENTEJAS_IMPORTED,
  source: "jsonld" as const,
  servingsHint: "4",
  tagHint: "Plato principal",
};

/** Respuesta de la ruta para una importación por IA. */
export const RESPONSE_AI = { recipe: CALABAZA_AI, source: "ai" as const };

export const ERROR_TEXTS = {
  fetch_failed: "No se pudo descargar la página.",
  no_recipe: "No se encontró una receta en esa página.",
  invalid_url: "Escribe una URL válida (http o https).",
  blocked: "Esa dirección no está permitida.",
  rate_limited: "Demasiadas importaciones seguidas. Prueba de nuevo en unos minutos.",
} as const;

/** Códigos HTTP de la ruta por error (tech.md › APIs / interfaces). */
export const ERROR_STATUS = {
  invalid_url: 400,
  blocked: 400,
  fetch_failed: 502,
  no_recipe: 422,
  rate_limited: 429,
} as const;
