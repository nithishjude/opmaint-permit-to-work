"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { ROLES, ROLE_LABELS, type Role } from "@/domain/enums";

interface Data {
  users: { id: string; email: string; name: string; role: Role; active: boolean; _count: { ownedAreas: number } }[];
  plants: {
    id: string;
    code: string;
    name: string;
    areas: { id: string; code: string; name: string; owner: { id: string; name: string } | null; equipment: { id: string; tag: string; name: string }[] }[];
  }[];
}

export function AdminPanel({ data, currentUserId, demoMode }: { data: Data; currentUserId: string; demoMode: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const owners = data.users.filter((u) => u.role === "AREA_OWNER" && u.active);

  async function call(path: string, body: unknown, method = "POST") {
    setBusy(true);
    setError(null);
    try {
      await api(path, { method, body });
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function formSubmit(path: string) {
    return async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const body = Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, v === "" ? null : v]));
      if (await call(path, body)) form.reset();
    };
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="callout-critical font-semibold">
          {error}
        </div>
      )}

      <section className="card p-4 sm:p-6">
        <h2 className="panel-title mb-4">Users</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-ink-muted">
              <tr>
                <th className="py-2">Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ground">
              {data.users.map((u) => (
                <tr key={u.id} className={u.active ? "" : "text-ink-faint"}>
                  <td className="py-2 font-semibold">{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      className="input min-h-[40px] py-0"
                      value={u.role}
                      disabled={busy || u.id === currentUserId}
                      onChange={(e) => call(`/api/admin/users/${u.id}`, { role: e.target.value }, "PATCH")}
                      aria-label={`Role of ${u.name}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button type="button" className={`btn-text no-underline ${u.active ? "text-good" : "text-ink-muted"}`} disabled={busy || u.id === currentUserId} onClick={() => call(`/api/admin/users/${u.id}`, { active: !u.active }, "PATCH")}>
                      {u.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5" onSubmit={formSubmit("/api/admin/users")}>
          <input name="name" className="input" placeholder="Full name" required />
          <input name="email" type="email" className="input" placeholder="Email" required />
          <select name="role" className="input" defaultValue="REQUESTER">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <input name="password" type="password" className="input" placeholder="Initial password (8+)" required minLength={8} />
          <button className="btn-secondary" disabled={busy}>
            Add user
          </button>
        </form>
      </section>

      <section className="card p-4 sm:p-6">
        <h2 className="panel-title mb-4">Plants, areas & equipment</h2>
        <div className="space-y-5">
          {data.plants.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-md border border-line">
              <h3 className="bg-ground-alt px-4 py-3 font-semibold text-ink">
                {p.code} · {p.name}
              </h3>
              <ul className="divide-y divide-ground">
                {p.areas.map((a) => (
                  <li key={a.id} className="space-y-2 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {a.code} · {a.name}
                      </span>
                      <label className="ml-auto flex items-center gap-2 text-sm">
                        Owner
                        <select className="input min-h-[40px] w-48 py-0" value={a.owner?.id ?? ""} disabled={busy} onChange={(e) => call(`/api/admin/areas/${a.id}`, { ownerId: e.target.value || null }, "PATCH")}>
                          <option value="">— none —</option>
                          {owners.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {a.equipment.map((e) => (
                        <span key={e.id} className="chip text-[13px]">
                          <strong>{e.tag}</strong> {e.name}
                        </span>
                      ))}
                    </div>
                    <form className="flex flex-wrap gap-2" onSubmit={formSubmit("/api/admin/equipment")}>
                      <input type="hidden" name="areaId" value={a.id} />
                      <input name="tag" className="input min-h-[40px] w-32" placeholder="Tag" required />
                      <input name="name" className="input min-h-[40px] flex-1" placeholder="Equipment name" required />
                      <button className="btn-secondary min-h-[40px]" disabled={busy}>
                        Add equipment
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <form className="flex flex-wrap gap-2 border-t border-line p-3" onSubmit={formSubmit("/api/admin/areas")}>
                <input type="hidden" name="plantId" value={p.id} />
                <input name="code" className="input min-h-[40px] w-24" placeholder="Code" required />
                <input name="name" className="input min-h-[40px] flex-1" placeholder="New area name" required />
                <select name="ownerId" className="input min-h-[40px] w-48" defaultValue="">
                  <option value="">Owner…</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <button className="btn-secondary min-h-[40px]" disabled={busy}>
                  Add area
                </button>
              </form>
            </div>
          ))}
        </div>
        <form className="mt-4 flex flex-wrap gap-2" onSubmit={formSubmit("/api/admin/plants")}>
          <input name="code" className="input w-28" placeholder="Code" required />
          <input name="name" className="input flex-1" placeholder="New plant name" required />
          <input name="location" className="input flex-1" placeholder="Location" />
          <button className="btn-secondary" disabled={busy}>
            Add plant
          </button>
        </form>
      </section>

      {demoMode && (
        <section className="card border-warning-line p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Demo data</h2>
          <p className="mb-3 text-sm text-ink-2">
            Wipes everything and re-creates the demo with times relative to now (active, expiring, pending permits). You will be signed out.
          </p>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={async () => {
              if (!confirm("Wipe all data and re-seed the demo?")) return;
              if (await call("/api/demo/reset", {})) window.location.href = "/login";
            }}
          >
            Reset demo data
          </button>
        </section>
      )}
    </div>
  );
}
