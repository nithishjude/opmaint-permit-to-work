"use client";

// Record on-site readings after submission (gas tests, lock numbers, tested-dead).
// Only fields the registry marks `editableAfterSubmit` are offered; the server
// enforces the same list and audits every change with from → to.

import { useState } from "react";
import { getPermitType, type TypeData } from "@/domain/permit-types";
import { TypeFields } from "./type-fields";
import { useMutation } from "./use-mutation";

export function ReadingsForm({ permitId, type, typeData, status }: { permitId: string; type: string; typeData: TypeData; status: string }) {
  const def = getPermitType(type)!;
  const fields = def.fields.filter((f) => f.editableAfterSubmit);
  const initial = Object.fromEntries(fields.map((f) => [f.name, typeData[f.name]]));
  const [value, setValue] = useState<TypeData>(initial);
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const { run, busy, error } = useMutation();

  if (fields.length === 0) return null;

  const changed = fields.some((f) => JSON.stringify(value[f.name] ?? null) !== JSON.stringify(initial[f.name] ?? null));

  return (
    <div>
      <button type="button" className="btn-secondary w-full" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? "Hide" : "Record"} readings / re-test
      </button>
      {open && (
        <form
          className="mt-3 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const patch = Object.fromEntries(fields.filter((f) => JSON.stringify(value[f.name] ?? null) !== JSON.stringify(initial[f.name] ?? null)).map((f) => [f.name, value[f.name] ?? null]));
            if (await run(`/api/permits/${permitId}/readings`, { typeData: patch, comment: comment || null }, "PATCH")) {
              setSaved(true);
              setComment("");
            }
          }}
        >
          {status === "ACTIVE" && (
            <p className="rounded-lg bg-amber-50 p-2 text-sm font-semibold text-amber-950 ring-1 ring-amber-300">
              Entering a reading outside the safe range will suspend this permit immediately.
            </p>
          )}
          <TypeFields fields={fields} value={value} onChange={(v) => { setValue(v); setSaved(false); }} />
          <div>
            <label className="label" htmlFor="rd-comment">Note (optional)</label>
            <input id="rd-comment" className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Re-test after break" />
          </div>
          {error && <p className="field-error">{error}</p>}
          {saved && <p className="font-semibold text-green-800">✓ Saved and logged.</p>}
          <button className="btn-primary w-full" disabled={busy || !changed}>
            {busy ? "Saving…" : "Save readings"}
          </button>
        </form>
      )}
    </div>
  );
}
