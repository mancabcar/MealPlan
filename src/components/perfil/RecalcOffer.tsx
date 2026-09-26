"use client";

// Oferta de recalcular objetivos (onboarding-profile R16): los objetivos nunca cambian solos; se ofrecen y el usuario
// decide. La usan «Datos corporales» en Perfil y Evolución al guardar un peso nuevo (historial-medidas R10).
import type { Targets } from "@/lib/nutrition";
import type { UserProfile } from "@/lib/types";

const saveBtn = "bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-lg px-4 py-2 font-semibold text-sm disabled:opacity-40";
const cancelBtn = "rounded-lg px-4 py-2 border border-[var(--color-border)] text-sm text-[var(--color-text-muted)]";

/** Lo que cambia en el perfil al aceptar «Recalcular». */
export function recalcPatch(t: Targets): Partial<UserProfile> {
  return { calorieGoal: t.kcal, proteinGoal: t.protein, proteinRange: undefined, carbsGoal: t.carbs, fatGoal: t.fat };
}

export function RecalcOffer({
  targets,
  profile,
  onApply,
  onKeep,
}: {
  targets: Targets;
  profile: UserProfile;
  onApply: () => void;
  onKeep: () => void;
}) {
  return (
    <div
      role="status"
      className="rounded-xl border p-4 flex flex-col gap-3 text-sm"
      style={{
        borderColor: "color-mix(in oklab, var(--color-accent) 45%, var(--color-border))",
        backgroundColor: "color-mix(in oklab, var(--color-accent) 12%, var(--color-surface))",
      }}
    >
      <p>
        <span className="font-semibold">¿Recalculamos?</span> Con tus nuevos datos te sugerimos {targets.kcal} kcal y{" "}
        {targets.protein} g de proteína (ahora: {profile.calorieGoal} kcal y {profile.proteinGoal} g).
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={onApply} className={saveBtn}>
          Recalcular
        </button>
        <button type="button" onClick={onKeep} className={cancelBtn}>
          Mantener los actuales
        </button>
      </div>
    </div>
  );
}
