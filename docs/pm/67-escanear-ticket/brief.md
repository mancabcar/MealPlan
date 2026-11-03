# Escanear un ticket de compra para actualizar la Despensa
_Status: tests · Updated: 2026-11-03 · Issue: [#67](https://github.com/mancabcar/MealPlan/issues/67) · Spec: [spec.md](spec.md) · Tech: [tech.md](tech.md)_

_Entrada en el pipeline: resumen del issue confirmado por el usuario; se saltan brainstorm completo y prototype (la lista de revisión se parece a pantallas que ya existen) y se entra en spec._

## Follow-ups
- Ticket largo en varias fotos (la v1 lee una foto por escaneo). (spec)
- Sumar cantidades a productos que ya están en la Despensa (la v1 crea siempre un artículo nuevo). (spec)
- Marcar como comprados en la lista de la compra los productos del ticket. (spec)

## Problem
Después de la compra, añadir a mano cada producto a la Despensa es lento, y el ticket ya contiene la lista de lo comprado.

## Success looks like
- Con una foto del ticket (cámara o galería) la Despensa se actualiza en lugar de producto a producto.
- Nada entra en la Despensa sin pasar por una lista editable que el usuario confirma.
- Un ticket ilegible o una línea no reconocida no bloquea: se reintenta, se edita o se introduce a mano.

## Constraints & assumptions
- Depende de #13 (Base de alimentos), ya cerrado; relacionado con #14 (escáner de código de barras), ya cerrado.
- Front estático en IONOS; las rutas de servidor viven en Vercel (`server/app/api/*`). La llamada a Claude va en el servidor; la clave nunca llega al cliente. Patrón existente: el importador de recetas (`server/app/api/recipes/import`).
- Claude lee imágenes directamente, así que quizá no haga falta un OCR aparte (a decidir en el diseño técnico).

## Recommended bet
Botón «Escanear ticket» en la Despensa → foto con la cámara o imagen de la galería → Claude interpreta las líneas y las casa con la Base de alimentos → lista editable (nombre, cantidad) → al confirmar se añaden o incrementan los productos en la Despensa.

Criterios de aceptación del issue:
- Se inicia con la cámara o con una imagen de la galería.
- Tras procesar, se muestra una lista editable antes de tocar la Despensa.
- Confirmar añade (o incrementa) los productos en la Despensa.
- Una línea no reconocida se edita o descarta sin bloquear el resto.
- Un ticket ilegible o con error permite reintentar o introducir los productos a mano.
