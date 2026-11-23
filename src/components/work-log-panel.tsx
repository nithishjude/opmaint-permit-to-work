"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/time";
import { useMutation } from "./use-mutation";

interface Log {
  id: string;
  kind: string;
  person: string | null;
  message: string;
  createdAt: Date | string;
  author: { name: string };
}

export function WorkLogPanel({ permitId, logs, canLog, hasEntryRegister, peopleInside }: { permitId: string; logs: Log[]; canLog: boolean; hasEntryRegister: boolean; peopleInside: string[] }) {
  const { run, busy, error } = useMutation();
  const [message, setMessage] = useState("");
  const [person, setPerson] = useState("");

  async function add(kind: "NOTE" | "ENTRY" | "EXIT", who?: string) {
    const msg = kind === "NOTE" ? message : kind === "ENTRY" ? "Entered" : "Exited";
    if (await run(`/api/permits/${permitId}/work-logs`, { kind, person: who ?? null, message: msg })) {
      setMessage("");
      setPerson("");
    }
  }

  return (
    <div className="space-y-4">
      {hasEntryRegister && (
        <div className={`rounded-xl p-4 ${peopleInside.length ? "bg-amber-50 ring-2 ring-amber-500" : "bg-slate-50 ring-1 ring-slate-200"}`}>
          <p className="section-title">Entry register</p>
          <p className="mt-1 text-2xl font-black">
            {peopleInside.length} {peopleInside.length === 1 ? "person" : "people"} inside
          </p>
          {peopleInside.length > 0 && (
            <ul className="mt-2 space-y-2">
              {peopleInside.map((p) => (
                <li key={p} className="flex items-center justify-between gap-2 rounded-lg bg-white p-2 ring-1 ring-amber-300">
                  <span className="font-semibold">{p}</span>
                  {canLog && (
                    <button type="button" className="btn-secondary min-h-[44px]" disabled={busy} onClick={() => add("EXIT", p)}>
                      Log exit
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canLog && (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (person.trim()) add("ENTRY", person.trim());
              }}
            >
              <input className="input" placeholder="Name of person entering" value={person} onChange={(e) => setPerson(e.target.value)} />
              <button className="btn-warn shrink-0" disabled={busy || !person.trim()}>
                Log entry
              </button>
            </form>
          )}
        </div>
      )}

      {canLog && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (message.trim()) add("NOTE");
          }}
        >
          <input className="input" placeholder="Progress note…" value={message} onChange={(e) => setMessage(e.target.value)} />
          <button className="btn-secondary shrink-0" disabled={busy || !message.trim()}>
            Add
          </button>
        </form>
      )}
      {error && <p className="field-error">{error}</p>}

      {logs.length === 0 ? (
        <p className="text-sm text-slate-500">No work logged yet.{!canLog ? " Work can only be logged while the permit is ACTIVE." : ""}</p>
      ) : (
        <ul className="space-y-2">
          {[...logs].reverse().map((l) => (
            <li key={l.id} className="rounded-lg bg-slate-50 p-2 text-sm ring-1 ring-slate-200">
              <span className="font-mono text-xs text-slate-500">{formatDateTime(l.createdAt)}</span>{" "}
              {l.kind !== "NOTE" && (
                <span className={`rounded px-1.5 text-xs font-bold ${l.kind === "ENTRY" ? "bg-amber-200 text-amber-950" : "bg-green-200 text-green-950"}`}>
                  {l.kind} {l.person}
                </span>
              )}{" "}
              {l.kind === "NOTE" && l.message}
              <span className="text-slate-500"> — {l.author.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
