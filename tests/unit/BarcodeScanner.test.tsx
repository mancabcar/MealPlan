// @vitest-environment jsdom
// Spec: docs/pm/14-escaner-codigo-barras/spec.md › R2, R3, R6, R7, R8. Tech: tech.md › UI (BarcodeScanner).
//
// Contrato asumido para dev-code (no hay polyfill instalado aún en este worktree, por eso se mockea el módulo):
// si `window.BarcodeDetector` no existe, el componente importa "barcode-detector/side-effect" (que define
// `window.BarcodeDetector` como efecto secundario) antes de instanciarlo, para no bifurcar el código de detección.
//
// jsdom no implementa cámara, <video>.play() ni canvas: se mockean navigator.mediaDevices.getUserMedia,
// HTMLMediaElement.play, HTMLCanvasElement.getContext y requestAnimationFrame.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BarcodeScanner } from "@/components/diario/BarcodeScanner";

class FakeDetector {
  detect: (source: unknown) => Promise<{ rawValue: string }[]>;
  constructor(detect: (source: unknown) => Promise<{ rawValue: string }[]> = async () => []) {
    this.detect = detect;
  }
}

vi.mock("barcode-detector/side-effect", () => {
  (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector ??= FakeDetector;
  return {};
});

const stopTrack = vi.fn();
const fakeStream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
const getUserMedia = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  stopTrack.mockClear();
  delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
  vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia } });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    setTimeout(() => cb(performance.now()), 0);
    return 0;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("R2: apertura del visor y permiso de cámara", () => {
  it("pide la cámara trasera al montar", async () => {
    getUserMedia.mockResolvedValue(fakeStream);
    render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: expect.objectContaining({ facingMode: "environment" }) })),
    );
  });

  it("con BarcodeDetector nativo, no importa el polyfill", async () => {
    (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector = FakeDetector;
    getUserMedia.mockResolvedValue(fakeStream);
    render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    // Sigue siendo la misma clase nativa, no ha sido sustituida por el mock del polyfill de otra forma
    expect((window as unknown as { BarcodeDetector: unknown }).BarcodeDetector).toBe(FakeDetector);
  });

  it("sin BarcodeDetector nativo, carga el polyfill antes de escanear", async () => {
    getUserMedia.mockResolvedValue(fakeStream);
    render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect((window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector).toBe(FakeDetector));
  });
});

describe("R3 · R8: detección", () => {
  it("al detectar un código válido, lo entrega una sola vez y cierra el visor", async () => {
    let calls = 0;
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class extends FakeDetector {
      constructor() {
        super(async () => {
          calls++;
          return calls === 1 ? [] : [{ rawValue: "8410000123456" }];
        });
      }
    };
    getUserMedia.mockResolvedValue(fakeStream);
    const onDetected = vi.fn();
    const onClose = vi.fn();
    render(<BarcodeScanner onDetected={onDetected} onClose={onClose} />);

    await waitFor(() => expect(onDetected).toHaveBeenCalledWith("8410000123456"));
    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(stopTrack).toHaveBeenCalled();
  });
});

describe("R6: permiso denegado o sin cámara", () => {
  it("muestra el aviso y un botón para escribir el código, sin llamar a onDetected", async () => {
    getUserMedia.mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"));
    const onDetected = vi.fn();
    const onClose = vi.fn();
    render(<BarcodeScanner onDetected={onDetected} onClose={onClose} />);

    await screen.findByText("No se ha podido acceder a la cámara");
    const btn = screen.getByRole("button", { name: "Escribe el código" });
    fireEvent.click(btn);
    expect(onClose).toHaveBeenCalled();
    expect(onDetected).not.toHaveBeenCalled();
  });
});

describe("R7: cerrar sin escanear", () => {
  it("Escape cierra el visor, para la cámara y no entrega ningún código", async () => {
    getUserMedia.mockResolvedValue(fakeStream);
    const onDetected = vi.fn();
    const onClose = vi.fn();
    render(<BarcodeScanner onDetected={onDetected} onClose={onClose} />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalled();
    expect(onDetected).not.toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalled();
  });
});
