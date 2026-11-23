"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert, LogIn } from "lucide-react";
import { api } from "@/lib/api-client";
import { ROLE_LABELS, type Role } from "@/domain/enums";

export function LoginForm({ next, demoUsers, demoPassword }: { next: string; demoUsers: { email: string; name: string; role: Role }[]; demoPassword: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function signIn(e: string, p: string) {
    setBusy(e || "form");
    setError(null);
    try {
      await api("/api/auth/login", { body: { email: e, password: p } });
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <form
        className="space-y-4"
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
        {error && (
          <p className="field-error" role="alert">
            <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
        <button className="btn-primary w-full" disabled={busy !== null}>
          <LogIn aria-hidden />
          {busy === email || busy === "form" ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-semibold">Demo accounts</h3>
          <span className="text-[13px] text-ink-muted">
            Password <span className="font-mono">{demoPassword}</span>
          </span>
        </div>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-md border border-line bg-white">
          {demoUsers.map((u) => (
            <li key={u.email}>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => signIn(u.email, demoPassword)}
                className="group flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-out ease-ui hover:bg-ground disabled:opacity-50"
              >
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ground-alt text-[13px] font-semibold text-ink-2">
                  {u.name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{ROLE_LABELS[u.role]}</span>
                  <span className="block truncate text-[13px] text-ink-muted">
                    {u.name} · {u.email}
                  </span>
                </span>
                <span className="text-[13px] font-semibold text-action">{busy === u.email ? "Signing in…" : ""}</span>
                <ArrowRight aria-hidden className="h-5 w-5 text-ink-faint transition-transform duration-out ease-ui group-hover:translate-x-[3px] group-hover:text-ink" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
