"use client";

import { useId, useState, type ReactNode } from "react";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { ALLERGEN_LABELS } from "@/lib/allergens";
import { withoutAllergies } from "@/lib/migrate";
import { ageFromBirthYear, calculateTargets, parseDecimal, PROTEIN_G_PER_KG, type Targets } from "@/lib/nutrition";
import {
  bodyDraftFrom,
  macroDraftFrom,
  parseBody,
  parseMacros,
  parsePrescribed,
  prescribedDraftFrom,
  type MacroDraft,
} from "@/lib/profileDraft";
import { MEAL_TYPE_ICONS, type BodyData, type UserProfile } from "@/lib/types";
import {
  ACTIVITY_OPTIONS,
  AllergyDietDislikes,
  BodyDataForm,
  DIET_OPTIONS,
  GOAL_OPTIONS,
  GoalPicker,
  MacroFields,
  MealSlotPicker,
  PrescribedTargetsForm,
  SEX_OPTIONS,
  SOURCE_LABELS,
  SuggestedTargets,
  type Preferences,
} from "@/components/profile/steps";
import { Field, inputCls } from "@/components/profile/ui";

type Update = (patch: Partial<UserProfile>) => void;

const smallBtn = "text-sm font-semibold text-emerald-600 dark:text-emerald-400";
const saveBtn = "bg-emerald-600 text-white rounded-lg px-4 py-2 font-semibold text-sm disabled:opacity-40";
const cancelBtn = "rounded-lg px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-sm";

