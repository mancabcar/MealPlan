// Base URL del proyecto server/ (issue #69, docs/pm/69-hosting-estatico-ionos/tech.md › APIs / interfaces).
// NEXT_PUBLIC_* queda fijado en el HTML/JS en build time: cambiarlo exige rehacer el build estático.
export function apiUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
  return `${base}${path}`;
}
