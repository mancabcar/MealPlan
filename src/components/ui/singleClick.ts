import type { MouseEvent } from "react";

// Registrar y borrar ignoran el segundo clic de un doble toque (detail > 1): tras el primero la fila cambia
// (la pendiente pasa a entrada con ✕, o "Registrar todo el día" desaparece y las tarjetas suben) y el segundo
// caería sobre otro botón. Un toque suelto siempre tiene detail 1.
export const singleClick = (action: () => void) => (ev: MouseEvent) => {
  if (ev.detail > 1) return;
  action();
};
