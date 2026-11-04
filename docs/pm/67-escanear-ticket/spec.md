# Escanear un ticket de compra: Spec
_Status: Draft · Owner: Manuel · Updated: 2026-10-30_
_Related: [brief](brief.md) · [issue #67](https://github.com/mancabcar/MealPlan/issues/67)_

## TL;DR
Después de la compra, pasar cada producto a la Despensa a mano es lento, y el ticket ya lo dice todo. Construimos «Escanear ticket» en la Despensa: una foto (cámara o galería) se lee con IA en el servidor y se convierte en una lista editable de productos que, al confirmar, se añaden a la Despensa. Funciona si al menos el 80 % de las líneas de comida del ticket entran sin corregirlas.

## Problem
Manuel (único usuario) guarda la compra y tiene que añadir cada producto a la Despensa escribiendo nombre, cantidad y ubicación. El ticket de la compra ya contiene esa lista. Hoy las únicas vías son el formulario manual de la Despensa y pasar artículos desde la lista de la compra, que solo cubre lo que estaba planificado.

## Goals
- Pasar un ticket entero a la Despensa de una vez.
- Que nada entre en la Despensa sin que el usuario lo confirme en una lista editable.
- Que un ticket ilegible o una línea mal leída nunca bloqueen: se reintenta, se corrige o se añade a mano.

## Non-goals
- Registrar comidas en el Diario a partir del ticket.
- Guardar el ticket, los precios o el gasto.
- Marcar como comprados los artículos de la lista de la compra.
- Varios tickets a la vez, o un ticket repartido en varias fotos (v1: una foto por escaneo).
- Funcionar sin conexión.
- Sumar cantidades a productos que ya están en la Despensa (cada línea crea un artículo nuevo, como hace la lista de la compra).
- Guardar la foto en el servidor.

## Users & key scenarios
- **Vuelta del súper:** Manuel hace una foto del ticket, revisa la lista, cambia un par de ubicaciones a Nevera y confirma; la Despensa queda al día.
- **Foto ya hecha:** sube desde la galería una foto del ticket de ayer.
- **Ticket borroso:** la lectura falla; reintenta con otra foto o añade los productos a mano.
- **Línea mal leída:** una línea sale como «HAC PROD 3» o no se reconoce; la corrige o la descarta y confirma el resto.

## Requirements
| ID | Requirement | Priority |
|---|---|---|
| R1 | Desde la Despensa, el usuario puede escanear un ticket con la cámara o eligiendo una imagen de la galería. | Must |
| R2 | El ticket se lee y se muestra la lista de productos detectados, cada uno con nombre, cantidad y ubicación propuestos. | Must |
| R3 | En la lista el usuario puede editar nombre, cantidad y ubicación de cada línea, y descartar (desmarcar) cualquiera. | Must |
| R4 | Al confirmar, solo las líneas marcadas se añaden a la Despensa, cada una como artículo nuevo; antes de confirmar la Despensa no cambia. | Must |
| R5 | Si el ticket no se puede leer o el proceso falla, el usuario puede reintentar o añadir los productos a mano. | Must |
| R6 | Los nombres de producto se limpian a un nombre legible, usando la Base de alimentos cuando hay coincidencia («HAC YOG GRIEGO 4X125» → «Yogur griego»). | Should |
| R7 | Justo después de añadir, el usuario puede deshacer la operación entera, y los artículos añadidos muestran el chip «Nuevo» ese día. | Should |
| R8 | El usuario puede poner fecha de caducidad a cada línea desde la lista. | Could |

## User flows
**Escanear y añadir**
1. En la Despensa, el usuario pulsa «Escanear ticket».
2. Elige «Hacer foto» (cámara) o «Elegir imagen» (galería).
3. Se muestra un estado de carga mientras se lee el ticket.
4. Aparece la lista: cada línea de comida marcada, con nombre limpio, cantidad legible y ubicación sugerida; las líneas que no son comida aparecen desmarcadas.
5. El usuario edita lo que haga falta y desmarca lo que no quiera.
6. Pulsa «Añadir N productos». Vuelve a la Despensa con los artículos nuevos y la opción de deshacer.

**Error**
1. La lectura falla o no encuentra productos.
2. Se muestra un mensaje con «Reintentar» (otra foto) y «Añadir a mano» (formulario actual de la Despensa).

## Acceptance criteria
**R1**
- Given la Despensa, when el usuario pulsa «Escanear ticket», then puede elegir entre hacer una foto con la cámara o elegir una imagen de la galería.
- Given el usuario cancela la cámara o el selector, then vuelve a la Despensa sin cambios.

**R2**
- Given una foto legible de un ticket de supermercado, when termina la lectura, then se muestra una línea por producto con nombre, cantidad y ubicación (Nevera, Despensa o Congelador) ya rellenados.
- Given la cantidad del ticket es «2 x» o «0,512 kg», then se muestra como texto legible y editable («2 uds», «512 g»).
- Given líneas que no son comida (bolsas, droguería, descuentos, totales), then aparecen desmarcadas en la lista, no ocultas. Totales, IVA y formas de pago no aparecen.
- Given la lectura está en curso, then se ve un estado de carga y la Despensa no ha cambiado.

**R3**
- Given la lista, when el usuario cambia nombre, cantidad o ubicación de una línea, then el cambio se conserva hasta confirmar.
- Given una línea mal reconocida, when el usuario la desmarca, then el resto de la lista sigue pudiéndose confirmar.
- Given una línea marcada con el nombre vacío, then no se puede confirmar hasta corregirla o desmarcarla.

**R4**
- Given N líneas marcadas, when el usuario confirma, then se añaden N artículos nuevos a la Despensa con su nombre, cantidad y ubicación, aunque ya existiera uno con el mismo nombre.
- Given el usuario sale de la lista sin confirmar, then la Despensa no cambia.
- Given ninguna línea marcada, then el botón de confirmar está desactivado.

**R5**
- Given la imagen no es un ticket, es ilegible o no se detecta ningún producto, then se muestra un mensaje y las opciones «Reintentar» y «Añadir a mano».
- Given un error de red o del servidor, then se muestran las mismas opciones y la Despensa no cambia.
- Given «Añadir a mano», then se abre el formulario actual de la Despensa.

**R6**
- Given una línea abreviada que coincide con un alimento de la Base de alimentos, then el nombre propuesto es el nombre legible de ese alimento.
- Given no hay coincidencia, then se propone un nombre legible interpretado por la IA, sin abreviaturas ni marca del súper.

**R7**
- Given se acaban de añadir productos desde un ticket, then aparece «Deshacer», que quita todos los artículos de esa operación y solo esos.
- Given artículos añadidos hoy desde un ticket, then muestran el chip «Nuevo».

## Edge cases
- Ticket muy largo que no cabe en una foto: v1 lee solo lo que sale en la foto; el resto se añade con otro escaneo o a mano.
- Foto girada, con poca luz o arrugada: si no se lee, cae en R5.
- El mismo producto repetido en dos líneas del ticket: se muestran como líneas separadas; el usuario puede descartar una.
- Imagen muy grande desde la galería: debe procesarse igualmente (el límite y la compresión se deciden en el diseño técnico).
- Sin conexión: el escaneo falla con el mensaje de R5.

## Success metrics
| Metric | Baseline | Target | How measured |
|---|---|---|---|
| Líneas de comida añadidas sin corregir (nombre, cantidad y ubicación tal como se propusieron) | TBD | ≥ 80 % | Revisión manual de los primeros tickets reales |

## Risks & dependencies
- Depende de #13 (Base de alimentos), cerrado. Relacionado con #14 (escáner de códigos de barras), cerrado.
- La lectura usa Claude en el servidor (`server/app/api/*` en Vercel, como el importador de recetas); la clave nunca llega al cliente. Coste por escaneo a valorar en el diseño técnico.
- Privacidad: la foto se envía al servidor solo para leerla y no se guarda.
- Calidad de lectura con tickets reales de distintos supermercados: riesgo principal para la métrica.

## Open questions
- [ ] Tamaño máximo de imagen, compresión en el navegador y tiempo máximo de espera (diseño técnico).
- [ ] Modelo de Claude y si hace falta un OCR aparte o basta con visión (diseño técnico).
- [ ] Cómo se casa una línea con la Base de alimentos para R6 (búsqueda en servidor, la IA con una lista, u otro) (diseño técnico).
