# Historial de peso y medidas corporales: Spec
_Status: Approved · Owner: Manuel · Updated: 2026-09-26_
_Related: [brief](brief.md) · [prototype](https://claude.ai/artifact/UC1WMWf2YsQwbkVU88LGEz) · [issue #9](https://github.com/mancabcar/MealPlan/issues/9)_

## TL;DR
Hoy el perfil solo guarda un peso, sin fecha, y las mediciones mensuales de la nutricionista (BIA, perímetros y pliegues) no tienen dónde ir. Añadimos un historial de mediciones con fecha, dentro de Perfil, con dos formas de registrar: «Solo peso» para las pesadas en casa e «Informe completo» para las 22 medidas del informe. Hay una gráfica del peso con tendencia de 7 días y otra por métrica. Un peso nuevo actualiza el perfil y, si los objetivos son calculados, ofrece recalcularlos. Sabremos que funciona cuando los informes de la nutricionista estén en la app y el peso se apunte al menos una vez por semana.

## Problem
Manuel sigue un plan de una nutricionista que le mide una vez al mes (peso, BIA, 10 perímetros y 6 pliegues cutáneos; ver [`evolucion-agosto-2026.md`](../../referencia/evolucion-agosto-2026.md)). En la app solo hay un campo de peso (`UserProfile.body.weightKg`, o `UserProfile.weightKg` en la ruta de la nutricionista sin datos corporales), que se sobrescribe sin fecha. Hoy la evolución se consulta en el PDF de la nutricionista y en markdown transcrito a mano; entre consulta y consulta no queda ningún registro. Todas las apps competidoras tienen historial de peso, y MacroFactor incluso ajusta los objetivos según la tendencia.

## Goals
- Registrar mediciones con fecha: el peso rápido en casa y el informe completo de la nutricionista, tal cual viene.
- Ver cómo evoluciona el peso (con tendencia) y cualquier otra medida a lo largo del tiempo.
- Que el peso del perfil y la oferta de recalcular objetivos se alimenten del historial, sin tener que editar dos sitios.

## Non-goals
- **Ajuste automático de objetivos según la tendencia** (estilo MacroFactor): el historial es un requisito previo; el ajuste merece su propio issue (Follow-ups del brief).
- **Importar el PDF de la nutricionista** o leerlo con IA: los valores se escriben a mano.
- **Metas de peso o de medidas** (peso objetivo, fecha objetivo, progreso hacia la meta).
- **Fotos de progreso.**
- **Sincronizar con básculas o con Salud/Google Fit.**
- **Exportar** el historial (CSV, PDF).
- **Validar la coherencia entre métricas** (p. ej. IMC frente a peso y altura): la toma del 31/07 es incoherente y se guarda tal cual.
- **Unidades imperiales**: kg, cm y mm.

## Users & key scenarios
Manuel, el único usuario, en el móvil.
1. **Pesada en casa:** se pesa por la mañana, abre Evolución, «Añadir» → «Solo peso», escribe 74,8 y guarda. Con objetivos «Calculado» la app le ofrece recalcular.
2. **Consulta con la nutricionista:** con el informe delante, «Añadir» → «Informe completo», origen Nutricionista, fecha de la toma, y copia los valores que trae el informe.
3. **Corregir una toma:** ve un 9,7 imposible en la pierna derecha del 31/07, abre esa medición, lo corrige a 49,7 y guarda. O borra una pesada duplicada.
4. **Ver la evolución:** mira la gráfica del peso con la tendencia, y cambia a cintura para ver cuánto ha bajado desde mayo.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | El usuario puede añadir una medición con fecha (hoy por defecto; no se admiten fechas futuras) y origen Casa o Nutricionista (Casa por defecto en «Solo peso»). Una medición necesita al menos un valor además de la fecha. | Must |
| R2 | «Solo peso»: un formulario rápido con fecha y peso (kg). | Must |
| R3 | «Informe completo»: todas las métricas del informe de la nutricionista, agrupadas como en él y todas opcionales. **Bioimpedancia:** peso (kg), masa muscular (kg), grasa corporal (kg), % grasa, IMC, grasa visceral. **Perímetros (cm):** bíceps izq./der., cintura, cadera, pierna izq./der., gemelo izq./der., pecho-espalda, glúteos. **Pliegues (mm):** bicipital, tricipital, abdominal, suprailíaco, cuadricipital, gemelo. | Must |
| R4 | Los campos numéricos aceptan coma y punto decimal. Un valor que no es un número o está fuera del rango de su métrica no se guarda y se muestra un error junto al campo (rangos en Edge cases). Un valor válido se guarda tal cual lo escribe el usuario, sin recalcularlo ni corregirlo (el IMC incluido). | Must |
| R5 | El usuario puede editar y borrar cualquier medición. Borrar pide confirmación. | Must |
| R6 | Las mediciones persisten por usuario, igual que el resto de datos de la app, y sobreviven a recargar la página. | Must |
| R7 | Pantalla Evolución, accesible desde una tarjeta «Evolución» en Perfil (sin pestaña nueva). Muestra el último peso, la tendencia, la gráfica y el historial de mediciones, del más reciente al más antiguo. Tocar una medición abre su edición. | Must |
| R8 | La gráfica del peso muestra cada medición con peso como un punto en su fecha, distinguiendo las de Casa y las de Nutricionista, más una línea de tendencia: para cada punto, la media de los pesos de los 7 días anteriores, ese día incluido. | Must |
| R9 | El peso del perfil es el de la medición con peso de fecha más reciente. Añadir o editar esa medición actualiza el peso del perfil; una medición más antigua no lo toca. | Must |
| R10 | Cuando una medición nueva o editada cambia el peso del perfil (R9): con objetivos «Calculado» se ofrece recalcular con la misma oferta que ya existe en «Datos corporales» («Recalcular» o «Mantener los actuales»); con objetivos «De tu nutricionista» los objetivos no cambian y un aviso lo dice. | Must |
| R11 | Estado vacío en Evolución sin mediciones, con accesos a «Apuntar peso» y «Añadir informe completo». El peso actual del perfil no se convierte en medición. | Must |
| R12 | La tarjeta «Evolución» de Perfil muestra el último peso, la tendencia de los últimos 30 días y una minigráfica. Sin mediciones, invita a añadir la primera. | Should |
| R13 | Selector de métrica en Evolución: cualquier métrica con al menos una medición tiene su gráfica (puntos unidos por línea, sin tendencia) y su historial con la diferencia respecto a la anterior. | Should |
| R14 | La suma de pliegues se calcula a partir de los seis pliegues cuando están los seis, y se muestra en el formulario y como métrica de R13. | Should |
| R15 | Selector de periodo para la gráfica: 1 mes, 3 meses, 6 meses, todo (por defecto «Todo»). | Should |
| R16 | Aviso no bloqueante cuando un valor se aleja mucho del esperado: un lado bilateral difiere más de un 30 % del otro, o un valor difiere más de un 30 % de la medición anterior de esa métrica. | Could |
| R17 | Guardar en «Datos corporales» un peso distinto del actual crea también una medición de hoy, origen Casa, con ese peso. _(Decidido, Manuel, 2026-09-26, a raíz de la tech design.)_ | Must |

## User flows
**Pesada en casa (escenario 1)**
1. Perfil → tarjeta «Evolución» → «Ver evolución» (artboard 1 → 3).
2. «Añadir» abre la hoja «Añadir medición» con «Solo peso» seleccionado, fecha de hoy y el último peso como referencia (artboard 4).
3. Escribe el peso y pulsa «Guardar». La hoja se cierra, el punto aparece en la gráfica y en el historial.
4. Objetivos «Calculado»: aparece «¿Recalculamos?» con los objetivos sugeridos (artboard 6). «De tu nutricionista»: aviso de que los objetivos no cambian (artboard 7).

**Consulta con la nutricionista (escenario 2)**
1. Evolución → «Añadir» → «Informe completo» (artboard 4 → 5).
2. Elige la fecha de la toma y el origen Nutricionista, y rellena los campos que trae el informe.
3. «Guardar». Si es la medición más reciente con peso, sigue el paso 4 del flujo anterior.

**Corregir o borrar (escenario 3)**
1. Evolución → toca una medición del historial → formulario de edición (artboard 5, «Editar medición»).
2. Cambia valores y «Guardar», o «Eliminar medición» → confirmación → desaparece del historial y de las gráficas.

**Ver otra métrica (escenario 4)**
1. Evolución → chip «Cintura» (artboard 8): valor actual, diferencia desde la primera, gráfica e historial de las mediciones con cintura.

## Acceptance criteria
**R1, R2**
- Given Evolución, when el usuario pulsa «Añadir», then se abre «Añadir medición» en «Solo peso» con la fecha de hoy y el origen Casa.
- Given «Solo peso» con 74,8, when pulsa «Guardar», then el historial muestra una medición de hoy con 74,8 kg y la gráfica un punto nuevo.
- Given una fecha posterior a hoy, when intenta guardar, then no se guarda y se muestra un error en la fecha.
- Given el formulario sin ningún valor, when intenta guardar, then no se guarda y se muestra un error.

**R3**
- Given «Informe completo», then están los 22 campos de R3 agrupados en Bioimpedancia, Perímetros y Pliegues, y el selector de origen.
- Given los valores de la toma del 31/07/2026 de [`evolucion-agosto-2026.md`](../../referencia/evolucion-agosto-2026.md) (con 49,7 en la pierna derecha), when se introducen y se guardan, then al reabrir la medición cada campo muestra exactamente el valor introducido.
- Given solo cintura y cadera rellenas, when guarda, then se guarda la medición sin peso y no cambia el peso del perfil.

**R4**
- Given «75,3» o «75.3» en el peso, then se guarda 75,3 kg.
- Given «abc» o un valor fuera de rango en un campo, then no se guarda y ese campo muestra el error.
- Given IMC 29,3 con peso 76,0 (incoherente con la altura), then se guarda sin aviso ni cambio.

**R5**
- Given una medición en el historial, when la toca, cambia un valor y guarda, then el historial y la gráfica muestran el nuevo valor.
- Given «Eliminar medición», when confirma, then la medición desaparece del historial y de las gráficas; when cancela, then no cambia nada.

**R6**
- Given mediciones guardadas, when recarga la página, then siguen ahí.
- Given dos usuarios en el mismo navegador, then cada uno solo ve sus mediciones.
- Given mediciones guardadas, when exporta sus datos (backup-datos) e importa la copia, then las mediciones vuelven igual; una copia anterior a esta feature deja el historial vacío. _(Añadido en dev-test, 2026-09-26: la copia de seguridad llegó con el PR #32 después de la tech design.)_

**R7, R11**
- Given Perfil, then hay una tarjeta «Evolución» que lleva a la pantalla Evolución; la barra de navegación sigue teniendo 5 pestañas.
- Given ninguna medición, then Evolución muestra el estado vacío con «Apuntar peso» y «Añadir informe completo», aunque el perfil tenga peso.
- Given varias mediciones, then el historial las ordena de la más reciente a la más antigua, y las de origen Nutricionista llevan una etiqueta.

**R8**
- Given pesos 75,6 (15/09), 74,9 (19/09), 75,0 (22/09) y 74,8 (24/09), then la tendencia en el 24/09 es la media del 18/09 al 24/09 (74,9; 75,0; 74,8) = 74,9 kg, y en el 22/09 es la media del 16/09 al 22/09 (74,9; 75,0) = 74,95 kg; el 15/09 queda fuera de las dos ventanas.
- Given una sola medición con peso, then la gráfica muestra un punto y la tendencia es ese valor.
- Given mediciones sin peso (solo perímetros), then no aparecen en la gráfica del peso.

**R9**
- Given última medición con peso del 22/09 (75,0), when añade una del 24/09 con 74,8, then el peso del perfil es 74,8.
- Given última medición con peso del 24/09, when añade o edita una del 31/07, then el peso del perfil no cambia.
- Given objetivos «De tu nutricionista» sin datos corporales, then el peso nuevo se guarda en `weightKg` del perfil; con datos corporales, en los dos sitios, como hoy.

**R10**
- Given objetivos «Calculado», when un peso nuevo cambia el peso del perfil, then aparece «¿Recalculamos?» con los objetivos calculados para ese peso; «Recalcular» los aplica y «Mantener los actuales» los deja como estaban.
- Given objetivos «De tu nutricionista», when un peso nuevo cambia el peso del perfil, then los objetivos (kcal y macros) no cambian y se muestra un aviso que lo dice.
- Given una medición con el mismo peso que ya tenía el perfil, or una medición antigua, then no se ofrece recalcular.

**R17**
- Given el perfil con 75,0 kg, when edita «Datos corporales» y guarda 74,6, then el historial tiene una medición de hoy, origen Casa, con 74,6 kg, y el comportamiento de recalcular es el de hoy (la oferta de Perfil).
- Given «Datos corporales» guardado sin cambiar el peso (p. ej. solo la actividad), then no se crea ninguna medición.

## Edge cases
- **Varias mediciones el mismo día** (pesada en casa y consulta): se permiten y se guardan por separado. Para R9, entre dos del mismo día manda la última guardada.
- **Borrar la medición más reciente con peso:** el peso del perfil no cambia (no se deshace el recálculo ni el peso). Ver Open questions.
- **Editar una medición y quitarle el peso:** si era la más reciente con peso, el perfil no cambia (igual que borrar).
- **Rangos válidos** (para rechazar erratas, no para diagnosticar): peso 30–250 kg (el mismo que el perfil); masa muscular y grasa 1–150 kg; % grasa 1–75; IMC 10–70; grasa visceral 1–59; perímetros 5–250 cm; pliegues 1–80 mm. El «9,7» de la pierna del PDF entra en el rango: lo pilla R16 si se hace.
- **Una métrica con una sola medición:** su gráfica (R13) muestra un punto y no hay diferencia con la anterior.
- **Pesadas espaciadas** (una por semana): la tendencia coincide con el punto; se acepta así.
- **Periodo sin datos** (R15, p. ej. 1 mes sin pesadas): la gráfica dice que no hay mediciones en ese periodo.
- **Usuario sin datos corporales ni objetivos calculados:** no hay recálculo posible; solo se actualiza el peso.

## Success metrics
| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Informes de la nutricionista introducidos | 0 (en PDF y markdown) | Las 3 tomas de mayo–julio y cada toma nueva, en la semana en que llega | Mediciones con origen Nutricionista en la app |
| Frecuencia de pesadas | Ninguna registrada | ≥ 1 por semana durante 4 semanas | Mediciones con peso por semana |
| Peso del perfil al día | Se edita a mano, sin fecha | El peso del perfil coincide con la última pesada | Revisión manual en Perfil |

## Risks & dependencies
- **Librería de gráficas:** no hay ninguna en el proyecto; elegir entre una dependencia o SVG a mano es decisión de la tech design.
- **Dos campos de peso en el perfil** (`body.weightKg` y `weightKg`): R9 tiene que escribir en los dos como hace hoy la tarjeta «Datos corporales», o el peso se desincroniza.
- **Oferta de recalcular** hoy vive dentro de la tarjeta «Datos corporales» de `src/app/perfil/page.tsx`; R10 la necesita en la pantalla Evolución, así que habrá que extraerla.
- **Formulario largo en el móvil** (22 campos): el riesgo es que copiar un informe sea tedioso. El prototipo lo agrupa en tres bloques; se valida con el primer informe real.

## Open questions
- [x] ¿Cómo se ven en la gráfica las métricas bilaterales (bíceps, pierna, gemelo)? **Decidido (Manuel, 2026-09-24): dos líneas, izq. y der., en la misma gráfica.**
- [x] Al borrar la medición más reciente con peso, ¿el peso del perfil vuelve al de la anterior? **Decidido (Manuel, 2026-09-24): no**, para que borrar no cambie objetivos a escondidas.
- [x] ¿Cargamos las tres tomas de mayo–julio de `evolucion-agosto-2026.md` como datos iniciales, o se introducen a mano como prueba del formulario? **Decidido (Manuel, 2026-09-24): a mano**, sin datos iniciales.
