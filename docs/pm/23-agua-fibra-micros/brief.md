# Seguimiento de agua y fibra en el Diario
_Status: shipped · Updated: 2026-10-05 · Issue: [#23](https://github.com/mancabcar/MealPlan/issues/23) (@mancabcar) · Prototype: [canvas](https://claude.ai/artifact/5qcuWMP2ueJJzGfvuYV21n) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md) · PR: [#120](https://github.com/mancabcar/MealPlan/pull/120), [#121](https://github.com/mancabcar/MealPlan/pull/121) (agua) (entrega 1, fibra; #119 ya aportó los datos del catálogo) · Review: [review.md](review.md) — ⚠️ approved with follow-ups_

## Follow-ups
- Azúcar y sodio: campos opcionales en recetas, entradas, alimentos y OFF, y su visualización. (brainstorm; el issue los pedía, el usuario los dejó fuera de esta entrega) → [#124](https://github.com/mancabcar/MealPlan/issues/124)
- Micronutrientes tipo Cronometer (hierro, etc.) con una tabla de nutrientes genérica en vez de campos sueltos. (brainstorm)
- Contador manual de «fibra del día» (sumar gramos o raciones de verdura/legumbre/fruta/integral) sin tocar recetas ni alimentos. (brainstorm)

- Sincronización: un 400 de una clave no debe detener la subida de las demás. (review de #121) → [#122](https://github.com/mancabcar/MealPlan/issues/122)
- Validar fibra, objetivo de fibra, agua y vaso al cargar datos externos. (reviews de #120 y #121) → [#123](https://github.com/mancabcar/MealPlan/issues/123)
- Limpieza y accesibilidad de fibra y agua (GoalRow común, scaleFiber, fiberOf, entryFiber, aria-live, «9 de 8 vasos»). (reviews de #120 y #121) → [#125](https://github.com/mancabcar/MealPlan/issues/125)
- Actualizar spec.md con el cambio de las entradas antiguas de receta (la fibra se recupera de la receta). (review de #120)

## Problem
Necesito un modo de seguir mi agua y mi fibra del día dentro del Diario, porque hoy la app solo me deja ver kcal y macros y me quedo sin saber si hidrato y como suficiente fibra. Hoy no lo anoto en ningún sitio.

Quién: el propio usuario, por curiosidad tipo Cronometer (no es una exigencia de un plan de nutricionista).

Lo que hay hoy en el código: `Recipe` y `MealEntry` solo guardan kcal, P, C y G; `MealEntry` guarda una copia de los macros del momento (#13), así que las entradas ya registradas no tendrán fibra. Los alimentos locales (`foods.json`) y Open Food Facts (`/api/foods/search`, `/api/foods/barcode`) solo devuelven kcal y los 3 macros. El objetivo diario vive en `UserProfile`. El recetario (`recipes.json`) no tiene fibra. Hay copia de seguridad y sincronización (#22), así que lo nuevo debe viajar en ambas.

## Success looks like
- Cumplo el agua a diario sin salir de la app: sumo vasos con un toque y veo el progreso hacia el objetivo.
- Veo si llego a mi fibra del día: total de fibra frente al objetivo en el Diario, igual que kcal y macros.

## Constraints & assumptions
- Prioridad si hay que recortar: fibra primero, agua después.
- Fibra y agua van en un solo brief/spec pero se construyen y mergean en dos entregas (fibra primero).
- Azúcar y sodio quedan fuera de esta entrega (ver Follow-ups).
- La fibra es un dato opcional: recetas, entradas y alimentos sin ese campo siguen funcionando.
- Sin dato ≠ 0: el total de fibra del día avisa cuando es parcial (p. ej. «12 g, parcial») para no dar una falsa sensación de poca fibra.
- Objetivo de fibra por defecto: 38 g/día, editable en Perfil. Objetivo de agua por defecto: 2 L/día, editable.
- Agua en vasos de tamaño configurable (p. ej. 250 ml por vaso).
- El catálogo `recipes.json` y los ~150 alimentos de `foods.json` se rellenan con fibra (valores aproximados) en la entrega de fibra. Las recetas propias e importadas la llevan solo si el usuario/la importación la aporta.
- Open Food Facts trae fibra cuando existe (`fiber_100g`); los productos sin dato quedan «sin dato».
- Los datos nuevos deben incluirse en la copia de seguridad y en la sincronización (#22).
- Entradas ya registradas antes de esta entrega: «sin dato».
- Relacionado: #13 (base de alimentos).

## Directions considered
### A. Solo agua: lo mínimo
Contador de vasos en el Diario con objetivo editable; no toca los datos de comida. **Risk:** deja fuera la fibra, que es la prioridad.

### B. Fibra como dato opcional de punta a punta
Campo `fiber` opcional en recetas, entradas, alimentos locales y OFF; objetivo en Perfil; total del día frente al objetivo con aviso de «parcial»; fibra rellena en el catálogo. **Risk:** el total sale bajo mientras falten datos.

### C. Fibra + agua en una entrega (B + A)
Lo que pide el issue sin azúcar/sodio. **Risk:** más superficie (tipos, copia de seguridad, sincronización) en un solo PR.

### D. Contador manual de fibra: la simplificadora
Sumar a mano los gramos del día o raciones de verdura/legumbre/fruta/integral, sin tocar recetas ni alimentos. **Risk:** depende de la disciplina del usuario, no del dato real.

### E. Micronutrientes tipo Cronometer: la ambiciosa (descartada)
Tabla de nutrientes genérica (azúcar, sodio, hierro…). **Risk:** mucho dato que no hay y que el issue no prioriza. Quitada por el usuario.

| Direction | Impact | Effort | Confidence | Riskiest assumption |
|---|---|---|---|---|
| A. Solo agua | Med | Low | High | Que el agua sola baste |
| B. Fibra de punta a punta | High | Med-High | Med | Que los datos de fibra (catálogo, alimentos, OFF) estén lo bastante completos para un total fiable |
| C. Fibra + agua | High | High | Med | Que no se haga inmanejable en un solo PR |
| D. Contador manual de fibra | Low | Low | Low | Que se anote a mano cada día |

Puntuaciones de Claude; el usuario no objetó.

## Recommended bet
**C, fibra + agua, construida en dos entregas (fibra primero, agua después)**, elegida por el usuario (coincide con la recomendación de Claude). Cambiaría a B sola si el agua resultara secundaria, o a A si la fibra no consigue datos fiables.

## What to prototype
Pregunta que debe responder: ¿es útil el total de fibra del día cuando los datos están incompletos?
- Diario con fibra frente al objetivo, completa y parcial («12 g, parcial»).
- Contador de agua (vasos, progreso, +/−).
- Fibra por ración en la ficha de una receta.
- Objetivos de fibra y agua (y tamaño del vaso) en Perfil.

## Prototype
_Design: https://claude.ai/artifact/5qcuWMP2ueJJzGfvuYV21n · 2026-10-05_
- Screens (móvil 390 px, tema oscuro de la app): `1 · Fibra completa, agua en curso`, `2 · Fibra parcial`, `3 · Sin datos de fibra, agua a cero`, `4 · Receta con fibra y sin dato`, `5 · Perfil: objetivos de fibra y agua`, `6 · Agua cumplida`.
- Decisions (confirmed by the user):
  - Fibra como cuarta barra en la tarjeta de macros del Diario; el aviso «parcial» va como chip junto al valor.
  - Agua en tarjeta propia justo debajo de macros+fibra, con vasos tocables y botones − / +.
  - Orden del Diario: anillo kcal → semana → resumen → macros+fibra → agua → comidas.
  - Fibra por ración en la ficha de receta, en la misma fila que kcal, P, C y G (5 celdas); «—» cuando no hay dato.
  - Objetivos por defecto 38 g de fibra y 2 L de agua, editables en Perfil; vaso de tamaño configurable.
  - Sin línea divisoria entre Grasas y Fibra (ni en Perfil entre Grasas y Fibra).
  - Un solo estado «parcial» siempre que falte algún dato, aunque ninguna entrada tenga fibra.
  - Colores: verde para fibra, cian para agua; vaso a elegir entre 200/250/330/500 ml; «Objetivo cumplido» en acento sin bloquear más vasos.
- Pending ASSUMPTIONs: ninguna (el aviso «Faltan datos…» y «Fibra: sin dato» se confirmaron como Should, R9 del spec).
- What to learn from testing it: si el total parcial se entiende y no da falsa sensación de poca fibra; si el contador de agua se lee de un vistazo.

## Shipped
_2026-10-05 · fibra en [#120](https://github.com/mancabcar/MealPlan/pull/120) (con los datos del catálogo de [#119](https://github.com/mancabcar/MealPlan/pull/119)), agua en [#121](https://github.com/mancabcar/MealPlan/pull/121); servidor con la clave `water` desplegado._
Qué vigilar (métricas del [spec](spec.md)), midiéndolas a mano en el Diario:
- Agua al objetivo al menos 5 de cada 7 días durante las primeras 2 semanas.
- Total de fibra completo (sin chip «parcial») al menos 5 de cada 7 días.
Si el total sale casi siempre «parcial», revisar qué entradas no traen fibra (alimentos de marca sin dato, «Personalizada» sin rellenar).

## Open questions
- ¿Cómo se aplican los objetivos por defecto (38 g, 2 L) a los perfiles ya existentes: se rellenan al migrar o el seguimiento aparece al activarlo? ¿Qué se muestra hasta entonces?
- ¿Dónde se guarda el agua (clave nueva sincronizada, o dentro del diario)? Lo decide la tech design.
- ¿Cuenta el parcial por entrada sin dato, o solo si ninguna tiene dato? Definir en el spec.
