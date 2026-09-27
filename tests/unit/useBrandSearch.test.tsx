// @vitest-environment jsdom
// Spec: docs/pm/13-base-alimentos/spec.md › R12 (límite de búsquedas en OFF).
// Review de #13 (docs/pm/13-base-alimentos/review.md): el Retry-After de un 429 de OFF no se perdía al recargar.
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBrandSearch } from "@/lib/useBrandSearch";

const fetchMock = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("R12: cuenta atrás del límite de OFF", () => {
  it("un 429 con Retry-After bloquea la búsqueda, también tras recargar (remontar el hook)", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "rate_limited", retryAfter: 30 }, { status: 429 }));
    const first = renderHook(() => useBrandSearch());
    act(() => first.result.current.search("yogur griego"));
    await waitFor(() => expect(first.result.current.state).toBe("rate_limited"));
    expect(first.result.current.cooldown).toBeGreaterThan(28);
    first.unmount();

    const again = renderHook(() => useBrandSearch());
    expect(again.result.current.cooldown).toBeGreaterThan(28);
    act(() => again.result.current.search("yogur griego"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("10 búsquedas en un minuto bloquean la 11.ª, también tras remontar", async () => {
    fetchMock.mockImplementation(async () => Response.json({ products: [] }));
    const first = renderHook(() => useBrandSearch());
    for (let i = 0; i < 10; i++) {
      act(() => first.result.current.search(`yogur ${i}`));
      await waitFor(() => expect(first.result.current.state).toBe("ok"));
    }
    expect(first.result.current.cooldown).toBeGreaterThan(0);
    first.unmount();

    const again = renderHook(() => useBrandSearch());
    expect(again.result.current.cooldown).toBeGreaterThan(0);
    act(() => again.result.current.search("yogur 10"));
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });
});
