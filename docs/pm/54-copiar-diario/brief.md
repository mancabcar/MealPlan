# Diario: copiar un día completo a otra fecha

_Status: prototype · Updated: 2026-10-06 · Issue: [#54](https://github.com/mancabcar/MealPlan/issues/54) · Prototype: [canvas](https://claude.ai/artifact/3BuMmijuwQtipCjmJ74b4v)_

## Follow-ups
- Repetir una entrada suelta del Diario (hoy u otra fecha). (brainstorm)
- Deshacer tras copiar (como en [#53](https://github.com/mancabcar/MealPlan/issues/53)). (brainstorm)
- Copiar varios días o una semana del Diario. (brainstorm)
- Día tipo / plantilla guardada. (brainstorm)
- Rellenar el Diario desde el Plan al copiar semanas (F). (brainstorm)

## Problema
Necesito una forma de llevar un día ya registrado del Diario a otra fecha porque hay días casi calcados y repetirlos exige añadir cada entrada desde «Recientes», cambiando fecha y franja cada vez. Hoy lo hago así, entrada a entrada.

## Success looks like
- Copiar un día cuesta 2-3 toques, en vez de re-registrar cada entrada.

## Constraints & assumptions
- Alcance v1: un solo día. Sin rangos ni varios días (igual que el [#59](https://github.com/mancabcar/MealPlan/issues/59), cerrado como duplicado de este).
- Las copias llevan ids nuevos (criterio del issue).
- «Recientes» ([#12](../12-registro-rapido/brief.md)) ya cubre repetir una entrada en la fecha y franja que se ven; esta feature no lo sustituye.

## Directions considered
### A. «Copiar día a…»: un botón que duplica el día en otra fecha
Botón en la cabecera del día que pide una fecha y duplica todas las entradas con ids nuevos, en las mismas franjas. **Risk:** duplicados sin querer si el destino ya tenía entradas.

### B. A + conflicto + deshacer
A, con aviso si el destino ya tiene entradas y «Deshacer» de ~10 s. **Risk:** más UI y casos para un gesto de 2 toques.

### C. «Traer de otro día»
En el día que se ve, «Traer de…» con selector de fecha origen (por defecto ayer). **Risk:** cubre mal copiar a fechas futuras.

### D. «Repetir» por entrada
Botón en cada fila que la duplica hoy u otra fecha. **Risk:** no resuelve días calcados; ya hay Recientes.

### E. Día tipo / plantilla
Guardar un día como plantilla y aplicarla a cualquier fecha. **Risk:** concepto y almacenamiento nuevos; solo compensa si el día se repite exacto.

### F. Plan → Diario
Que el Diario se rellene desde el Plan («Hecho» + [#53](https://github.com/mancabcar/MealPlan/issues/53)). **Risk:** solo sirve a quien usa el Plan a diario.

| Direction | Impact | Effort | Confidence | Riskiest assumption |
|---|---|---|---|---|
| A. Copiar día a… | Med | Low | High | Sumar al destino es lo esperado |
| B. A + conflicto + deshacer | Med | Med | High | Hace falta más que sumar |
| C. Traer de otro día | Med | Low | Med | Casi siempre se copia hacia hoy |
| D. Repetir entrada | Low | Low | High | «Recientes» no basta |
| E. Día tipo | High | High | Low | Se repite un día exacto |
| F. Plan → Diario | High | Med | Low | Se usa el Plan a diario |

## Recommended bet
**A + aviso de conflicto** (elegida por el usuario, coincide con la recomendación): «Copiar día a…» duplica las entradas del día con ids nuevos. Si el destino ya tiene entradas, avisa y ofrece sumar o cancelar; nunca pisa nada. Sin Deshacer en v1.
Cambiaría la apuesta si el prototipo mostrara que elegir la fecha cuesta más de 2-3 toques (entonces C, «Traer de…»).

## What to prototype
- Dónde vive el botón «Copiar día a…» en el Diario y cómo se elige la fecha de destino.
- El aviso de conflicto (destino con entradas): sumar o cancelar.
- Pregunta a responder: ¿se hace en 2-3 toques sin perderse en la cabecera del Diario?

## Open questions
- Si se copian también entradas con raciones, gramos o unidades tal cual (se supone que sí; confirmar en el spec).

## Prototype
_Design: https://claude.ai/artifact/3BuMmijuwQtipCjmJ74b4v · 2026-10-06_
- Screens: 1 Diario con entradas · 2 Elegir fecha de destino · 3 Aviso de conflicto · 4 Copiado · 5 Día sin entradas (móvil, siguiendo el look de la app, datos inventados).
- Decisions (confirmed by the user):
  - El botón vive en la cabecera, junto a la fecha; solo icono (44 px) con `aria-label` «Copiar día a otra fecha».
  - Hoja inferior con atajos Hoy, Mañana y En 7 días (contados desde hoy; el que coincide con el día de origen no se ofrece), selector de fecha y botón «Copiar».
  - Si el destino ya tiene entradas: aviso que las lista y ofrece «Sumar las N entradas» o «Cancelar». Nunca pisa nada.
  - Tras copiar, el Diario salta al día de destino con el aviso «Copiadas N entradas» y marca «Copiada» en las nuevas mientras dura el aviso. Sin Deshacer en v1.
  - Con el día de origen sin entradas, el botón sale desactivado (no oculto).
  - Se permite copiar a fechas futuras.
- Pending ASSUMPTIONs: ninguna.
- What to learn from testing it: si copiar un día cuesta 2-3 toques (botón → atajo → Copiar) y si el icono solo se entiende en la cabecera.
