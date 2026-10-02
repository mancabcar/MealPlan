"use client";

// Instalación de la PWA desde un botón (issue #21 R7, docs/pm/21-pwa-recordatorios). Chrome/Edge lanzan
// `beforeinstallprompt` una sola vez, poco después de cargar: por eso el evento se captura a nivel de módulo
// (lo importa InstallPromptCapture, montado en el layout) y no dentro del hook, que solo vive mientras Perfil
// está abierto. Safari en iPhone no lo lanza: allí `canInstall` se queda en false y no se ofrece botón.
import { useSyncExternalStore } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPromptEvent | null = null;
let listening = false;
const subscribers = new Set<() => void>();

function setDeferred(event: InstallPromptEvent | null) {
  deferred = event;
  subscribers.forEach((notify) => notify());
}

/** Idempotente: empieza a escuchar el evento del navegador (una sola vez por carga de la app). */
export function captureInstallPrompt() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // sin esto el navegador muestra su propio aviso, sin que Perfil lo controle
    setDeferred(event as InstallPromptEvent);
  });
  window.addEventListener("appinstalled", () => setDeferred(null));
}

captureInstallPrompt();

function subscribe(notify: () => void) {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<void> } {
  const canInstall = useSyncExternalStore(
    subscribe,
    () => deferred !== null,
    () => false,
  );

  const install = async () => {
    const event = deferred;
    if (!event) return;
    // El evento solo se puede usar una vez, se acepte o no: hasta que el navegador lance otro, no hay botón
    setDeferred(null);
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      // prompt() rechaza si el evento ya se usó o no hubo gesto válido: no hay nada que hacer, el botón ya no está
    }
  };

  return { canInstall, install };
}
