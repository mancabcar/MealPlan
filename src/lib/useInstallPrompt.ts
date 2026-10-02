"use client";

// Instalación de la PWA desde un botón (issue #21 R7, docs/pm/21-pwa-recordatorios). Chrome/Edge lanzan
// `beforeinstallprompt`; Safari en iPhone no, así que allí `canInstall` se queda en false y no se ofrece botón.
import { useCallback, useEffect, useRef, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<void> } {
  const deferred = useRef<InstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault(); // sin esto el navegador muestra su propio aviso, sin que Perfil lo controle
      deferred.current = event as InstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      deferred.current = null;
      setCanInstall(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const event = deferred.current;
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    // El evento solo se puede usar una vez, se acepte o no: hasta que el navegador lance otro, no hay botón
    deferred.current = null;
    setCanInstall(false);
  }, []);

  return { canInstall, install };
}
