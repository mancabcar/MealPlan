// CORS (docs/pm/69-hosting-estatico-ionos/tech.md › APIs / interfaces): el front estático de IONOS
// (CORS_ALLOWED_ORIGIN) es el único origen autorizado a llamar a estas rutas desde el navegador.
import { NextResponse } from "next/server";

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = process.env.CORS_ALLOWED_ORIGIN;
  if (!allowed || origin !== allowed) return {};
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/** Añade las cabeceras CORS a una respuesta ya construida por la ruta. */
export function withCors(request: Request, response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(corsHeaders(request.headers.get("origin")))) {
    response.headers.set(key, value);
  }
  return response;
}

/** Respuesta al preflight `OPTIONS` que manda el navegador antes de la petición real. */
export function preflight(request: Request): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}
