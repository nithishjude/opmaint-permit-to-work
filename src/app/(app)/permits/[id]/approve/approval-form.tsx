"use client";

import { CircleCheck, CircleX, Signature } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { SignaturePad } from "@/components/signature-pad";

export function ApprovalForm({ permitId, slotLabel, checklist }: { permitId: string; slotLabel: string; checklist: string[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  const [checked, setChecked] = useState<boolean[]>(checklist.map(() => false));
  const [comment, setComment] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = checked.every(Boolean);

  async function send(decision: "APPROVE" | "REJECT") {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/permits/${permitId}/approval`, {
        body: decision === "APPROVE" ? { decision, comment: comment || null, signature } : { decision, comment },
      });
      router.push(`/permits/${permitId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record your decision.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-sm border border-line-strong bg-ground p-1" role="tablist" aria-label="Decision">
        {(["approve", "reject"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`flex min-h-[44px] items-center justify-center gap-2 rounded-[6px] text-[15px] font-semibold transition-colors duration-out ease-ui ${
              mode === m ? "bg-white text-ink shadow-sm ring-1 ring-line-strong" : "text-ink-muted hover:text-ink"
            }`}
          >
            {m === "approve" ? <CircleCheck aria-hidden className={`h-[18px] w-[18px] ${mode === m ? "text-good" : ""}`} /> : <CircleX aria-hidden className={`h-[18px] w-[18px] ${mode === m ? "text-critical" : ""}`} />}
            {m === "approve" ? "Approve" : "Reject"}
          </button>
        ))}
      </div>

      {mode === "approve" ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            send("APPROVE");
          }}
        >
          <fieldset className="space-y-2">
            <legend className="label">I have personally checked:</legend>
            {checklist.map((c, i) => (
              <label key={c} className="check-row">
                <input type="checkbox" className="check-box" checked={checked[i]} onChange={(e) => setChecked(checked.map((x, j) => (j === i ? e.target.checked : x)))} />
                <span className="text-[15px] leading-snug">{c}</span>
              </label>
            ))}
          </fieldset>
          <div>
            <label className="label" htmlFor="approve-comment">Comment / conditions (optional)</label>
            <textarea id="approve-comment" className="input py-2" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Fire watch to stay 60 min after work, not 30." />
          </div>
          <div>
            <span className="label">Signature — {slotLabel}</span>
            <SignaturePad onChange={setSignature} />
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="btn-primary min-h-[56px] w-full text-lg" disabled={busy || !allChecked || !signature}>
            <Signature aria-hidden />
            {busy ? "Signing…" : "Approve & sign"}
          </button>
          {(!allChecked || !signature) && <p className="text-center text-[14px] text-ink-muted">Tick every check and sign to approve.</p>}
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            send("REJECT");
          }}
        >
          <div>
            <label className="label" htmlFor="reject-reason">
              Reason for rejection <span className="text-critical">*</span>
            </label>
            <textarea id="reject-reason" className="input py-2" rows={4} required minLength={5} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What must change before this could be approved? The requester will need to raise a new permit." />
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="btn-stop min-h-[56px] w-full text-lg" disabled={busy || comment.trim().length < 5}>
            {busy ? "Rejecting…" : "Reject permit"}
          </button>
        </form>
      )}
    </div>
  );
}
