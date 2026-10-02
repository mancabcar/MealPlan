// @vitest-environment jsdom
// Bug: si el servidor respondía un error sin cuerpo JSON con `error` (p. ej. un 500 vacío), el registro mostraba
// «Algo ha fallado» sin más. Contrato: el mensaje incluye el estado HTTP para poder diagnosticarlo.
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/lib/auth";

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

async function registerError(response: Response): Promise<string> {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  const { result } = renderHook(() => useAuth(), { wrapper });
  let message = "";
  await act(async () => {
    await result.current.register("lucia", "secreto123", "codigo", true, null).catch((e: Error) => {
      message = e.message;
    });
  });
  return message;
}

describe("registro: errores del servidor sin mensaje", () => {
  it("un 500 vacío indica el estado en vez de «Algo ha fallado»", async () => {
    const message = await registerError(new Response("", { status: 500 }));
    expect(message).not.toBe("Algo ha fallado");
    expect(message).toContain("500");
  });

  it("una página HTML de error (404 de un hosting) también indica el estado", async () => {
    const message = await registerError(new Response("<html>Not found</html>", { status: 404 }));
    expect(message).toContain("404");
  });

  it("si el servidor manda su mensaje, se muestra tal cual", async () => {
    const message = await registerError(
      new Response(JSON.stringify({ error: "Código de invitación incorrecto" }), { status: 403 }),
    );
    expect(message).toBe("Código de invitación incorrecto");
  });
});
