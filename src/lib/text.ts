// Normalización de texto compartida (alérgenos, lista de la compra): una sola versión para que
// dos comparaciones de "el mismo nombre" no discrepen por espacios o tildes.

/** Minúsculas, sin acentos, espacios colapsados. */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