/** Sección con nombre accesible (región) y su propio "Editar". */
function Section({
  title,
  badge,
  editing,
  onEdit,
  children,
}: {
  title: string;
  badge?: ReactNode;
  editing: boolean;
  onEdit: () => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="font-semibold flex items-center gap-2">
          {title}
          {badge}
        </h2>
        {!editing && (
          <button type="button" onClick={onEdit} className={smallBtn}>
            Editar
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function SaveBar({ onSave, onCancel, disabled }: { onSave: () => void; onCancel: () => void; disabled?: boolean }) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={onSave} disabled={disabled} className={saveBtn}>
        Guardar
      </button>
      <button type="button" onClick={onCancel} className={cancelBtn}>
        Cancelar
      </button>
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex justify-between text-sm">
    <span className="text-zinc-500">{label}</span>
    <span>{value}</span>
  </div>
);

// ---------------------------------------------------------------- Tu objetivo

function GoalSection({ profile, update }: { profile: UserProfile; update: Update }) {
  const [draft, setDraft] = useState<{ name: string; goal: UserProfile["goal"] } | null>(null);
  return (
    <Section title="Tu objetivo" editing={!!draft} onEdit={() => setDraft({ name: profile.name, goal: profile.goal })}>
      {draft ? (
        <>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Nombre
            <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <GoalPicker value={draft.goal} onChange={(goal) => setDraft({ ...draft, goal })} />
          <SaveBar
            disabled={!draft.name.trim()}
            onCancel={() => setDraft(null)}
            onSave={() => {
              update({ name: draft.name.trim(), goal: draft.goal });
              setDraft(null);
            }}
          />
        </>
      ) : (
        <>
          <Row label="Nombre" value={profile.name} />
          <Row label="Objetivo" value={GOAL_OPTIONS.find((g) => g.value === profile.goal)?.label} />
        </>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- Objetivos diarios (R13, R15)

type TargetsMode =
  | { kind: "view" }
  | { kind: "editCalculated"; draft: MacroDraft }
  | { kind: "editPrescribed"; draft: ReturnType<typeof prescribedDraftFrom> }
  | { kind: "calcBody"; draft: ReturnType<typeof bodyDraftFrom> }
  | { kind: "calcSuggested"; body: BodyData; targets: Targets; draft: MacroDraft };

function TargetsSection({ profile, update }: { profile: UserProfile; update: Update }) {
  const [mode, setMode] = useState<TargetsMode>({ kind: "view" });
  const view = () => setMode({ kind: "view" });

  const badge = (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        profile.targetSource === "calculated"
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
      }`}
    >
      {profile.targetSource === "calculated" ? "Calculado" : "De tu nutricionista"}
    </span>
  );

  const edit = () =>
    setMode(
      profile.targetSource === "calculated"
        ? {
            kind: "editCalculated",
            draft: macroDraftFrom({
              kcal: profile.calorieGoal,
              protein: profile.proteinGoal,
              carbs: profile.carbsGoal,
              fat: profile.fatGoal,
            }),
          }
        : { kind: "editPrescribed", draft: prescribedDraftFrom(profile) },
    );

  let content: ReactNode;
  switch (mode.kind) {
    case "view":
      content = (
        <>
          <Row label="Calorías" value={`${profile.calorieGoal} kcal`} />
          <Row
            label="Proteínas"
            value={profile.proteinRange ? `${profile.proteinRange.min}–${profile.proteinRange.max} g` : `${profile.proteinGoal} g`}
          />
          <Row label="Carbohidratos" value={`${profile.carbsGoal} g`} />
          <Row label="Grasas" value={`${profile.fatGoal} g`} />
          {/* Cambiar de origen (R13): al plan se pasa con las cifras actuales; al cálculo, con los datos guardados */}
          <button
            type="button"
            className={`${smallBtn} self-start`}
            onClick={() =>
              profile.targetSource === "calculated"
                ? setMode({ kind: "editPrescribed", draft: prescribedDraftFrom(profile) })
                : setMode({
                    kind: "calcBody",
                    draft: profile.body
                      ? bodyDraftFrom(profile.body)
                      : { ...bodyDraftFrom(), weightKg: profile.weightKg ? String(profile.weightKg) : "" },
                  })
            }
          >
            {profile.targetSource === "calculated" ? SOURCE_LABELS.prescribed : SOURCE_LABELS.calculated}
          </button>
        </>
      );
      break;

    case "editCalculated": {
      const macros = parseMacros(mode.draft);
      content = (
        <>
          <MacroFields value={mode.draft} onChange={(draft) => setMode({ ...mode, draft })} />
          <SaveBar
            disabled={!macros}
            onCancel={view}
            onSave={() => {
              if (!macros) return;
              update({ calorieGoal: macros.kcal, proteinGoal: macros.protein, carbsGoal: macros.carbs, fatGoal: macros.fat });
              view();
            }}
          />
        </>
      );
      break;
    }

    case "editPrescribed": {
      const { value } = parsePrescribed(mode.draft);
      content = (
        <>
          <PrescribedTargetsForm value={mode.draft} onChange={(draft) => setMode({ ...mode, draft })} />
          <SaveBar
            disabled={!value}
            onCancel={view}
            onSave={() => {
              if (!value) return;
              update({ ...value, targetSource: "prescribed" });
              view();
            }}
          />
        </>
      );
      break;
    }

    case "calcBody": {
      const body = parseBody(mode.draft).value;
      content = (
        <>
          <BodyDataForm value={mode.draft} onChange={(draft) => setMode({ ...mode, draft })} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!body}
              className={saveBtn}
              onClick={() => {
                if (!body) return;
                const targets = calculateTargets({ ...body, goal: profile.goal });
                setMode({ kind: "calcSuggested", body, targets, draft: macroDraftFrom(targets) });
              }}
            >
              Calcular mis objetivos
            </button>
            <button type="button" onClick={view} className={cancelBtn}>
              Cancelar
            </button>
          </div>
        </>
      );
      break;
    }

    case "calcSuggested": {
      const macros = parseMacros(mode.draft);
      content = (
        <>
          <SuggestedTargets
            value={mode.draft}
            onChange={(draft) => setMode({ ...mode, draft })}
            derivation={mode.targets.derivation}
            suggestedKcal={mode.targets.kcal}
            proteinPerKg={PROTEIN_G_PER_KG[profile.goal]}
            activity={mode.body.activity}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!macros}
              className={saveBtn}
              onClick={() => {
                if (!macros) return;
                update({
                  targetSource: "calculated",
                  body: mode.body,
                  weightKg: undefined,
                  calorieGoal: macros.kcal,
                  proteinGoal: macros.protein,
                  proteinRange: undefined,
                  carbsGoal: macros.carbs,
                  fatGoal: macros.fat,
                });
                view();
              }}
            >
              Usar estos objetivos
            </button>
            <button type="button" onClick={view} className={cancelBtn}>
              Cancelar
            </button>
          </div>
        </>
      );
      break;
    }
  }

  return (
    <Section title="Objetivos diarios" badge={badge} editing={mode.kind !== "view"} onEdit={edit}>
      {content}
    </Section>
  );
}

// ---------------------------------------------------------------- Datos corporales

function BodySection({ profile, update }: { profile: UserProfile; update: Update }) {
  // Con objetivos del nutricionista y sin datos completos, solo se guarda el peso
  const weightOnly = profile.targetSource === "prescribed" && !profile.body;
  const [bodyDraft, setBodyDraft] = useState<ReturnType<typeof bodyDraftFrom> | null>(null);
  const [weightDraft, setWeightDraft] = useState<string | null>(null);
  const editing = bodyDraft !== null || weightDraft !== null;
  const cancel = () => {
    setBodyDraft(null);
    setWeightDraft(null);
  };

  const b = profile.body;
  const weight = b?.weightKg ?? profile.weightKg;

  let content: ReactNode;
  if (weightDraft !== null) {
    const w = weightDraft.trim() === "" ? undefined : parseDecimal(weightDraft);
    const invalid = w !== undefined && !(w >= 30 && w <= 250);
    content = (
      <>
        <Field label="Peso (kg)" inputMode="decimal" value={weightDraft} onChange={setWeightDraft} error={invalid ? "Entre 30 y 250 kg" : undefined} />
        <SaveBar
          disabled={invalid}
          onCancel={cancel}
          onSave={() => {
            update({ weightKg: w });
            cancel();
          }}
        />
      </>
    );
  } else if (bodyDraft !== null) {
    const body = parseBody(bodyDraft).value;
    content = (
      <>
        <BodyDataForm value={bodyDraft} onChange={setBodyDraft} />
        <SaveBar
          disabled={!body}
          onCancel={cancel}
          onSave={() => {
            if (!body) return;
            update(profile.targetSource === "prescribed" ? { body, weightKg: body.weightKg } : { body });
            cancel();
          }}
        />
      </>
    );
  } else if (b) {
    content = (
      <>
        <Row label="Sexo" value={SEX_OPTIONS.find((s) => s.value === b.sex)?.label} />
        <Row label="Edad" value={`${ageFromBirthYear(b.birthYear)} años (${b.birthYear})`} />
        <Row label="Altura" value={`${b.heightCm} cm`} />
        <Row label="Peso" value={`${b.weightKg} kg`} />
        <Row label="Actividad" value={ACTIVITY_OPTIONS.find((a) => a.value === b.activity)?.label} />
      </>
    );
  } else {
    content = <Row label="Peso" value={weight ? `${weight} kg` : "—"} />;
  }

  return (
    <Section
      title="Datos corporales"
      editing={editing}
      onEdit={() =>
        weightOnly ? setWeightDraft(weight ? String(weight) : "") : setBodyDraft(bodyDraftFrom(profile.body))
      }
    >
      {content}
    </Section>
  );
}

// ---------------------------------------------------------------- Comidas del día

function MealsSection({ profile, update }: { profile: UserProfile; update: Update }) {
  const [draft, setDraft] = useState<UserProfile["meals"] | null>(null);
  return (
    <Section title="Comidas del día" editing={!!draft} onEdit={() => setDraft(profile.meals)}>
      {draft ? (
        <>
          <MealSlotPicker value={draft} onChange={setDraft} />
          <SaveBar
            disabled={draft.length === 0}
            onCancel={() => setDraft(null)}
            onSave={() => {
              update({ meals: draft });
              setDraft(null);
            }}
          />
        </>
      ) : (
        <ul className="flex flex-wrap gap-2 text-sm">
          {profile.meals.map((m) => (
            <li key={m} className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800">
              {MEAL_TYPE_ICONS[m]} {m}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- Alergias y dieta

function PreferencesSection({ profile, update }: { profile: UserProfile; update: Update }) {
  const [draft, setDraft] = useState<Preferences | null>(null);
  const allergies = [...profile.allergies.preset.map((a) => ALLERGEN_LABELS[a]), ...profile.allergies.custom];
  return (
    <Section
      title="Alergias y dieta"
      editing={!!draft}
      onEdit={() =>
        setDraft({ allergies: profile.allergies, diet: profile.diet, dislikedIngredients: profile.dislikedIngredients })
      }
    >
      {draft ? (
        <>
          <AllergyDietDislikes value={draft} onChange={setDraft} />
          <SaveBar
            onCancel={() => setDraft(null)}
            onSave={() => {
              update({ ...draft, dislikedIngredients: withoutAllergies(draft.dislikedIngredients, draft.allergies) });
              setDraft(null);
            }}
          />
        </>
      ) : (
        <>
          <Row
            label="Alergias"
            value={allergies.length ? <span className="text-rose-600 dark:text-rose-400">{allergies.join(", ")}</span> : "Ninguna"}
          />
          <Row label="Dieta" value={DIET_OPTIONS.find((d) => d.value === profile.diet)?.label} />
          <Row label="No me gusta" value={profile.dislikedIngredients.join(", ") || "—"} />
        </>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- Página

export default function ProfilePage() {
  const { profile, setProfile } = useApp();
  const { user, logout } = useAuth();

  if (!profile) return null;

  const update: Update = (patch) => setProfile({ ...profile, ...patch });

  const reset = () => {
    if (confirm("¿Borrar tu perfil y volver al inicio? Tus datos de diario y despensa se conservan.")) {
      setProfile(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Perfil</h1>
        <span className="text-sm text-zinc-500">@{user?.username}</span>
      </div>

      <GoalSection profile={profile} update={update} />
      <TargetsSection profile={profile} update={update} />
      <BodySection profile={profile} update={update} />
      <MealsSection profile={profile} update={update} />
      <PreferencesSection profile={profile} update={update} />

      <button onClick={logout} className="bg-white dark:bg-zinc-900 rounded-xl py-3 shadow-sm text-sm font-semibold">
        Cerrar sesión
      </button>

      <button onClick={reset} className="text-rose-500 text-sm py-2">
        Borrar perfil
      </button>
    </div>
  );
}
