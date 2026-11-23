"use client";

// Record on-site readings after submission (gas tests, lock numbers, tested-dead).
// Only fields the registry marks `editableAfterSubmit` are offered; the server
// enforces the same list and audits every change with from → to.

import { CircleCheck, Gauge, TriangleAlert } from "lucide-react";
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
        <Gauge aria-hidden />
        {open ? "Hide readings" : "Record readings / re-test"}
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
            <div className="callout-warning">
              <TriangleAlert aria-hidden />
              <p className="text-[15px] font-semibold">A reading outside the safe range will stop work on this permit immediately.</p>
            </div>
          )}
          <TypeFields fields={fields} value={value} onChange={(v) => { setValue(v); setSaved(false); }} />
          <div>
            <label className="label" htmlFor="rd-comment">Note (optional)</label>
            <input id="rd-comment" className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Re-test after break" />
          </div>
          {error && <p className="field-error">{error}</p>}
          {saved && (
            <p className="flex items-center gap-1.5 font-semibold text-good">
              <CircleCheck aria-hidden className="h-4 w-4" /> Saved and logged.
            </p>
          )}
          <button className="btn-primary w-full" disabled={busy || !changed}>
            {busy ? "Saving…" : "Save readings"}
          </button>
        </form>
      )}
    </div>
  );
}
