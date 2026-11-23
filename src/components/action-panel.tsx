"use client";

// Renders exactly the actions the server says this user may take on this
// permit right now (computed by the same `authorize` the API enforces).
// No action → no button.

import Link from "next/link";
import { useState } from "react";
import { CircleAlert, CircleCheck, OctagonPause, Pencil, Play, Send, ShieldCheck, Signature, Ban, TriangleAlert } from "lucide-react";
import type { PermitAction } from "@/domain/permissions";
import { useMutation } from "./use-mutation";

type FormKind = "SUSPEND" | "RESUME" | "CANCEL" | "CLOSE" | "VERIFY" | "ACTIVATE" | null;

const VERIFY_CHECKS = [
  "Area is clean — no debris, offcuts, rags or waste left behind",
  "Tools, equipment and temporary materials removed",
  "Isolations, locks and blinds removed or formally handed back",
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
    return <p className="text-[15px] text-ink-muted">Nothing for you to do on this permit right now.</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="callout-critical">
          <CircleAlert aria-hidden />
          <p className="text-[15px] font-semibold">{error}</p>
        </div>
      )}

      {/* STOP WORK first: the most important button on an active permit. */}
      {can("SUSPEND") && (
        <div>
          <button type="button" className="btn-stop min-h-[64px] w-full text-lg" onClick={() => toggle("SUSPEND")} aria-expanded={open === "SUSPEND"}>
            <OctagonPause aria-hidden className="!h-6 !w-6" />
            Stop work
          </button>
          {open === "SUSPEND" && (
            <ReasonForm
              label="Why is work being stopped?"
              placeholder="e.g. Gas alarm GD-14, shift handover, wind picked up…"
              quick={["Gas alarm in area", "Shift handover", "Plant emergency", "Unsafe act observed", "Weather"]}
              text={text}
              setText={setText}
              busy={busy}
              submitLabel="Confirm stop work"
              submitClass="btn-stop"
              onSubmit={() => transition("SUSPEND", { comment: text })}
            />
          )}
        </div>
      )}

      {can("ACTIVATE") && (
        <div>
          <button type="button" className="btn-go min-h-[64px] w-full text-lg" onClick={() => toggle("ACTIVATE")} aria-expanded={open === "ACTIVATE"}>
            <Play aria-hidden className="!h-6 !w-6" />
            Start work
          </button>
          {open === "ACTIVATE" && (
            <div className="callout-good mt-3 flex-col">
              <p className="text-[15px]">Confirm the crew is briefed on the hazards and precautions, PPE is on, and the permit is displayed at the job.</p>
              <button type="button" className="btn-go w-full" disabled={busy} onClick={() => transition("ACTIVATE")}>
                {busy ? "Starting…" : "Confirm — work starts now"}
              </button>
            </div>
          )}
        </div>
      )}
      {!can("ACTIVATE") && activateBlocker && (
        <div className="callout-warning">
          <TriangleAlert aria-hidden />
          <div>
            <p className="font-semibold">Work can&apos;t start yet</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[15px] text-ink-2">
              {activateBlocker
                .split(/(?<=\.)\s+/)
                .filter(Boolean)
                .map((m) => (
                  <li key={m}>{m}</li>
                ))}
            </ul>
          </div>
        </div>
      )}

      {can("RESUME") && (
        <div>
          <button type="button" className="btn-go w-full" onClick={() => toggle("RESUME")} aria-expanded={open === "RESUME"}>
            <Play aria-hidden />
            Resume work
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
        <button type="button" className="btn-primary w-full" disabled={busy} onClick={() => transition("SUBMIT")}>
          <Send aria-hidden />
          Submit for approval
        </button>
      )}

      {can("EDIT_DRAFT") && (
        <Link href={`/permits/${permitId}/edit`} className="btn-secondary w-full">
          <Pencil aria-hidden />
          Continue editing draft
        </Link>
      )}

      {(can("APPROVE") || can("REJECT")) && (
        <Link href={`/permits/${permitId}/approve`} className="btn-primary min-h-[56px] w-full text-lg">
          <Signature aria-hidden />
          Review & sign
        </Link>
      )}

      {can("CLOSE") && (
        <div>
          <button type="button" className="btn-secondary w-full" onClick={() => toggle("CLOSE")} aria-expanded={open === "CLOSE"}>
            <CircleCheck aria-hidden />
            Work complete — close permit
          </button>
          {open === "CLOSE" && (
            <div className="mt-3 space-y-3">
              {peopleInside.length > 0 && (
                <div className="callout-critical">
                  <CircleAlert aria-hidden />
                  <p className="text-[15px] font-semibold">Still logged inside: {peopleInside.join(", ")}. Record their exit before closing.</p>
                </div>
              )}
              <ReasonForm
                label="Completion notes"
                placeholder="What was done, what's left, the state the area was left in, isolations handed back…"
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
          <button type="button" className="btn-primary w-full" onClick={() => toggle("VERIFY")} aria-expanded={open === "VERIFY"}>
            <ShieldCheck aria-hidden />
            Verify area & close out
          </button>
          {open === "VERIFY" && (
            <div className="mt-3 space-y-2">
              <p className="text-[15px] font-semibold">Site inspection — confirm each item</p>
              {VERIFY_CHECKS.map((c, i) => (
                <label key={c} className="check-row">
                  <input type="checkbox" className="check-box" checked={checks[i]} onChange={(e) => setChecks(checks.map((x, j) => (j === i ? e.target.checked : x)))} />
                  <span className="text-[15px] leading-snug">{c}</span>
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
        <div className="pt-1">
          <button type="button" className="btn-text text-critical decoration-critical-line hover:text-critical" onClick={() => toggle("CANCEL")} aria-expanded={open === "CANCEL"}>
            <Ban aria-hidden />
            Cancel this permit
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
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label className="label !mb-0">{label}</label>
      {quick.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              aria-pressed={text === q}
              className={`min-h-[44px] rounded-full border px-3.5 text-[15px] font-medium transition-colors duration-out ease-ui ${
                text === q ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink-2 hover:border-ink-muted"
              }`}
              onClick={() => setText(q)}
            >
              {q}
            </button>
          ))}
        </div>
      )}
      <textarea className="input py-2.5" rows={3} required value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
      <button className={`${submitClass} w-full`} disabled={busy || disabled || !text.trim()}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
