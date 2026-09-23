# Recetas por cocina
_Status: prototype · Updated: 2026-09-22_

## Problema
El recetario actual (40 recetas en `src/data/recipes.json`) no tiene ninguna dimensión de cocina/categoría: `tags` solo cubre tipo de comida (desayuno/comida/cena), macros y dieta. Al buscar variedad internacional, la cobertura real es mínima: 3 recetas "asiático", 1 "mexicano" + 1 "tex-mex", 0 explícitamente españolas/sevillanas, 0 indias.

## Recomendado a explorar
Añadir un filtro/categoría de cocina (Sevillana, Española, Mexicana, India, Asiática, ...) en la lista de recetas, y usarlo también para detectar y rellenar huecos (p. ej. generar recetas indias con IA cuando no hay ninguna).

## Prototype
_Design: https://claude.ai/artifact/LLVkstMH2aySevHAakvwaP · 2026-09-22_
- Screens:
  1. Recetas (todas) — chips de cocina sobre la lista existente
  2. Recetas (India) — estado vacío real (hoy no hay recetas indias)
  3. Recetas (Asiática) — lista filtrada con datos existentes + 1 receta nueva de ejemplo
  4. Detalle de receta — badge de cocina junto a tiempo/kcal
- Decisiones tomadas al prototipar (ASSUMPTIONs):
  - Solo "Todas", "India" y "Asiática" están conectadas en el prototipo; "Sevillana", "Española" y "Mexicana" son visuales (mismo patrón, sin pantalla propia).
  - La etiqueta de cocina se distingue visualmente del resto de tags (color propio + emoji) en vez de ser un tag más.
  - El estado vacío de una cocina ofrece generar recetas de esa cocina con IA, reutilizando el botón "Sugerir con IA" que ya existe.
  - Solo una tarjeta (la sevillana) está conectada a la pantalla de detalle en el prototipo.
- Qué aprender probándolo: si categorizar por cocina ayuda a encontrar variedad, si el hueco de "India" (vacío) se entiende como oportunidad de generar con IA en vez de como un error, y qué otras cocinas priorizar.
