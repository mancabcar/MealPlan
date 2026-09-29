// @vitest-environment jsdom
// Spec: docs/pm/14-escaner-codigo-barras/spec.md › R5 (error de red o límite de peticiones).
// Tech: tech.md › Risks & mitigations ("dos contadores de límite de peticiones"): useBarcodeLookup tiene su propio
// contador en sessionStorage, independiente del de useBrandSearch (misma forma que OFF_LIMIT: 10 por minuto).
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBarcodeLookup } from "@/lib/useBarcodeLookup";
import { BARRITA_AVENA, BARRITA_AVENA_CODE } from "../fixtures/foods";

const fetchMock = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("R4: búsqueda por código", () => {
  it("encontrado: pasa de loading a ok con el producto normalizado", async () => {
    fetchMock.mockResolvedValue(Response.json({ product: BARRITA_AVENA }));
    const { result } = renderHook(() => useBarcodeLookup());
    act(() => {
      void result.current.lookup(BARRITA_AVENA_CODE);
    });
    expect(result.current.state).toBe("loading");
    await waitFor(() => expect(result.current.state).toBe("ok"));
    expect(result.current.product).toEqual(BARRITA_AVENA);
  });

  it("no encontrado: pasa a not_found", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "not_found" }, { status: 404 }));
    const { result } = renderHook(() => useBarcodeLookup());
    act(() => {
      void result.current.lookup("0000000000000");
    });
    await waitFor(() => expect(result.current.state).toBe("not_found"));
  });

  it("reintentar repite la última búsqueda", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: "unavailable" }, { status: 502 }));
    const { result } = renderHook(() => useBarcodeLookup());
    act(() => {
      void result.current.lookup(BARRITA_AVENA_CODE);
    });
    await waitFor(() => expect(result.current.state).toBe("error"));

    fetchMock.mockResolvedValueOnce(Response.json({ product: BARRITA_AVENA }));
    act(() => {
      void result.current.retry();
    });
    await waitFor(() => expect(result.current.state).toBe("ok"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const lastUrl = new URL(String((fetchMock.mock.calls[1] as [string])[0]), "http://localhost");
    expect(lastUrl.searchParams.get("code")).toBe(BARRITA_AVENA_CODE);
  });
});

describe("R5: límite propio de peticiones (independiente del de búsqueda por nombre)", () => {
  it("un 429 con Retry-After bloquea la siguiente búsqueda, también tras remontar el hook", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "rate_limited", retryAfter: 25 }, { status: 429 }));
    const first = renderHook(() => useBarcodeLookup());
    act(() => {
      void first.result.current.lookup(BARRITA_AVENA_CODE);
    });
    await waitFor(() => expect(first.result.current.state).toBe("rate_limited"));
    expect(first.result.current.cooldown).toBeGreaterThan(23);
    first.unmount();

    const again = renderHook(() => useBarcodeLookup());
    expect(again.result.current.cooldown).toBeGreaterThan(23);
    act(() => {
      void again.result.current.lookup(BARRITA_AVENA_CODE);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("10 búsquedas en un minuto bloquean la 11.ª, también tras remontar", async () => {
    fetchMock.mockImplementation(async () => Response.json({ product: BARRITA_AVENA }));
    const first = renderHook(() => useBarcodeLookup());
    for (let i = 0; i < 10; i++) {
      const code = String(i).padStart(13, "0");
      act(() => {
        void first.result.current.lookup(code);
      });
      await waitFor(() => expect(first.result.current.state).toBe("ok"));
    }
    expect(first.result.current.cooldown).toBeGreaterThan(0);
    first.unmount();

    const again = renderHook(() => useBarcodeLookup());
    expect(again.result.current.cooldown).toBeGreaterThan(0);
    act(() => {
      void again.result.current.lookup(BARRITA_AVENA_CODE);
    });
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("review de #14: buscar con el límite ya activo deja el estado en rate_limited (no se queda en silencio)", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "rate_limited", retryAfter: 30 }, { status: 429 }));
    const { result } = renderHook(() => useBarcodeLookup());
    // El primer intento consume el presupuesto y activa el bloqueo (retryAfter); el segundo, inmediato, se
    // bloquea en el cliente sin llegar a llamar a fetch otra vez.
    act(() => {
      void result.current.lookup(BARRITA_AVENA_CODE);
    });
    await waitFor(() => expect(result.current.state).toBe("rate_limited"));
    fetchMock.mockClear();

    let resultado: Awaited<ReturnType<typeof result.current.lookup>> | undefined;
    await act(async () => {
      resultado = await result.current.lookup(BARRITA_AVENA_CODE);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({ state: "rate_limited", code: BARRITA_AVENA_CODE });
    expect(result.current.state).toBe("rate_limited");
  });

  it("no comparte el contador con useBrandSearch: sus claves de sessionStorage son distintas", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "rate_limited", retryAfter: 30 }, { status: 429 }));
    const { result } = renderHook(() => useBarcodeLookup());
    act(() => {
      void result.current.lookup(BARRITA_AVENA_CODE);
    });
    await waitFor(() => expect(result.current.state).toBe("rate_limited"));

    expect(sessionStorage.getItem("mp_off_searches")).toBeNull();
    expect(sessionStorage.getItem("mp_off_blocked_until")).toBeNull();
    expect(sessionStorage.getItem("mp_barcode_blocked_until")).not.toBeNull();
  });
});
