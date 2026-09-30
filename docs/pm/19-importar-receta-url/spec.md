# Importar una receta desde una URL: Spec
_Status: Draft · Owner: Manuel · Updated: 2026-09-30_
_Related: [brief](brief.md)_

## TL;DR
Hoy las recetas de otras webs hay que copiarlas a mano. Vamos a permitir pegar una URL: el servidor extrae la receta (JSON-LD `schema.org/Recipe` sin IA; con IA solo si no hay JSON-LD) y abre el formulario de #18 prerrellenado para revisar. El éxito es que 5 webs reales que elija Manuel se importen bien, al menos 3 por JSON-LD.

## Problem
Paprika y Samsung Food importan recetas de cualquier web; en MealPlan, para tener una receta de internet hay que copiar ingredientes y pasos a mano en el formulario de recetas propias (#18).

## Goals
- Importar una receta pegando una URL y revisarla en el formulario existente antes de guardar.
- Usar los datos estructurados de la web (JSON-LD) siempre que existan, sin coste de IA.
- Que ningún dato estimado por IA se confunda con un dato real.

## Non-goals
- Traducir la receta (se importa en el idioma original).
- Importar fotos.
- Importar varias URLs a la vez o desde "compartir" del móvil.
- Normalizar ingredientes o inferir tags con IA.
- Reimportar o actualizar una receta ya guardada.
- Funcionar sin conexión.

## Users & key scenarios
Usuario único de MealPlan.
1. Encuentra una receta con JSON-LD, pega la URL, revisa el formulario prerrellenado y guarda.
2. Encuentra una web sin JSON-LD: la IA extrae la receta y estima macros; el usuario los revisa, sabiendo que son estimados.
3. Pega una URL que falla o que no es una receta: ve un mensaje claro y puede crear la receta a mano.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | En Recetas hay un botón "Importar desde URL" junto a "Nueva receta"; el usuario pega una URL y, al terminar, se abre el formulario de receta prerrellenado. | Must |
| R2 | Si la web tiene JSON-LD `Recipe`, la receta se importa sin llamar a la IA (nombre, ingredientes uno por línea, pasos, tiempo de preparación y macros si el JSON-LD los trae; los que falten quedan vacíos). | Must |
| R3 | Si no hay JSON-LD `Recipe`, el servidor usa Claude para extraer nombre, ingredientes y pasos del texto de la página y estimar macros por ración. | Must |
| R4 | Los macros estimados por IA se marcan como estimados: aviso en el formulario durante la revisión y distintivo persistente en la receta guardada (campo nuevo). | Must |
| R5 | Nada se guarda sin que el usuario confirme en el formulario; cerrar o cancelar no deja rastro. | Must |
| R6 | Si la descarga falla (bloqueo, 404, tiempo agotado) o la página no contiene receta (incluido fallo de la IA), se muestra un mensaje según la causa y la opción de crear la receta a mano; la IA no se reintenta. | Must |
| R7 | El servidor solo acepta URLs http/https, rechaza destinos internos (localhost, IPs privadas), aplica límite de tamaño y de tiempo a la descarga, y tiene las mismas protecciones de acceso que `/api/recipes`. La clave de Claude nunca llega al cliente. | Must |
| R8 | Si la web indica raciones (`recipeYield`) y los macros del JSON-LD son de la receta entera, se convierten a por ración y el formulario avisa de lo que se asumió. | Should |
| R9 | Se guarda la URL de origen (campo nuevo) y se muestra como enlace en la receta. | Should |

## User flows
1. **JSON-LD:** Recetas → "Importar desde URL" → pegar URL → "Importar" → estado de carga → formulario prerrellenado (sin aviso de estimado) → el usuario revisa/edita → "Guardar".
2. **Sin JSON-LD:** igual, pero el formulario muestra un aviso de que los macros son estimados por IA → guardar; la receta queda con el distintivo "estimado".
3. **Error:** tras la carga aparece un mensaje con la causa y el botón "Crear a mano" (formulario vacío, con la URL en origen si R9 se implementa).

## Acceptance criteria
**R1**
- Given la pantalla Recetas, when la abro, then veo "Importar desde URL" junto a "Nueva receta".
- Given una URL válida, when pulso "Importar", then veo un estado de carga y después el formulario de #18 con los campos rellenados.

**R2**
- Given una web con JSON-LD `Recipe`, when importo, then no se llama a Claude y el formulario trae nombre, ingredientes, pasos y tiempo.
- Given un JSON-LD sin `nutrition`, when importo, then los campos de macros quedan vacíos y no hay aviso de estimado.
- Given un JSON-LD dentro de `@graph` o como lista, when importo, then se encuentra igualmente la `Recipe`.

**R3 / R4**
- Given una web sin JSON-LD con una receta en el texto, when importo, then el formulario trae ingredientes, pasos y macros por ración, con aviso visible de "macros estimados por IA".
- Given una receta guardada desde una importación con IA, when la abro en Recetas, then muestra el distintivo "estimado" junto a los macros.
- Given una receta con macros estimados, when el usuario edita los macros a mano y guarda, then [Open question: ¿se quita el distintivo?].

**R5**
- Given el formulario prerrellenado, when lo cierro o cancelo, then la receta no aparece en Recetas ni en ningún selector.
- Given una importación completada, when no he pulsado "Guardar", then el almacenamiento local no cambia.

**R6**
- Given una URL que devuelve 404, un timeout o un bloqueo, when importo, then veo un mensaje que distingue "no se pudo descargar" de "no se encontró una receta" y el botón "Crear a mano".
- Given una página sin receta, when la IA no devuelve una receta válida, then se trata como "no se encontró una receta" y no se reintenta.

**R7**
- Given una URL `ftp://…`, `http://localhost/…` o `http://192.168.x.x/…`, when se envía al servidor, then se rechaza sin realizar la descarga.
- Given una respuesta mayor que el límite de tamaño o que tarda más que el límite de tiempo, when se descarga, then se corta y se devuelve error (límites concretos: los fija tech design).
- Given una petición desde un origen no permitido, when llega a la ruta, then se aplica la misma política que `/api/recipes`.

**R8**
- Given macros totales y `recipeYield` = 4, when importo, then los macros del formulario son la cuarta parte y el formulario indica el número de raciones asumido.

**R9**
- Given una importación, when guardo, then la receta muestra un enlace a la URL de origen.

## Edge cases
- URL sin protocolo (`www.ejemplo.com/receta`): se completa con `https://` o se valida con mensaje (a decidir en tech design).
- Redirecciones a destinos internos: también se rechazan.
- `recipeInstructions` en formato texto, lista de `HowToStep` o `HowToSection`: todos se aplanan a pasos.
- `totalTime`/`prepTime` en formato ISO 8601 (`PT30M`): se convierte a minutos.
- Receta sin ingredientes o sin nombre: el formulario ya valida al guardar (#18).
- Usuario sin conexión: mensaje de error de red; no hay modo offline.
- El campo "tags" queda vacío; si el JSON-LD trae `recipeCategory` puede sugerirse, sin asignarlo.

## Success metrics
| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Webs de recetas reales que se importan correctamente | 0 (todo manual) | 5 de 5 elegidas por Manuel, al menos 3 por JSON-LD | Prueba manual |

## Risks & dependencies
- Depende de #18 (mergeado): formulario y modelo `Recipe`; requiere dos campos nuevos (macros estimados, URL de origen) y migración de datos si aplica.
- Depende del servidor de Vercel (#69) y de la clave de Claude ya configurada allí.
- SSRF: descargar URLs arbitrarias desde el servidor es la superficie de riesgo principal (R7).
- Webs que bloquean bots o exigen JavaScript pueden fallar (R6).
- Coste de IA por importación sin JSON-LD.

## Open questions
- [ ] Si el usuario edita los macros estimados a mano, ¿el distintivo "estimado" se quita? (Manuel; no bloquea tech design pero sí el criterio de R4)
- [ ] Límites concretos de tamaño y tiempo de descarga (los propone dev-technical-opinion y Manuel confirma).
- [ ] ¿Cómo se aplica "las mismas protecciones que /api/recipes"? Revisar qué protege hoy esa ruta (tech design).
