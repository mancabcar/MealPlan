// Datos de prueba de «Escanear ticket» (docs/pm/67-escanear-ticket/spec.md). Inventados, con el aspecto de un ticket
// de supermercado español. Los usan tests/unit/receipt-scan.test.ts, server/tests/unit/pantry-receipt-route.test.ts
// y tests/e2e/escanear-ticket.spec.ts.

/** Líneas tal como las devuelve la ruta (ya limpias por Claude). */
export const RECEIPT_LINES = [
  { name: "Yogur griego", quantity: "4 uds", category: "Nevera", isFood: true },
  { name: "Pechuga de pollo", quantity: "512 g", category: "Nevera", isFood: true },
  { name: "Arroz basmati", quantity: "1 kg", category: "Despensa", isFood: true },
  { name: "Guisantes congelados", quantity: "1 bolsa", category: "Congelador", isFood: true },
  { name: "Bolsa de plástico", quantity: "1 ud", category: "Despensa", isFood: false },
] as const;

/** Respuesta de Claude tal cual (texto con JSON) para las líneas de arriba. */
export const CLAUDE_REPLY = JSON.stringify({ lines: RECEIPT_LINES });

/** Respuesta de la ruta con éxito. */
export const RESPONSE_OK = { lines: RECEIPT_LINES };

/** Textos de error acordados (spec R5). La ruta devuelve `{ error, message }` con estos textos y estados. */
export const ERROR_TEXTS = {
  unauthorized: "Inicia sesión para escanear tickets.",
  rate_limited: "Has escaneado muchos tickets seguidos. Espera unos minutos.",
  invalid_image: "La imagen no es válida o es demasiado grande.",
  unreadable: "No se ha podido leer el ticket. Prueba con otra foto, con buena luz y el ticket entero.",
  ai_failed: "No se ha podido procesar el ticket. Inténtalo de nuevo.",
} as const;

export const ERROR_STATUS = {
  unauthorized: 401,
  rate_limited: 429,
  invalid_image: 400,
  unreadable: 422,
  ai_failed: 502,
} as const;

/** Límite del base64 de la imagen en la ruta (tech.md › APIs: 4 MB, por debajo del límite de ~4,5 MB de Vercel). */
export const MAX_IMAGE_BASE64 = 4 * 1024 * 1024;

/** Base64 corto con cabecera JPEG, para los tests de la ruta (la ruta no decodifica la imagen: solo la reenvía a Claude). */
export const TINY_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=";
