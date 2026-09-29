// @vitest-environment jsdom
// Spec: docs/pm/14-escaner-codigo-barras/spec.md › R2, R3, R6, R7, R8. Tech: tech.md › UI (BarcodeScanner).
//
// Contrato: si `window.BarcodeDetector` no existe, el componente importa "barcode-detector/side-effects" (que
// define `window.BarcodeDetector` como efecto secundario si falta) antes de instanciarlo, para no bifurcar el
// código de detección entre nativo y polyfill. El módulo se mockea aquí para no cargar el WASM real en los tests.
//
// jsdom no implementa cámara ni <video>.play(): se mockean navigator.mediaDevices.getUserMedia,
// HTMLMediaElement.play y requestAnimationFrame. detect() recibe el <video> directamente (BarcodeDetector acepta
// HTMLVideoElement), sin canvas intermedio.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BarcodeScanner } from "@/components/diario/BarcodeScanner";

class FakeDetector {
  detect: (source: unknown) => Promise<{ rawValue: string }[]>;
  constructor(detect: (source: unknown) => Promise<{ rawValue: string }[]> = async () => []) {
    this.detect = detect;
  }
}

vi.mock("barcode-detector/side-effects", () => {
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
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    setTimeout(() => cb(performance.now()), 0);
    return 0;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("R2: apertura del visor y permiso de cámara", () => {
  // El import dinámico del polyfill se cachea por módulo tras la primera vez que se resuelve en el archivo, así
  // que solo este primer test (sin BarcodeDetector nativo al montar) ejercita de verdad la carga perezosa; los
  // demás tests no dependen de ese orden porque fijan `window.BarcodeDetector` ellos mismos antes de renderizar.
  it("sin BarcodeDetector nativo, pide la cámara trasera y carga el polyfill antes de escanear", async () => {
    getUserMedia.mockResolvedValue(fakeStream);
    render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: expect.objectContaining({ facingMode: "environment" }) })),
    );
    await waitFor(() => expect((window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector).toBe(FakeDetector));
  });

  it("con BarcodeDetector nativo, no importa el polyfill", async () => {
    (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector = FakeDetector;
    getUserMedia.mockResolvedValue(fakeStream);
    render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    // Sigue siendo la misma clase nativa, no ha sido sustituida por el mock del polyfill de otra forma
    expect((window as unknown as { BarcodeDetector: unknown }).BarcodeDetector).toBe(FakeDetector);
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
  it("Escape llama a onClose sin entregar ningún código; al desmontar (como hace el padre al cerrar) para la cámara", async () => {
    getUserMedia.mockResolvedValue(fakeStream);
    const onDetected = vi.fn();
    const onClose = vi.fn();
    const { unmount } = render(<BarcodeScanner onDetected={onDetected} onClose={onClose} />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalled();
    expect(onDetected).not.toHaveBeenCalled();

    unmount();
    expect(stopTrack).toHaveBeenCalled();
  });
});

describe("review de #14: la cámara no se reinicia si onDetected cambia de identidad", () => {
  it("re-renderizar con una nueva función onDetected no vuelve a pedir la cámara", async () => {
    getUserMedia.mockResolvedValue(fakeStream);
    const { rerender } = render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));

    // Como en FoodPicker: una flecha nueva en cada render (p. ej. por la cuenta atrás del límite de peticiones)
    for (let i = 0; i < 3; i++) {
      rerender(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    }
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(stopTrack).not.toHaveBeenCalled();
  });

  it("un código detectado después de la última función onDetected pasada se entrega con esa, no con la primera", async () => {
    let resolveDetect!: (codes: { rawValue: string }[]) => void;
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class extends FakeDetector {
      constructor() {
        super(() => new Promise((resolve) => (resolveDetect = resolve)));
      }
    };
    getUserMedia.mockResolvedValue(fakeStream);
    const firstOnDetected = vi.fn();
    const secondOnDetected = vi.fn();
    const { rerender } = render(<BarcodeScanner onDetected={firstOnDetected} onClose={vi.fn()} />);
    await waitFor(() => expect(resolveDetect).toBeDefined());
    rerender(<BarcodeScanner onDetected={secondOnDetected} onClose={vi.fn()} />);

    await act(async () => {
      resolveDetect([{ rawValue: "8410000123456" }]);
    });
    expect(secondOnDetected).toHaveBeenCalledWith("8410000123456");
    expect(firstOnDetected).not.toHaveBeenCalled();
  });
});

describe("review de #14: no se entrega un código tras cerrar el visor a mitad de un detect() en curso", () => {
  it("si detect() resuelve con un código después de desmontar, onDetected no se llama", async () => {
    let resolveDetect!: (codes: { rawValue: string }[]) => void;
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class extends FakeDetector {
      constructor() {
        super(() => new Promise((resolve) => (resolveDetect = resolve)));
      }
    };
    getUserMedia.mockResolvedValue(fakeStream);
    const onDetected = vi.fn();
    const { unmount } = render(<BarcodeScanner onDetected={onDetected} onClose={vi.fn()} />);
    await waitFor(() => expect(resolveDetect).toBeDefined());

    unmount();
    await act(async () => {
      resolveDetect([{ rawValue: "8410000123456" }]);
    });
    expect(onDetected).not.toHaveBeenCalled();
  });
});
