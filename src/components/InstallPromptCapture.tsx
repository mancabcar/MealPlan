"use client";

import { useEffect } from "react";
import { captureInstallPrompt } from "@/lib/useInstallPrompt";

/**
 * Guarda el evento de instalación del navegador desde el primer momento, para que Perfil pueda ofrecer el botón
 * aunque el evento llegara antes de abrirlo (issue #21 R7). Al importar el módulo ya se empieza a escuchar; el efecto
 * solo asegura que no se elimine esa importación.
 */
export default function InstallPromptCapture() {
  useEffect(() => {
    captureInstallPrompt();
  }, []);
  return null;
}
