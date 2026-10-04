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

const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Tramos de `text` que coinciden con `query` ignorando tildes y mayúsculas, como [inicio, fin) sobre el texto ORIGINAL
 * (para resaltar «Puré» al buscar «pure»). Todas las apariciones, en orden y sin solaparse; consulta vacía → [].
 * Se compara carácter a carácter (sin regex) para poder devolver posiciones del original aunque normalizar cambie
 * la longitud: una marca combinante suelta entra en el tramo del carácter que la lleva.
 */
export function highlightRanges(text: string, query: string): Array<[number, number]> {
  const q = normalize(query);
  if (!q) return [];

  let folded = "";
  const starts: number[] = []; // por cada carácter de `folded`, dónde empieza en el original
  const ends: number[] = []; // y dónde acaba
  let index = 0;
  for (const char of text) {
    const piece = char.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
    if (piece === "" && ends.length > 0) {
      ends[ends.length - 1] = index + char.length; // marca combinante: se une al carácter anterior
    } else {
      for (let i = 0; i < piece.length; i++) {
        starts.push(index);
        ends.push(index + char.length);
      }
      folded += piece;
    }
    index += char.length;
  }

  const ranges: Array<[number, number]> = [];
  for (let at = folded.indexOf(q); at !== -1; at = folded.indexOf(q, at + q.length)) {
    ranges.push([starts[at], ends[at + q.length - 1]]);
  }
  return ranges;
}
