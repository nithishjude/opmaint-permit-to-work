"use client";

import { TimerReset } from "lucide-react";
import { useState } from "react";
import { MAX_EXTENSION_HOURS, MAX_EXTENSIONS } from "@/domain/guards";
import { formatDateTime } from "@/lib/time";
import { useMutation } from "./use-mutation";

interface Ext {
  id: string;
  hours: number;
  reason: string;
  status: string;
  createdAt: Date | string;
  decisionNote: string | null;
  requestedBy: { name: string };
  decidedBy: { name: string } | null;
}

export function ExtensionPanel({ permitId, extensions, canRequest, canDecide, extensionCount, validUntil }: { permitId: string; extensions: Ext[]; canRequest: boolean; canDecide: boolean; extensionCount: number; validUntil: Date | string }) {
  const { run, busy, error } = useMutation();
  const [hours, setHours] = useState(2);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const pending = extensions.find((e) => e.status === "PENDING");

  return (
    <div className="space-y-3">
      <p className="text-[15px] text-ink-muted">
        Valid until <strong className="font-mono font-semibold text-ink">{formatDateTime(validUntil)}</strong>. {extensionCount}/{MAX_EXTENSIONS} extensions used; each up to {MAX_EXTENSION_HOURS} h, approved by a safety officer.
      </p>

      {pending && (
        <div className="callout-info flex-col !gap-1">
          <p className="flex items-center gap-2 font-semibold">
            <TimerReset aria-hidden className="h-5 w-5 text-info" />+{pending.hours} h requested by {pending.requestedBy.name}
          </p>
          <p className="text-[15px] text-ink-2">{pending.reason}</p>
          {canDecide && (
            <div className="mt-2 space-y-2">
              <input className="input" placeholder="Note (required to refuse)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex gap-2">
                <button type="button" className="btn-go flex-1" disabled={busy} onClick={() => run(`/api/permits/${permitId}/extensions/${pending.id}/decision`, { approve: true, note: note || null })}>
                  Approve +{pending.hours} h
                </button>
                <button type="button" className="btn-secondary flex-1" disabled={busy || !note.trim()} onClick={() => run(`/api/permits/${permitId}/extensions/${pending.id}/decision`, { approve: false, note })}>
                  Refuse
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {canRequest && (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(`/api/permits/${permitId}/extensions`, { hours, reason })) setReason("");
          }}
        >
          <label className="label" htmlFor="ext-hours">Request more time</label>
          <div className="grid grid-cols-4 gap-1 rounded-sm border border-line-strong bg-ground p-1" role="radiogroup" aria-label="Extra hours">
            {Array.from({ length: MAX_EXTENSION_HOURS }, (_, i) => i + 1).map((h) => (
              <button
                key={h}
                type="button"
                role="radio"
                aria-checked={hours === h}
                onClick={() => setHours(h)}
                className={`min-h-[44px] rounded-[6px] font-mono text-[15px] font-semibold transition-colors duration-out ease-ui ${hours === h ? "bg-white text-ink shadow-sm ring-1 ring-line-strong" : "text-ink-muted hover:text-ink"}`}
              >
                +{h} h
              </button>
            ))}
          </div>
          <textarea className="input py-2.5" rows={2} placeholder="Why is more time needed?" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn-secondary w-full" disabled={busy || reason.trim().length < 5}>
            <TimerReset aria-hidden />
            Request +{hours} h
          </button>
        </form>
      )}
      {error && <p className="field-error">{error}</p>}

      {extensions.filter((e) => e.status !== "PENDING").length > 0 && (
        <ul className="space-y-1 text-sm">
          {extensions
            .filter((e) => e.status !== "PENDING")
            .map((e) => (
              <li key={e.id} className="text-ink-2">
                +{e.hours} h · <strong>{e.status.toLowerCase()}</strong> {e.decidedBy ? `by ${e.decidedBy.name}` : ""} {e.decisionNote ? `— ${e.decisionNote}` : ""}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
