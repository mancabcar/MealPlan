// @vitest-environment jsdom
// Spec: docs/pm/55-mis-alimentos/spec.md › R11 («Guardado en Favoritos · Deshacer» se queda hasta cerrar «Añadir
// comida») y R5. Tech: tech.md › Components & files: `Toast` con `durationMs={null}` no se cierra solo.
// Falla hasta la tarea 3 del tech design.
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toast } from "@/components/ui/Toast";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Toast sin temporizador (R11)", () => {
  it("con durationMs={null} no llama a onDismiss aunque pase mucho tiempo", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <Toast onDismiss={onDismiss} durationMs={null}>
        Guardado en Favoritos
      </Toast>,
    );
    act(() => vi.advanceTimersByTime(10 * 60_000));
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("Guardado en Favoritos");
  });

  it("por defecto sigue cerrándose a los 10 s", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast onDismiss={onDismiss}>Añadido</Toast>);
    act(() => vi.advanceTimersByTime(10_000));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
