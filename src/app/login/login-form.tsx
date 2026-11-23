"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { ROLE_LABELS, type Role } from "@/domain/enums";

export function LoginForm({ next, demoUsers, demoPassword }: { next: string; demoUsers: { email: string; name: string; role: Role }[]; demoPassword: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: string, p: string) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { body: { email: e, password: p } });
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="card space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          signIn(email, password);
        }}
      >
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="card p-4">
        <p className="mb-2 text-sm font-bold text-slate-700">Demo accounts — one tap to sign in</p>
        <ul className="grid grid-cols-1 gap-2">
          {demoUsers.map((u) => (
            <li key={u.email}>
              <button type="button" disabled={busy} onClick={() => signIn(u.email, demoPassword)} className="btn-secondary w-full justify-between text-left">
                <span>
                  <span className="block text-sm font-bold">{ROLE_LABELS[u.role]}</span>
                  <span className="block text-xs font-normal text-slate-600">
                    {u.name} · {u.email}
                  </span>
                </span>
                <span aria-hidden>→</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">Password for all: {demoPassword}</p>
      </div>
    </div>
  );
}
