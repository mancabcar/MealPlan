// @vitest-environment jsdom
// Spec: docs/pm/21-pwa-recordatorios/spec.md › R7 (botón «Instalar app» en Perfil, Could).
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useInstallPrompt } from "@/lib/useInstallPrompt";

function fireInstallPrompt(outcome: "accepted" | "dismissed" = "accepted") {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return { prompt, event };
}

describe("R7: useInstallPrompt", () => {
  it("sin el evento del navegador, no se puede instalar (el botón no aparece)", () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
  });

  it("con beforeinstallprompt se puede instalar y se evita el aviso automático", () => {
    const { result } = renderHook(() => useInstallPrompt());
    const { event } = fireInstallPrompt();
    expect(result.current.canInstall).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it("install() lanza el aviso del navegador y después oculta el botón", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const { prompt } = fireInstallPrompt("accepted");
    await act(async () => {
      await result.current.install();
    });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(result.current.canInstall).toBe(false);
  });

  it("tras appinstalled ya no se ofrece instalar", () => {
    const { result } = renderHook(() => useInstallPrompt());
    fireInstallPrompt();
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(result.current.canInstall).toBe(false);
  });
});
