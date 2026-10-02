"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth";

// Login y registro contra el servidor (docs/pm/22-sincronizacion-dispositivos/spec.md › R1, R6, R7).
export default function Login() {
  const { login, register, localAccounts, replaceRequest } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [invite, setInvite] = useState("");
  const [remember, setRemember] = useState(true);
  // Datos de este dispositivo a traer: por defecto la cuenta local de la última sesión (R6); "" = ninguna
  const [localId, setLocalId] = useState(
    () => localAccounts.find((a) => a.lastSession)?.id ?? (localAccounts.length === 1 ? localAccounts[0].id : ""),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (isRegister && password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setBusy(true);
    try {
      await (isRegister
        ? register(username, password, invite, remember, localId || null)
        : login(username, password, remember, localId || null));
    } catch (err) {
      // Mensaje vacío: el usuario ha cancelado la sustitución de datos (R7), no es un error
      setError(err instanceof Error ? err.message : "Algo ha fallado");
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(isRegister ? "login" : "register");
    setError("");
    setPassword("");
    setConfirm("");
  };

  const inputCls =
    "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2";

  return (
    <div className="max-w-md mx-auto w-full px-6 py-12 flex flex-col gap-6 min-h-screen justify-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">🥗 MealPlanner</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {isRegister ? "Crea tu cuenta para empezar." : "Inicia sesión para continuar."}
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Usuario
          <input
            className={inputCls}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Contraseña
          <input
            type="password"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
          />
        </label>
        {isRegister && (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Repite la contraseña
              <input
                type="password"
                className={inputCls}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Código de invitación
              <input className={inputCls} value={invite} onChange={(e) => setInvite(e.target.value)} autoComplete="off" required />
            </label>
          </>
        )}
        {localAccounts.length > 0 && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Traer los datos de este dispositivo
            <select className={inputCls} value={localId} onChange={(e) => setLocalId(e.target.value)}>
              <option value="">Ninguno</option>
              {localAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.username}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="accent-emerald-600 w-4 h-4"
          />
          Recordar sesión
        </label>

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <button
          type="submit"
          disabled={busy || !username.trim() || !password}
          className="bg-emerald-600 text-white rounded-lg py-3 font-semibold disabled:opacity-40"
        >
          {busy ? "…" : isRegister ? "Crear cuenta" : "Entrar"}
        </button>
      </form>

      <button type="button" onClick={switchMode} className="text-sm text-emerald-600 dark:text-emerald-400">
        {isRegister ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
      </button>

      {replaceRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="replace-title"
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-5 flex flex-col gap-4"
          >
            <h2 id="replace-title" className="text-lg font-semibold">
              Sustituir los datos de este dispositivo
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Este dispositivo ya tiene datos y tu cuenta también. Si sigues, se sustituirán por los de tu cuenta y lo que
              tengas aquí se perderá.
            </p>
            <button type="button" onClick={replaceRequest.downloadLocal} className="text-sm text-emerald-600 dark:text-emerald-400 text-left">
              Descargar copia de lo local
            </button>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={replaceRequest.cancel}
                className="rounded-lg px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={replaceRequest.accept}
                className="rounded-lg px-4 py-2 bg-emerald-600 text-white text-sm font-semibold"
              >
                Sustituir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
