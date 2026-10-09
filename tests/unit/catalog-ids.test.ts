// Regla de contenido de docs/pm/recetas-almacenamiento/spec.md (riesgo «Ids = contrato»): un id del catálogo no se borra
// de src/data/recipes.json. El plan y el diario lo guardan por id; si una receta se retira, se redirige a la que se
// queda con RETIRED_RECIPE_IDS (src/lib/migrate.ts). Añadir recetas nuevas no obliga a tocar este fichero.
import { describe, expect, it } from "vitest";
import seedData from "@/data/recipes.json";
import { RETIRED_RECIPE_IDS } from "@/lib/migrate";

/** Ids del catálogo en el momento de separarlo de las recetas del usuario (#42). */
const FROZEN_IDS = [
  "recipe_001", "recipe_002", "recipe_003", "recipe_004", "recipe_005", "recipe_006",
  "recipe_007", "recipe_008", "recipe_011", "recipe_013", "recipe_014", "recipe_015",
  "recipe_016", "recipe_017", "recipe_018", "recipe_019", "recipe_020", "recipe_021",
  "recipe_022", "recipe_023", "recipe_024", "recipe_025", "recipe_026", "recipe_027",
  "recipe_028", "recipe_029", "recipe_030", "recipe_031", "recipe_032", "recipe_033",
  "recipe_034", "recipe_035", "recipe_036", "recipe_037", "recipe_038", "recipe_039",
  "recipe_040", "recipe_041", "recipe_042", "recipe_043", "recipe_044", "recipe_045",
  "recipe_046", "recipe_047", "recipe_048", "recipe_049", "recipe_050", "recipe_051",
  "recipe_052", "recipe_053", "recipe_054", "recipe_055", "recipe_056", "recipe_057",
  "recipe_058", "recipe_059", "recipe_060", "recipe_061", "recipe_062", "recipe_063",
  "recipe_064", "recipe_065", "recipe_066", "recipe_067", "recipe_068", "recipe_069",
  "recipe_070", "recipe_071", "recipe_072", "recipe_073", "recipe_074", "recipe_075",
  "recipe_076", "recipe_077", "recipe_078", "recipe_079", "recipe_080", "recipe_081",
  "recipe_082", "recipe_083", "recipe_084", "recipe_085", "recipe_086", "recipe_087",
  "recipe_088", "recipe_089", "recipe_090", "recipe_091", "recipe_092", "recipe_093",
  "recipe_094", "recipe_095", "recipe_096", "recipe_097", "recipe_098", "recipe_099",
  "recipe_100", "recipe_101", "recipe_102", "recipe_103", "recipe_104", "recipe_105",
  "recipe_106", "recipe_107", "recipe_108", "recipe_109", "recipe_110",
];

describe("Regla de ids: el catálogo no pierde ids sin alias", () => {
  const current = new Set(seedData.recipes.map((r) => r.id));

  it("todo id congelado sigue en el catálogo o está retirado con alias a una receta que existe", () => {
    for (const id of FROZEN_IDS) {
      if (current.has(id)) continue;
      expect(Object.hasOwn(RETIRED_RECIPE_IDS, id), id + " se ha quitado de recipes.json sin alias en RETIRED_RECIPE_IDS").toBe(true);
      expect(current.has(RETIRED_RECIPE_IDS[id]), "el alias de " + id + " no existe en el catálogo").toBe(true);
    }
  });

  it("el catálogo no repite ids", () => {
    expect(current.size).toBe(seedData.recipes.length);
  });
});
