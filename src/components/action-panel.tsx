"use client";

// Renders exactly the actions the server says this user may take on this
// permit right now (computed by the same `authorize` the API enforces).
// No action → no button.

import Link from "next/link";
import { useState } from "react";
import type { PermitAction } from "@/domain/permissions";
import { useMutation } from "./use-mutation";

type FormKind = "SUSPEND" | "RESUME" | "CANCEL" | "CLOSE" | "VERIFY" | "ACTIVATE" | null;

const VERIFY_CHECKS = [
  "Area is clean — no debris, offcuts, rags or waste left behind",
  "Tools, equipment and temporary materials removed",
  "Isolations, locks, blinds removed or formally handed back",
  "All personnel out of the area and accounted for",
  "Equipment safe to return to operations",
];

export function ActionPanel({
  permitId,
  actions,
  activateBlocker,
  peopleInside,
}: {
  permitId: string;
  actions: PermitAction[];
  activateBlocker?: string;
  peopleInside: string[];
}) {
  const { run, busy, error, setError } = useMutation();
  const [open, setOpen] = useState<FormKind>(null);
  const [text, setText] = useState("");
  const [checks, setChecks] = useState<boolean[]>(VERIFY_CHECKS.map(() => false));

  const can = (a: PermitAction) => actions.includes(a);
  const toggle = (k: FormKind) => {
    setOpen(open === k ? null : k);
    setText("");
    setError(null);
  };

  async function transition(action: string, extra: Record<string, unknown> = {}) {
    const ok = await run(`/api/permits/${permitId}/transition`, { action, ...extra });
    if (ok) {
      setOpen(null);
      setText("");
    }
  }

  const lifecycle = (["SUBMIT", "ACTIVATE", "SUSPEND", "RESUME", "CLOSE", "VERIFY", "CANCEL", "EDIT_DRAFT", "APPROVE"] as const).some(can);
  if (!lifecycle && !activateBlocker) {
    return <p className="text-sm text-slate-600">No actions available to you on this permit.</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-900 ring-1 ring-red-300">
          {error}
        </div>
      )}

      {/* STOP WORK first: the most important button on an active permit. */}
      {can("SUSPEND") && (
        <div>
          <button type="button" className="btn-stop min-h-[64px] w-full text-lg" onClick={() => toggle("SUSPEND")} aria-expanded={open === "SUSPEND"}>
            ■ STOP WORK — suspend permit
          </button>
          {open === "SUSPEND" && (
            <ReasonForm
              label="Why is work being stopped?"
              placeholder="e.g. Gas alarm GD-14, shift handover, wind picked up…"
              quick={["Gas alarm in area", "Shift handover", "Emergency / plant upset", "Unsafe act observed", "Weather"]}
              text={text}
              setText={setText}
              busy={busy}
              submitLabel="Confirm STOP WORK"
              submitClass="btn-stop"
              onSubmit={() => transition("SUSPEND", { comment: text })}
            />
          )}
        </div>
      )}

      {can("ACTIVATE") && (
        <div>
          <button type="button" className="btn-go min-h-[64px] w-full text-lg" onClick={() => toggle("ACTIVATE")}>
            ▶ Start work (activate)
          </button>
          {open === "ACTIVATE" && (
            <div className="mt-2 space-y-2 rounded-lg bg-green-50 p-3 ring-1 ring-green-300">
              <p className="text-sm font-semibold text-green-950">Confirm: crew briefed on hazards and precautions, PPE on, permit displayed at the job site.</p>
              <button type="button" className="btn-go w-full" disabled={busy} onClick={() => transition("ACTIVATE")}>
                {busy ? "Starting…" : "Confirm — work starts now"}
              </button>
            </div>
          )}
        </div>
      )}
      {!can("ACTIVATE") && activateBlocker && (
        <div className="rounded-lg border-2 border-amber-500 bg-amber-50 p-3">
          <p className="font-bold text-amber-950">Work can&apos;t start yet</p>
          <p className="mt-1 text-sm text-amber-950">{activateBlocker}</p>
        </div>
      )}

      {can("RESUME") && (
        <div>
          <button type="button" className="btn-go w-full" onClick={() => toggle("RESUME")}>
            ▶ Resume work
          </button>
          {open === "RESUME" && (
            <ReasonForm
              label="What was checked before resuming?"
              placeholder="e.g. Re-tested atmosphere: LEL 0%, O₂ 20.9%. Leak at flange F-12 fixed."
              text={text}
              setText={setText}
              busy={busy}
              submitLabel="Confirm resume"
              submitClass="btn-go"
              onSubmit={() => transition("RESUME", { comment: text })}
            />
          )}
        </div>
      )}

      {can("SUBMIT") && (
        <button type="button" className="btn-go w-full" disabled={busy} onClick={() => transition("SUBMIT")}>
          Submit for approval
        </button>
      )}

      {can("EDIT_DRAFT") && (
        <Link href={`/permits/${permitId}/edit`} className="btn-secondary w-full">
          ✎ Continue editing draft
        </Link>
      )}

      {(can("APPROVE") || can("REJECT")) && (
        <Link href={`/permits/${permitId}/approve`} className="btn-primary min-h-[56px] w-full text-lg">
          Review & sign approval →
        </Link>
      )}

      {can("CLOSE") && (
        <div>
          <button type="button" className="btn-primary w-full" onClick={() => toggle("CLOSE")}>
            ✓ Work complete — close permit
          </button>
          {open === "CLOSE" && (
            <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-300">
              {peopleInside.length > 0 && (
                <p className="rounded bg-red-100 p-2 text-sm font-bold text-red-900">
                  Still logged inside: {peopleInside.join(", ")}. Record their exit before closing.
                </p>
              )}
              <ReasonForm
                label="Completion notes"
                placeholder="What was done, what's left, condition the area was left in, isolations handed back…"
                text={text}
                setText={setText}
                busy={busy}
                submitLabel="Close permit"
                submitClass="btn-primary"
                onSubmit={() => transition("CLOSE", { completionNotes: text })}
              />
            </div>
          )}
        </div>
      )}

      {can("VERIFY") && (
        <div>
          <button type="button" className="btn-primary w-full" onClick={() => toggle("VERIFY")}>
            Verify area & close out
          </button>
          {open === "VERIFY" && (
            <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-300">
              <p className="text-sm font-bold">Site inspection — confirm each item:</p>
              {VERIFY_CHECKS.map((c, i) => (
                <label key={c} className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg border-2 border-slate-200 bg-white px-3 has-[:checked]:border-green-700">
                  <input type="checkbox" className="h-6 w-6 accent-green-700" checked={checks[i]} onChange={(e) => setChecks(checks.map((x, j) => (j === i ? e.target.checked : x)))} />
                  <span className="text-sm">{c}</span>
                </label>
              ))}
              <ReasonForm
                label="Verification notes"
                placeholder="Anything observed during the walk-down."
                text={text}
                setText={setText}
                busy={busy}
                disabled={!checks.every(Boolean)}
                submitLabel="Verify & close out"
                submitClass="btn-go"
                onSubmit={() => transition("VERIFY", { verificationNotes: `${text.trim()}\n\nConfirmed on site: ${VERIFY_CHECKS.join("; ")}.` })}
              />
            </div>
          )}
        </div>
      )}

      {can("CANCEL") && (
        <div>
          <button type="button" className="btn-ghost w-full text-red-800" onClick={() => toggle("CANCEL")}>
            Cancel this permit…
          </button>
          {open === "CANCEL" && (
            <ReasonForm
              label="Reason for cancelling"
              text={text}
              setText={setText}
              busy={busy}
              submitLabel="Cancel permit"
              submitClass="btn-stop"
              onSubmit={() => transition("CANCEL", { comment: text })}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ReasonForm({
  label,
  placeholder,
  quick = [],
  text,
  setText,
  busy,
  disabled,
  submitLabel,
  submitClass,
  onSubmit,
}: {
  label: string;
  placeholder?: string;
  quick?: string[];
  text: string;
  setText: (v: string) => void;
  busy: boolean;
  disabled?: boolean;
  submitLabel: string;
  submitClass: string;
  onSubmit: () => void;
}) {
  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label className="label">{label}</label>
      {quick.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <button key={q} type="button" className="min-h-[44px] rounded-full border-2 border-slate-300 bg-white px-3 text-sm font-semibold" onClick={() => setText(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
      <textarea className="input py-2" rows={3} required value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
      <button className={`${submitClass} w-full`} disabled={busy || disabled || !text.trim()}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
