"use client";

// Visor de escaneo (docs/pm/14-escaner-codigo-barras/tech.md › UI, R2, R3, R6, R7, R8): pide la cámara trasera,
// usa BarcodeDetector nativo si existe o el polyfill "barcode-detector/side-effects" si no (misma interfaz, sin
// bifurcar el código), y llama a detect() sobre el <video> en cada frame (acepta HTMLVideoElement directamente,
// sin canvas intermedio). Al primer código válido, para la cámara y lo entrega una sola vez.
import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";

interface DetectedCode {
  rawValue: string;
}

interface Detector {
  detect: (source: HTMLVideoElement) => Promise<DetectedCode[]>;
}

function getBarcodeDetector(): (new () => Detector) | undefined {
  return (window as unknown as { BarcodeDetector?: new () => Detector }).BarcodeDetector;
}

export function BarcodeScanner({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [denied, setDenied] = useState(false);
  // onDetected suele ser una flecha nueva en cada render del padre: se lee por ref para no reiniciar la cámara
  // en cada render (review de #14: reinicio en bucle mientras el padre se re-renderiza, p. ej. por la cuenta
  // atrás del límite de peticiones), igual que Sheet.tsx hace con onClose.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  });

  useEffect(() => {
    let cancelled = false;
    let detected = false;
    let stream: MediaStream | null = null;
    let frame = 0;

    function stop() {
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    }

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("sin cámara");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        let BarcodeDetectorCtor = getBarcodeDetector();
        if (!BarcodeDetectorCtor) {
          await import("barcode-detector/side-effects");
          BarcodeDetectorCtor = getBarcodeDetector();
        }
        if (!BarcodeDetectorCtor) throw new Error("sin BarcodeDetector");
        const detector = new BarcodeDetectorCtor();

        const loop = async () => {
          if (cancelled || detected) return;
          try {
            const codes = await detector.detect(video);
            // Vuelve a comprobarse tras el await: el visor pudo cerrarse mientras detect() estaba en curso
            // (review de #14: un código no debe entregarse después de cancelar el escaneo).
            if (codes.length > 0 && !cancelled && !detected) {
              detected = true;
              stop();
              onDetectedRef.current(codes[0].rawValue);
              return;
            }
          } catch {
            // Frame ilegible: se ignora, se reintenta en el siguiente
          }
          if (!cancelled && !detected) frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
      } catch {
        if (!cancelled) setDenied(true);
      }
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  return (
    <Sheet title="Escanear código" onClose={onClose}>
      {denied ? (
        <div className="flex flex-col gap-3 text-sm">
          <p className="font-semibold">No se ha podido acceder a la cámara</p>
          <p className="text-[var(--color-text-muted)]">Puedes escribir el código a mano en su lugar.</p>
          <button
            type="button"
            onClick={onClose}
            className="self-start min-h-11 px-4 rounded-lg border border-[var(--color-accent)] text-[var(--color-accent)] font-semibold"
          >
            Escribe el código
          </button>
        </div>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg bg-black aspect-[3/4]" />
      )}
    </Sheet>
  );
}
