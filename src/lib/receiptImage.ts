// Reducción de la foto del ticket en el navegador (docs/pm/67-escanear-ticket/tech.md › Components & files):
// JPEG con el lado largo ≤ MAX_IMAGE_SIDE, para no pasar del límite de cuerpo de Vercel y gastar menos tokens.
import { MAX_IMAGE_BASE64, MAX_IMAGE_SIDE } from "./receiptScan";

export class ImageError extends Error {}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  return img
    .decode()
    .then(() => img)
    .catch(() => {
      throw new ImageError("No se puede leer la imagen");
    })
    .finally(() => URL.revokeObjectURL(url));
}

/** Devuelve el JPEG reducido en base64, sin el prefijo `data:`. Lanza ImageError si no se puede dibujar o no cabe. */
export async function shrinkImage(file: Blob): Promise<string> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("Sin canvas");
  // Fondo blanco: un PNG transparente no queda negro al pasar a JPEG
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.8, 0.6]) {
    const base64 = canvas.toDataURL("image/jpeg", quality).split(",")[1] ?? "";
    if (base64 && base64.length <= MAX_IMAGE_BASE64) return base64;
  }
  throw new ImageError("Imagen demasiado grande");
}
