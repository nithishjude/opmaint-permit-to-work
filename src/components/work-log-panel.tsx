"use client";

import { useState } from "react";
import { LogIn, LogOut, MessageSquarePlus, Users } from "lucide-react";
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
    <div className="space-y-5">
      {hasEntryRegister && (
        <div className={`rounded-md border p-4 ${peopleInside.length ? "border-warning-line bg-warning-soft" : "border-line bg-ground"}`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-sm ${peopleInside.length ? "bg-warning-fill text-ink" : "bg-white text-ink-muted"}`}>
              <Users aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="eyebrow">Entry register</p>
              <p className="text-xl font-semibold leading-tight">
                {peopleInside.length} {peopleInside.length === 1 ? "person" : "people"} inside
              </p>
            </div>
          </div>
          {peopleInside.length > 0 && (
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-sm border border-warning-line bg-white">
              {peopleInside.map((p) => (
                <li key={p} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="font-semibold">{p}</span>
                  {canLog && (
                    <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => add("EXIT", p)}>
                      <LogOut aria-hidden />
                      Log exit
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canLog && (
            <form
              className="mt-3 flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (person.trim()) add("ENTRY", person.trim());
              }}
            >
              <label htmlFor="entrant" className="sr-only">Name of person entering</label>
              <input id="entrant" className="input" placeholder="Name of person entering" value={person} onChange={(e) => setPerson(e.target.value)} />
              <button className="btn-secondary shrink-0" disabled={busy || !person.trim()}>
                <LogIn aria-hidden />
                Log entry
              </button>
            </form>
          )}
        </div>
      )}

      {canLog && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (message.trim()) add("NOTE");
          }}
        >
          <label htmlFor="note" className="sr-only">Progress note</label>
          <input id="note" className="input" placeholder="Add a progress note…" value={message} onChange={(e) => setMessage(e.target.value)} />
          <button className="btn-secondary shrink-0" disabled={busy || !message.trim()}>
            <MessageSquarePlus aria-hidden />
            Add note
          </button>
        </form>
      )}
      {error && <p className="field-error">{error}</p>}

      {logs.length === 0 ? (
        <p className="text-[15px] text-ink-muted">No work logged yet.{!canLog ? " Work can only be logged while the permit is active." : ""}</p>
      ) : (
        <ol className="divide-y divide-line rounded-sm border border-line">
          {[...logs].reverse().map((l) => (
            <li key={l.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3.5 py-3">
              <time className="font-mono text-[13px] text-ink-muted">{formatDateTime(l.createdAt)}</time>
              {l.kind === "NOTE" ? (
                <span className="text-[15px]">{l.message}</span>
              ) : (
                <span className={`inline-flex items-center gap-1.5 text-[15px] font-semibold ${l.kind === "ENTRY" ? "text-warning" : "text-good"}`}>
                  {l.kind === "ENTRY" ? <LogIn aria-hidden className="h-4 w-4" /> : <LogOut aria-hidden className="h-4 w-4" />}
                  {l.person} {l.kind === "ENTRY" ? "entered" : "exited"}
                </span>
              )}
              <span className="text-[13px] text-ink-muted">by {l.author.name}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
