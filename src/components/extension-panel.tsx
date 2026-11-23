"use client";

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
      <p className="text-sm text-slate-600">
        Valid until <strong>{formatDateTime(validUntil)}</strong>. {extensionCount}/{MAX_EXTENSIONS} extensions used; each up to {MAX_EXTENSION_HOURS} h, approved by a safety officer.
      </p>

      {pending && (
        <div className="rounded-lg bg-blue-50 p-3 ring-1 ring-blue-300">
          <p className="font-bold text-blue-950">
            +{pending.hours} h requested by {pending.requestedBy.name}
          </p>
          <p className="text-sm text-blue-950">{pending.reason}</p>
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
          <div className="flex gap-2">
            {Array.from({ length: MAX_EXTENSION_HOURS }, (_, i) => i + 1).map((h) => (
              <button key={h} type="button" onClick={() => setHours(h)} className={`btn flex-1 border-2 ${hours === h ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"}`}>
                +{h} h
              </button>
            ))}
          </div>
          <textarea className="input py-2" rows={2} placeholder="Why is more time needed?" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn-primary w-full" disabled={busy || reason.trim().length < 5}>
            Request extension
          </button>
        </form>
      )}
      {error && <p className="field-error">{error}</p>}

      {extensions.filter((e) => e.status !== "PENDING").length > 0 && (
        <ul className="space-y-1 text-sm">
          {extensions
            .filter((e) => e.status !== "PENDING")
            .map((e) => (
              <li key={e.id} className="text-slate-700">
                +{e.hours} h · <strong>{e.status.toLowerCase()}</strong> {e.decidedBy ? `by ${e.decidedBy.name}` : ""} {e.decisionNote ? `— ${e.decisionNote}` : ""}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
