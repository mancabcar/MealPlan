"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const { login, register, rememberedUsers, forgetUser } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(rememberedUsers.length > 0 ? "login" : "register");
  const [username, setUsername] = useState(rememberedUsers[0] ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(true);
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
      await (isRegister ? register : login)(username, password, remember);
    } catch (err) {
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

      {!isRegister && rememberedUsers.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Usuarios recordados</span>
          <div className="flex flex-wrap gap-2">
            {rememberedUsers.map((u) => (
              <span
                key={u}
                className={`flex items-center rounded-full text-sm border ${
                  u === username
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                <button type="button" className="pl-3 pr-1 py-1.5" onClick={() => setUsername(u)}>
                  👤 {u}
                </button>
                <button
                  type="button"
                  aria-label={`Olvidar ${u}`}
                  className="pr-3 pl-1 py-1.5 opacity-60 hover:opacity-100"
                  onClick={() => {
                    forgetUser(u);
                    if (u === username) setUsername("");
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

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
            autoFocus={!!username}
            required
          />
        </label>
        {isRegister && (
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
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="accent-emerald-600 w-4 h-4"
          />
          Recordarme en este dispositivo
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
    </div>
  );
}
