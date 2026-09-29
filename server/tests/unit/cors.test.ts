// Tech: docs/pm/69-hosting-estatico-ionos/tech.md › APIs / interfaces (CORS) y Risks & mitigations.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { preflight, withCors } from "../../lib/cors";

const ALLOWED = "https://home-5021533470.app-ionos.space";
const request = (origin: string | null) =>
  new Request("http://localhost/api/recipes", { headers: origin ? { origin } : {} });

beforeEach(() => {
  process.env.CORS_ALLOWED_ORIGIN = ALLOWED;
});
afterEach(() => {
  delete process.env.CORS_ALLOWED_ORIGIN;
});

describe("withCors", () => {
  it("añade Access-Control-Allow-Origin cuando el origen coincide con CORS_ALLOWED_ORIGIN", () => {
    const res = withCors(request(ALLOWED), NextResponse.json({ ok: true }));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED);
  });

  it("no añade la cabecera con un origen distinto", () => {
    const res = withCors(request("https://otro-origen.example"), NextResponse.json({ ok: true }));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("no añade la cabecera sin cabecera Origin", () => {
    const res = withCors(request(null), NextResponse.json({ ok: true }));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("no añade la cabecera si CORS_ALLOWED_ORIGIN no está configurado", () => {
    delete process.env.CORS_ALLOWED_ORIGIN;
    const res = withCors(request(ALLOWED), NextResponse.json({ ok: true }));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("preflight", () => {
  it("responde 204 con las cabeceras CORS cuando el origen coincide", () => {
    const res = preflight(request(ALLOWED));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  it("responde 204 sin cabeceras CORS con un origen distinto", () => {
    const res = preflight(request("https://otro-origen.example"));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
