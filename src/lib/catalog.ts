// Catálogo de recetas (docs/pm/recetas-almacenamiento): contenido de la app, de solo lectura, que viaja en el bundle.
// No se copia a localStorage: lo guardado por cada usuario son solo sus recetas (IA y propias), y AppProvider expone
// catálogo + usuario. Así un cambio en src/data/recipes.json llega a todas las cuentas al recargar.
// Un id del catálogo es un contrato: el plan y el diario lo guardan. Para retirar una receta hay que dejarle un alias
// en RETIRED_RECIPE_IDS (src/lib/migrate.ts); tests/unit/catalog-ids.test.ts lo comprueba.
import seedData from "@/data/recipes.json";
import type { Recipe } from "./types";

export const CATALOG = seedData.recipes as Recipe[];

export const CATALOG_IDS: ReadonlySet<string> = new Set(CATALOG.map((r) => r.id));
