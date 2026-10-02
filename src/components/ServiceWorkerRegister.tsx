"use client";

import { useEffect } from "react";

/**
 * Registra el service worker de la PWA (issue #21, docs/pm/21-pwa-recordatorios/tech.md). Solo en el build de
 * producción: `next dev` no genera /sw.js y una caché de desarrollo estorbaría. updateViaCache "none" hace que
 * el navegador no reutilice un sw.js viejo de la caché HTTP de Apache al buscar versiones nuevas.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sin service worker la app sigue funcionando; solo se pierde el modo sin conexión.
    });
  }, []);

  return null;
}
